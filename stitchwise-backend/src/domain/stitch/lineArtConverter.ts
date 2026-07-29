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
 * Binarize raw RGBA pixel data to pure black and white.
 * Every pixel with luminance >= 200 becomes pure white (#FFFFFF).
 * Every pixel with luminance < 200 becomes pure black (#000000).
 *
 * This eliminates the subtle off-white/gray anti-aliased pixels
 * that AI models produce, which otherwise scatter into dozens of
 * unwanted DMC colors.
 */
function binarizeImage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  whiteThreshold: number = 200,
): void {
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    // Standard luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum >= whiteThreshold) {
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

  // Step 2: Binarize to pure black & white — eliminates AI-generated
  // off-white/gray artifacts that become unwanted DMC color scatter.
  binarizeImage(rawPixels, size, size);

  // Step 3: Convert to grayscale and apply Sobel edge detection
  const gray = toGrayscale(rawPixels, size, size);
  const magnitude = sobelEdgeDetection(gray, size, size);

  // Step 4: Threshold the edge map to produce an outline mask
  const edgeMask = thresholdEdges(magnitude, edgeThreshold);

  // Step 5: Build the stitch grid.
  // Outline pixels (edgeMask=1) → backstitch with DMC 310 Black.
  // Region pixels (edgeMask=0) → ALWAYS white (fabric background).
  // The AI generates line art; our pipeline extracts edges. No fill colors.
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  // Pre-resolve the white DMC so we don't look it up per pixel
  const whiteDmc = closestDmcColor(255, 255, 255);

  for (let row = 0; row < size; row++) {
    const gridRow = [];
    for (let col = 0; col < size; col++) {
      const isEdge = edgeMask[row * size + col] === 1;

      let hex: string;
      let dmcCode: string | undefined;
      let dmcName: string | undefined;
      let stitchType: "cross" | "back";

      if (isEdge) {
        // Outline pixel → DMC 310 Black with backstitch
        const outlineDmc = closestDmcColor(0, 0, 0);
        hex = rgbToHex(outlineDmc.rgb[0], outlineDmc.rgb[1], outlineDmc.rgb[2]);
        dmcCode = outlineDmc.code;
        dmcName = outlineDmc.name;
        stitchType = "back";
      } else {
        // Background pixel → ALWAYS white (fabric), cross stitch
        hex = rgbToHex(whiteDmc.rgb[0], whiteDmc.rgb[1], whiteDmc.rgb[2]);
        dmcCode = whiteDmc.code;
        dmcName = whiteDmc.name;
        stitchType = "cross";
      }

      gridRow.push({ color: hex, dmcCode, dmcName, stitchType });

      // Track DMC usage
      const key = dmcCode ?? "unknown";
      if (dmcCountMap.has(key)) {
        dmcCountMap.get(key)!.count++;
      } else {
        dmcCountMap.set(key, {
          code: key,
          name: dmcName ?? "Unknown",
          hex,
          count: 1,
        });
      }
    }
    grid.push(gridRow);
  }

  // Build DMC usage array sorted by count (descending)
  const dmcColors: DmcUsage[] = Array.from(dmcCountMap.values())
    .sort((a, b) => b.count - a.count);

  return {
    grid,
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}
