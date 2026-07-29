/**
 * Line Art Converter — Converts coloring-book-style line art images to
 * embroidery stitch grids with outline (backstitch) and region (cross stitch)
 * type assignments.
 *
 * Pipeline:
 * 1. Resize image to target grid dimensions using nearest-neighbor
 * 2. Apply Sobel edge detection to identify outlines
 * 3. Threshold the edge map to binary (outline vs. region)
 * 4. Map outline pixels → backstitch type (DMC 310 black)
 * 5. Map region pixels → cross stitch type with nearest DMC color
 * 6. Return PatternResult compatible with the existing grid system
 */

import sharp from "sharp";
import type { StitchGrid, PatternResult, DmcUsage } from "./types";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "./types";
import { closestDmcColor, rgbToHex } from "./dmcColors";

// ─── Sobel Edge Detection ───────────────────────────────────────────────────

/** Sobel X kernel (3x3) */
const SOBEL_X = [
  -1, 0, 1,
  -2, 0, 2,
  -1, 0, 1,
];

/** Sobel Y kernel (3x3) */
const SOBEL_Y = [
  -1, -2, -1,
  0,  0,  0,
  1,  2,  1,
];

/**
 * Convert a flat RGBA pixel array to grayscale luminance values.
 * Uses the standard luminance formula: 0.299R + 0.587G + 0.114B
 */
function toGrayscale(pixels: Uint8ClampedArray, width: number, height: number): Float64Array {
  const gray = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
  return gray;
}

/**
 * Apply a 3x3 convolution kernel to a grayscale image.
 * Pixels at the border are skipped (set to 0).
 */
function convolve3x3(
  gray: Float64Array,
  width: number,
  height: number,
  kernel: number[],
): Float64Array {
  const result = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = gray[(y + ky) * width + (x + kx)];
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          sum += pixel * weight;
        }
      }
      result[y * width + x] = sum;
    }
  }
  return result;
}

/**
 * Apply Sobel edge detection to produce an edge magnitude map.
 * Returns a Float64Array where each value is the gradient magnitude [0, ~1442].
 */
function sobelEdgeDetection(
  gray: Float64Array,
  width: number,
  height: number,
): Float64Array {
  const gx = convolve3x3(gray, width, height, SOBEL_X);
  const gy = convolve3x3(gray, width, height, SOBEL_Y);

  const magnitude = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    magnitude[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
  }
  return magnitude;
}

// ─── Image Binarization ─────────────────────────────────────────────────────

/**
 * Invert the image if it's predominantly dark.
 * Stability AI often generates images that are mostly dark with light elements.
 * Sobel expects the opposite: light background with dark outlines.
 * If >50% of pixels have luminance < 128, flip R, G, B to (255 - value).
 */
function invertIfDark(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  let darkCount = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (lum < 128) darkCount++;
  }
  if (darkCount > total / 2) {
    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      pixels[idx] = 255 - pixels[idx];
      pixels[idx + 1] = 255 - pixels[idx + 1];
      pixels[idx + 2] = 255 - pixels[idx + 2];
    }
  }
}

/**
 * Binarize raw RGBA pixel data to pure black and white.
 * Luminance >= 200 → #FFFFFF (white/background).
 * Luminance < 200  → #000000 (black/outline).
 * This gives Sobel clean edges to detect — no anti-aliasing noise.
 * Color fills are added later by the user, not by the AI.
 */
function binarizeImage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum >= 200) {
      pixels[idx] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
    } else {
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
    }
  }
}

// ─── Thresholding ───────────────────────────────────────────────────────────

/**
 * Threshold an edge magnitude map to a binary mask.
 * Pixels with magnitude >= threshold are marked as edges (outlines).
 *
 * @param magnitude - Sobel edge magnitude array
 * @param threshold - Edge detection threshold (default 50, range 20-120 recommended)
 */
function thresholdEdges(
  magnitude: Float64Array,
  threshold: number = 50,
): Uint8Array {
  const mask = new Uint8Array(magnitude.length);
  for (let i = 0; i < magnitude.length; i++) {
    mask[i] = magnitude[i] >= threshold ? 1 : 0;
  }
  return mask;
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Convert a line art image buffer to a stitch grid with stitch type assignments.
 *
 * @param imageBuffer - Raw image data (PNG, JPEG, etc.)
 * @param gridSize - Output grid dimensions (50, 75, 100, 150, 200)
 * @param edgeThreshold - Sobel edge threshold (20-120, default 50). Lower = more edges.
 * @param outlineDmcCode - DMC code for outline stitches (default "310" = black)
 * @returns PatternResult with stitchType assignments
 */
export async function lineArtToStitchGrid(
  imageBuffer: Buffer,
  gridSize: number = DEFAULT_GRID_SIZE,
  edgeThreshold: number = 50,
  outlineDmcCode: string = "310",
): Promise<PatternResult> {
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = validSizes.includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;

  // Step 1: Resize the image to the target grid size using nearest-neighbor.
  // This preserves hard edges in line art — essential for clean outlines.
  const { data } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawPixels = new Uint8ClampedArray(data);

  // Step 2: Auto-invert if the image is predominantly dark.
  // Stability AI models often produce dark images with light elements.
  // If >50% of pixels have luminance < 128, invert to make it
  // light-background with dark outlines — what Sobel expects.
  invertIfDark(rawPixels, size, size);

  // Step 3: Binarize to pure black & white for clean edge detection.
  binarizeImage(rawPixels, size, size);

  // Step 4: Convert to grayscale and apply Sobel edge detection
  const gray = toGrayscale(rawPixels, size, size);
  const magnitude = sobelEdgeDetection(gray, size, size);

  // Step 5: Threshold the edge map to produce an outline mask
  const edgeMask = thresholdEdges(magnitude, edgeThreshold);

  // Step 6: Build the stitch grid — pure B&W line art.
  // Outline pixels (edgeMask=1) → backstitch with DMC 310 Black.
  // Region pixels (edgeMask=0) → white (fabric). Color fills are
  // applied later by the user via the coloring-book fill tool.
  const grid: StitchGrid = [];
  const whiteDmc = closestDmcColor(255, 255, 255);
  const blackDmc = closestDmcColor(0, 0, 0);
  const whiteHex = rgbToHex(whiteDmc.rgb[0], whiteDmc.rgb[1], whiteDmc.rgb[2]);
  const blackHex = rgbToHex(blackDmc.rgb[0], blackDmc.rgb[1], blackDmc.rgb[2]);

  let backCount = 0;
  let whiteCount = 0;

  for (let row = 0; row < size; row++) {
    const gridRow = [];
    for (let col = 0; col < size; col++) {
      const isEdge = edgeMask[row * size + col] === 1;

      if (isEdge) {
        gridRow.push({
          color: blackHex,
          dmcCode: blackDmc.code,
          dmcName: blackDmc.name,
          stitchType: "back" as const,
        });
        backCount++;
      } else {
        gridRow.push({
          color: whiteHex,
          dmcCode: whiteDmc.code,
          dmcName: whiteDmc.name,
          stitchType: "cross" as const,
        });
        whiteCount++;
      }
    }
    grid.push(gridRow);
  }

  const dmcColors: DmcUsage[] = [
    { code: blackDmc.code, name: blackDmc.name, hex: blackHex, count: backCount },
    { code: whiteDmc.code, name: whiteDmc.name, hex: whiteHex, count: whiteCount },
  ].filter(c => c.count > 0);

  return {
    grid,
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}
