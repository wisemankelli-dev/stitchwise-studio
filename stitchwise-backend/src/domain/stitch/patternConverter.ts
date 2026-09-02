/**
 * Pattern Converter — Converts images to embroidery stitch grids.
 *
 * Core pipeline:
 * 1. Download/load image from URL or buffer
 * 2. Resize to target grid dimensions (gridSize x gridSize pixels) using high-quality
 *    lanczos downscaling (each stitch = the average of its source region)
 * 3. Quantize colors to the user's requested number of colors (15-80) via median-cut
 * 4. Map each reduced color to the nearest DMC thread color, deduplicating
 * 5. Build StitchGrid and count DMC usage
 *
 * The pipeline creates clean artwork first (by downscaling, median filtering, and
 * color quantization), then converts pixel-for-pixel to stitches.
 * Owner directive: "Each pixel = one stitch."
 * NOTE (2026-08-18, owner report "bird not blue"): the previous cold-color (blue/violet)
 * remap step was REMOVED — it destroyed legitimate blue/violet subjects by remapping
 * them to warm colors. Edge noise is handled by the median filter + posterization.
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
  target?: { width: number; height: number },
): Promise<PatternResult> {
  // Validate grid size
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = gridSize >= 8 && gridSize <= 240 ? gridSize : DEFAULT_GRID_SIZE;
  // Aspect-aware: when the caller supplies canvas dims (e.g. a 154×238 stocking
  // canvas), produce a NON-SQUARE grid at those dims instead of always square.
  // The frontend frames the returned grid by its own dims, so matching the
  // canvas aspect directly fixes the 27%-fill bug (square art scaled into a
  // narrow canvas leaves most cells outside the fitted bbox).
  const outW = target?.width && target.width >= 8 && target.width <= 300 ? target.width : size;
  const outH = target?.height && target.height >= 8 && target.height <= 300 ? target.height : size;

  // Step 0: Auto-crop the light background so the subject fills the grid
  // (recognizability fix — a small subject on a huge white field converts to
  // an unreadable pattern). Also boost saturation so colors separate cleanly.
  let workingBuffer = imageBuffer;
  try {
    const meta = await sharp(imageBuffer).metadata();
    const trimmed = await sharp(imageBuffer)
      .trim({ background: [255, 255, 255], threshold: 40 })
      .modulate({ saturation: 1.4 })
      .toBuffer({ resolveWithObject: true });
    const ow = meta.width || 0;
    const oh = meta.height || 0;
    const tw = trimmed.info.width;
    const th = trimmed.info.height;
    // Keep the trim only if most of the image survives — a genuinely small
    // subject (e.g. a white bird on white) would be eaten by the trim.
    if (ow > 0 && oh > 0 && tw >= ow * 0.6 && th >= oh * 0.6) {
      workingBuffer = trimmed.data;
    }
  } catch {
    // fall back to the untrimmed image
  }

  // Step 1: Resize the image to the target grid size using high-quality lanczos
  // downscaling — each stitch cell reflects the average of its source region,
  // preserving the subject's shape and hues (nearest-neighbor sampling caused
  // aliased, blocky patterns and dropped colors).
  // Step 2: Posterize to exactly maxColors flat colors via PNG palette quantization.
  //   This eliminates gradient artifacts and shadow-edge pixels that would otherwise
  //   map to random/wrong DMC threads (e.g. violet edge pixels on yellow petals).
  //   No dithering — every pixel is forced into one of maxColors solid regions.
  // Step 3: Extract raw pixels from the posterized image for DMC mapping.
  const posterizedPng = await sharp(workingBuffer)
    .resize(outW, outH, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.lanczos3,
    })
    .median(3) // stronger noise reduction before posterization
    .png({ palette: true, colours: maxColors, dither: 0 })
    .toBuffer();

  const { data, info } = await sharp(posterizedPng)
    .ensureAlpha() // add alpha channel — pixelsToStitchGrid expects RGBA
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 4: Delegate to the model-agnostic pixel→grid pipeline (non-square aware)
  return pixelsToStitchGrid(new Uint8Array(data), outW, undefined, outH);
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