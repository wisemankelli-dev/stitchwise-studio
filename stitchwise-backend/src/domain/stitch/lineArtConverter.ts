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

/**
 * Apply a simple 3x3 Gaussian blur to smooth noise before edge detection.
 * Uses the kernel: [1 2 1; 2 4 2; 1 2 1] / 16
 */
function gaussianBlur3x3(
  input: Float64Array,
  width: number,
  height: number,
): Float64Array {
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const result = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += input[(y + ky) * width + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        }
      }
      result[y * width + x] = sum / 16;
    }
  }
  return result;
}

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

/**
 * Sample border pixels (all 4 edges) to find the dominant background color.
 * Returns { r, g, b } of the most common color found along the edges.
 */
function detectBackgroundColor(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): { r: number; g: number; b: number } {
  const colorCounts = new Map<string, number>();
  const borderThickness = Math.max(1, Math.floor(Math.min(width, height) * 0.05));

  // Sample top and bottom edges
  for (let row = 0; row < borderThickness; row++) {
    for (let col = 0; col < width; col++) {
      addBorderSample(pixels, row, col, width, colorCounts);
      addBorderSample(pixels, height - 1 - row, col, width, colorCounts);
    }
  }
  // Sample left and right edges
  for (let row = borderThickness; row < height - borderThickness; row++) {
    for (let col = 0; col < borderThickness; col++) {
      addBorderSample(pixels, row, col, width, colorCounts);
      addBorderSample(pixels, row, width - 1 - col, width, colorCounts);
    }
  }

  // Find the most common color
  let bestKey = "";
  let bestCount = 0;
  for (const [key, count] of colorCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }

  if (bestKey) {
    const [r, g, b] = bestKey.split(",").map(Number);
    return { r, g, b };
  }
  return { r: 255, g: 255, b: 255 };
}

function addBorderSample(
  pixels: Uint8ClampedArray,
  row: number,
  col: number,
  width: number,
  map: Map<string, number>,
): void {
  const idx = (row * width + col) * 4;
  const r = pixels[idx];
  const g = pixels[idx + 1];
  const b = pixels[idx + 2];
  // Quantize to reduce noise
  const qr = Math.round(r / 16) * 16;
  const qg = Math.round(g / 16) * 16;
  const qb = Math.round(b / 16) * 16;
  const key = `${qr},${qg},${qb}`;
  map.set(key, (map.get(key) || 0) + 1);
}

/**
 * Replace pixels close to the detected background color with pure white.
 * Threshold of 80 in RGB distance catches anti-aliased edges.
 */
function replaceBackgroundWithWhite(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  bgColor: { r: number; g: number; b: number },
): void {
  const threshold = 80;
  const thresholdSq = threshold * threshold;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const dr = pixels[idx] - bgColor.r;
    const dg = pixels[idx + 1] - bgColor.g;
    const db = pixels[idx + 2] - bgColor.b;
    const distSq = dr * dr + dg * dg + db * db;

    if (distSq <= thresholdSq) {
      pixels[idx] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
    }
  }
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

  // Step 2: Detect and replace background with pure white.
  // Sample the border (all 4 edges) to find the dominant background color,
  // then push every pixel close to it to pure white before DMC mapping.
  const bgColor = detectBackgroundColor(rawPixels, size, size);
  replaceBackgroundWithWhite(rawPixels, size, size, bgColor);

  // Step 3: Map each pixel to its nearest DMC color.
  // No edge detection — this is color quantization, not outline extraction.
  // Closed color regions from the AI's flat vector art become stitch regions.
  const MAX_COLORS = 15;
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  for (let row = 0; row < size; row++) {
    const gridRow = [];
    for (let col = 0; col < size; col++) {
      const idx = (row * size + col) * 4;
      const r = rawPixels[idx];
      const g = rawPixels[idx + 1];
      const b = rawPixels[idx + 2];

      const dmc = closestDmcColor(r, g, b);
      const hex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

      gridRow.push({
        color: hex,
        dmcCode: dmc.code,
        dmcName: dmc.name,
        stitchType: "cross" as const,
      });

      const key = dmc.code;
      if (dmcCountMap.has(key)) {
        dmcCountMap.get(key)!.count++;
      } else {
        dmcCountMap.set(key, { code: key, name: dmc.name, hex, count: 1 });
      }
    }
    grid.push(gridRow);
  }

  // Step 3: Cap palette to top N colors, remap outliers
  const sorted = Array.from(dmcCountMap.values()).sort((a, b) => b.count - a.count);
  const topSet = new Set(sorted.slice(0, MAX_COLORS).map(c => c.code));

  // Build remap lookup
  const remapCache = new Map<string, string>();
  function nearestInTop(code: string): string {
    if (topSet.has(code)) return code;
    if (remapCache.has(code)) return remapCache.get(code)!;
    const orig = dmcCountMap.get(code);
    if (!orig) return sorted[0]?.code ?? "520";
    let best = sorted[0].code;
    let bestD = Infinity;
    for (const tc of sorted.slice(0, MAX_COLORS)) {
      const dr = parseInt(orig.hex.slice(1,3),16) - parseInt(tc.hex.slice(1,3),16);
      const dg = parseInt(orig.hex.slice(3,5),16) - parseInt(tc.hex.slice(3,5),16);
      const db = parseInt(orig.hex.slice(5,7),16) - parseInt(tc.hex.slice(5,7),16);
      const d = dr*dr + dg*dg + db*db;
      if (d < bestD) { bestD = d; best = tc.code; }
    }
    remapCache.set(code, best);
    return best;
  }

  // Remap and recount
  const finalMap = new Map<string, { code: string; name: string; hex: string; count: number }>();
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = grid[row][col];
      const newCode = nearestInTop(cell.dmcCode ?? "520");
      if (newCode !== cell.dmcCode) {
        const info = dmcCountMap.get(newCode);
        if (info) {
          cell.dmcCode = newCode;
          cell.dmcName = info.name;
          cell.color = info.hex;
        }
      }
      const key = cell.dmcCode ?? "520";
      if (finalMap.has(key)) {
        finalMap.get(key)!.count++;
      } else {
        const info = dmcCountMap.get(key);
        finalMap.set(key, {
          code: key,
          name: info?.name ?? "Unknown",
          hex: info?.hex ?? "#FFFFFF",
          count: 1,
        });
      }
    }
  }

  const dmcColors: DmcUsage[] = Array.from(finalMap.values())
    .sort((a, b) => b.count - a.count);

  return {
    grid,
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}
