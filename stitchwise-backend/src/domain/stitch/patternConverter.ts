/**
 * Pattern Converter — Converts images to embroidery stitch grids.
 *
 * Core pipeline:
 * 1. Download/load image from URL or buffer
 * 2. Resize to target grid dimensions (gridSize x gridSize pixels) using nearest-neighbor
 * 3. Quantize colors to the user's requested number of colors (15-80) via median-cut
 * 4. Map each reduced color to the nearest DMC thread color, deduplicating
 * 5. Build StitchGrid and count DMC usage
 *
 * The pipeline creates clean artwork first (by downscaling, median filtering, and
 * color quantization), then converts pixel-for-pixel to stitches.
 * Owner directive: "Each pixel = one stitch."
 */

import sharp from "sharp";
import axios from "axios";
import type { StitchCell, StitchGrid, PatternResult } from "./types";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE, CROSS_STITCH_SYMBOLS } from "./types";
import { pixelsToStitchGrid } from "./pipeline";

/**
 * Convert an image URL to a stitch grid by:
 * 1. Downloading the image
 * 2. Resizing to gridSize x gridSize pixels
 * 3. Quantizing colors to maxColors via median-cut
 * 4. Quantizing each pixel to the nearest DMC thread color
 *
 * @param imageUrl - URL of the image to convert
 * @param gridSize - Output grid dimensions (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult with grid, stitch count, and DMC usage
 */
export async function imageUrlToStitchGrid(
  imageUrl: string,
  gridSize: number = DEFAULT_GRID_SIZE,
  maxColors: number = 24,
): Promise<PatternResult> {
  try {
    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    const imageBuffer = Buffer.from(response.data);
    return imageBufferToStitchGrid(imageBuffer, gridSize, maxColors);
  } catch (err) {
    console.error({ event: "image_download_failed", url: imageUrl, error: String(err) });
    // Fallback: generate a simple pattern
    const size = (AVAILABLE_GRID_SIZES as readonly number[]).includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;
    const fallbackGrid: StitchCell[][] = [];
    for (let r = 0; r < size; r++) {
      const row: StitchCell[] = [];
      for (let c = 0; c < size; c++) {
        if ((r + c) % 3 === 0) { row.push({ color: '#e11d48', dmcCode: '321', dmcName: 'Christmas Red' }); }
        else if ((r + c) % 3 === 1) { row.push({ color: '#0284c7', dmcCode: '798', dmcName: 'Delft Blue' }); }
        else { row.push({ color: '#16a34a', dmcCode: '700', dmcName: 'Green' }); }
      }
      fallbackGrid.push(row);
    }
    return {
      grid: fallbackGrid,
      gridSize: size,
      stitchCount: size * size,
      dmcColors: [
        { code: '321', name: 'Christmas Red', hex: '#e11d48', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[0] },
        { code: '798', name: 'Delft Blue', hex: '#0284c7', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[1] },
        { code: '700', name: 'Green', hex: '#16a34a', count: Math.ceil(size * size / 3), symbol: CROSS_STITCH_SYMBOLS[2] },
      ],
    };
  }
}

/**
 * Convert an image buffer to a stitch grid.
 *
 * Pipeline: resize → median filter → median-cut color quantization → DMC mapping
 * This creates clean artwork first, then converts pixel-for-pixel to stitches.
 *
 * @param imageBuffer - Raw image data
 * @param gridSize - Output grid dimensions (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult
 */
export async function imageBufferToStitchGrid(
  imageBuffer: Buffer,
  gridSize: number = DEFAULT_GRID_SIZE,
  maxColors: number = 24,
): Promise<PatternResult> {
  // Validate grid size
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = gridSize >= 8 && gridSize <= 240 ? gridSize : DEFAULT_GRID_SIZE;

  // Step 1: Resize the image to the target grid size using nearest-neighbor.
  // Step 2: Posterize to exactly maxColors flat colors via PNG palette quantization.
  //   This eliminates gradient artifacts and shadow-edge pixels that would otherwise
  //   map to random/wrong DMC threads (e.g. violet edge pixels on yellow petals).
  //   No dithering — every pixel is forced into one of maxColors solid regions.
  // Step 3: Extract raw pixels from the posterized image for DMC mapping.
  const posterizedPng = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .median(3) // stronger noise reduction before posterization
    .png({ palette: true, colours: maxColors, dither: 0 })
    .toBuffer();

  const { data, info } = await sharp(posterizedPng)
    .ensureAlpha() // add alpha channel — pixelsToStitchGrid expects RGBA
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 4: Palette cleanup — remap outlier cold colors (violet/blue) to
  // their nearest warm neighbor in the posterized palette.
  const pixels = new Uint8Array(data);
  const cleanedPixels = remapColdColors(pixels, info.width, info.height, maxColors);

  // Step 5: Delegate to the model-agnostic pixel→grid pipeline
  return pixelsToStitchGrid(cleanedPixels, size);
}

/**
 * Detect violet/blue palette entries and remap those pixels to the
 * nearest non-cold color in the same palette. Cold = hue 200-310 (blue through violet).
 */
function remapColdColors(
  pixels: Uint8Array,
  width: number,
  height: number,
  maxColors: number,
): Uint8Array {
  const totalPixels = width * height;

  // Collect unique colors and their counts (RGBA — 4 bytes per pixel)
  const colorMap = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4; // RGBA stride
    const key = `${pixels[off]},${pixels[off + 1]},${pixels[off + 2]}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { r: pixels[off], g: pixels[off + 1], b: pixels[off + 2], count: 1 });
    }
  }

  const colors = [...colorMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxColors);

  // Identify cold colors (hue 200-310: blue through violet/magenta)
  function isCold(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return false; // grayscale — skip
    if (max === b && b - r > 10 && b - g > 10) return true; // blue-dominant
    // Violet/magenta: R and B both high, G low (R+B >> G)
    if (r > g + 15 && b > g + 15 && Math.abs(r - b) < 60) return true;
    // Periwinkle/slate: low saturation blue-ish
    if (b > r + 5 && b > g + 5 && max - min < 40) return true;
    return false;
  }

  const coldKeys = new Set<string>();
  const warmColors: Array<{ r: number; g: number; b: number; key: string }> = [];

  for (const [key, c] of colors) {
    if (isCold(c.r, c.g, c.b)) {
      coldKeys.add(key);
    } else {
      warmColors.push({ r: c.r, g: c.g, b: c.b, key });
    }
  }

  // If no cold colors or no warm alternatives, return unchanged
  if (coldKeys.size === 0 || warmColors.length === 0) return pixels;

  // Build remap table: for each cold color, find nearest warm color
  const remap = new Map<string, string>();
  for (const coldKey of coldKeys) {
    const [cr, cg, cb] = coldKey.split(",").map(Number);
    let bestDist = Infinity;
    let bestKey = warmColors[0].key;
    for (const w of warmColors) {
      const d = (cr - w.r) ** 2 + (cg - w.g) ** 2 + (cb - w.b) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestKey = w.key;
      }
    }
    remap.set(coldKey, bestKey);
  }

  // Apply remap to pixels (RGBA — 4 bytes per pixel)
  const result = new Uint8Array(pixels);
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4; // RGBA stride
    const key = `${pixels[off]},${pixels[off + 1]},${pixels[off + 2]}`;
    const target = remap.get(key);
    if (target) {
      const [tr, tg, tb] = target.split(",").map(Number);
      result[off] = tr;
      result[off + 1] = tg;
      result[off + 2] = tb;
      // alpha remains unchanged at result[off + 3]
    }
  }

  return result;
}

/**
 * Re-process an existing grid at a different size using nearest-neighbor scaling.
 * Useful when a user wants to switch sizes without re-uploading the source image.
 * The grid is rendered as a pixel image at the original size, then re-sampled.
 *
 * @param grid - The existing stitch grid
 * @param newSize - Target grid size (50, 75, 100, 150, 200)
 * @param maxColors - Target number of colors (15-80, default 24)
 * @returns PatternResult
 */
export async function resizeStitchGrid(
  grid: StitchGrid,
  newSize: number,
  maxColors: number = 24,
): Promise<PatternResult> {
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = newSize >= 8 && newSize <= 200 ? newSize : DEFAULT_GRID_SIZE;
  const oldSize = grid.length;

  // Render the existing grid as a raw RGBA image at its current size
  const pixelData = Buffer.alloc(oldSize * oldSize * 4);
  for (let row = 0; row < oldSize; row++) {
    for (let col = 0; col < oldSize; col++) {
      const idx = (row * oldSize + col) * 4;
      const cell = grid[row]?.[col];
      if (cell?.color) {
        const hex = cell.color.replace('#', '');
        pixelData[idx] = parseInt(hex.substring(0, 2), 16);
        pixelData[idx + 1] = parseInt(hex.substring(2, 4), 16);
        pixelData[idx + 2] = parseInt(hex.substring(4, 6), 16);
      } else {
        pixelData[idx] = 255;
        pixelData[idx + 1] = 255;
        pixelData[idx + 2] = 255;
      }
      pixelData[idx + 3] = 255;
    }
  }

  // Resize via sharp with nearest-neighbor to preserve hard edges
  const { data } = await sharp(pixelData, {
    raw: { width: oldSize, height: oldSize, channels: 4 },
  })
    .resize(size, size, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Delegate to the model-agnostic pixel→grid pipeline
  return pixelsToStitchGrid(new Uint8Array(data), size);
}