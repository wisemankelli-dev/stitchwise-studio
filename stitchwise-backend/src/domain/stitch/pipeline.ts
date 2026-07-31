/**
 * Model-Agnostic Image-to-Stitch Pipeline
 *
 * Provides a clean separation between image generation (any AI model)
 * and stitch grid conversion. The pipeline normalizes any image source
 * (DALL-E, Stability AI, SVG rendering, file upload) into raw RGBA pixels,
 * then deterministically converts them to a stitch grid.
 *
 * Architecture:
 *   generatePatternFromImage() — calls DALL-E/Stability, downloads PNG
 *       ↓
 *   imageToStitchGrid()      — normalizes image to gridSize×gridSize, extracts pixels
 *       ↓
 *   pixelsToStitchGrid()     — DMC mapping, despeckle, region analysis → PatternResult
 *
 * SVG rendering:
 *   svgToStitchGrid()        — renders SVG to PNG via Sharp, then calls imageToStitchGrid
 */

import sharp from "sharp";
import axios from "axios";
import type { StitchCell, StitchGrid, PatternResult, DmcUsage } from "./types";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "./types";
import { closestDmcColor, rgbToHex } from "./dmcColors";
import { quantizePixels } from "./colorReducer";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// ─── pixelsToStitchGrid ─────────────────────────────────────────────────────

/**
 * Convert raw RGBA pixel data into a stitch grid with DMC color mapping.
 *
 * Pipeline:
 *   1. Quantize colors using frequency-based clustering (preserves distinct colors)
 *   2. Despeckle — remove isolated single-pixel noise
 *   3. Map each pixel to nearest DMC thread color
 *   4. Build StitchGrid[][] with per-cell DMC metadata
 *   5. Compute DMC usage counts sorted by frequency
 *
 * This is the deterministic core — no AI involved. All image generation
 * happens upstream; this function only handles pixel→stitch conversion.
 *
 * @param rawPixels - RGBA pixel buffer (gridSize × gridSize × 4 bytes)
 * @param gridSize - Grid dimensions (square)
 * @param prompt - Optional prompt for context (stored in result, not used for processing)
 * @returns PatternResult with grid, stitch count, and DMC color breakdown
 */
export function pixelsToStitchGrid(
  rawPixels: Uint8Array,
  gridSize: number,
  prompt?: string,
): PatternResult {
  // Step 1: Quantize colors using the existing frequency-based reducer.
  // This does color clustering with a merge threshold to collapse near-identical
  // colors (photo noise, JPEG artifacts) into distinct embroidery colors.
  const maxColors = Math.min(24, Math.max(5, Math.floor(gridSize * gridSize / 100)));
  const quantizedColors = quantizePixels(rawPixels as unknown as Uint8ClampedArray, maxColors);

  // Step 2: Despeckle — remove isolated single pixels.
  // A pixel is isolated if none of its 4-connected neighbors share its quantized color.
  // Replace isolated pixels with the most frequent neighbor color.
  const height = gridSize;
  const width = gridSize;

  // Pre-compute quantized color index for each pixel for fast neighbor lookups
  const pixelColorIdx = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4;
      const r = rawPixels[idx];
      const g = rawPixels[idx + 1];
      const b = rawPixels[idx + 2];

      let bestDist = Infinity;
      let bestIdx = 0;
      for (let qi = 0; qi < quantizedColors.length; qi++) {
        const qc = quantizedColors[qi];
        const d = (r - qc.r) ** 2 + (g - qc.g) ** 2 + (b - qc.b) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = qi;
        }
      }
      pixelColorIdx[row * width + col] = bestIdx;
    }
  }

  // Despeckle pass
  const cleanedColorIdx = new Uint8Array(pixelColorIdx);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const curIdx = pixelColorIdx[row * width + col];

      // Gather 4-connected neighbors
      const neighbors: number[] = [];
      if (row > 0) neighbors.push(pixelColorIdx[(row - 1) * width + col]);
      if (row < height - 1) neighbors.push(pixelColorIdx[(row + 1) * width + col]);
      if (col > 0) neighbors.push(pixelColorIdx[row * width + (col - 1)]);
      if (col < width - 1) neighbors.push(pixelColorIdx[row * width + (col + 1)]);

      // Check if all neighbors are different from this pixel
      const allDifferent = neighbors.every(n => n !== curIdx);
      if (allDifferent && neighbors.length > 0) {
        // Replace with the most frequent neighbor color
        const freq = new Map<number, number>();
        for (const n of neighbors) {
          freq.set(n, (freq.get(n) ?? 0) + 1);
        }
        let bestN = neighbors[0];
        let bestFreq = 0;
        for (const [n, f] of freq) {
          if (f > bestFreq) {
            bestFreq = f;
            bestN = n;
          }
        }
        cleanedColorIdx[row * width + col] = bestN;
      }
    }
  }

  // Step 3: Map each pixel to nearest DMC thread color and build the grid
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  for (let row = 0; row < height; row++) {
    const gridRow: StitchCell[] = [];
    for (let col = 0; col < width; col++) {
      const qi = cleanedColorIdx[row * width + col];
      const qc = quantizedColors[qi] ?? quantizedColors[0];

      const dmc = closestDmcColor(qc.r, qc.g, qc.b);
      const hex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

      gridRow.push({
        color: hex,
        dmcCode: dmc.code,
        dmcName: dmc.name,
      });

      // Track DMC usage
      const key = dmc.code;
      if (dmcCountMap.has(key)) {
        dmcCountMap.get(key)!.count++;
      } else {
        dmcCountMap.set(key, {
          code: dmc.code,
          name: dmc.name,
          hex,
          count: 1,
        });
      }
    }
    grid.push(gridRow);
  }

  // Step 4: Build DMC usage array sorted by count (descending)
  const dmcColors: DmcUsage[] = Array.from(dmcCountMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  return {
    grid,
    gridSize,
    stitchCount: gridSize * gridSize,
    dmcColors,
    prompt,
  };
}

// ─── imageToStitchGrid ──────────────────────────────────────────────────────

/**
 * Convert an image buffer to a stitch grid by normalizing to the target
 * grid dimensions, extracting raw RGBA pixels, and delegating to
 * `pixelsToStitchGrid` for conversion.
 *
 * Uses nearest-neighbor resize to preserve hard edges — ideal for
 * embroidery patterns where each pixel = one stitch.
 *
 * @param imageBuffer - Raw image data (PNG, JPEG, WebP, etc.)
 * @param gridSize - Target grid dimensions (square)
 * @param prompt - Optional prompt string for context
 * @returns PatternResult
 */
export async function imageToStitchGrid(
  imageBuffer: Buffer,
  gridSize: number = DEFAULT_GRID_SIZE,
  prompt?: string,
): Promise<PatternResult> {
  // Validate grid size
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = validSizes.includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;

  // Step 1: Normalize image to target grid dimensions
  // Nearest-neighbor preserves hard edges and creates clean pixel blocks.
  // A 1px median filter removes isolated speckle noise.
  const { data } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .median(1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Step 2: Delegate to the deterministic pixel→grid converter
  return pixelsToStitchGrid(new Uint8Array(data), size, prompt);
}

// ─── svgToStitchGrid ────────────────────────────────────────────────────────

/**
 * Render an SVG string to a stitch grid.
 *
 * Renders the SVG to a PNG at the target grid size via Sharp,
 * then passes the rasterized pixels through the standard pipeline.
 *
 * @param svgString - Raw SVG markup as a string
 * @param gridSize - Target grid dimensions (square)
 * @param prompt - Optional prompt for context
 * @returns PatternResult
 */
export async function svgToStitchGrid(
  svgString: string,
  gridSize: number = DEFAULT_GRID_SIZE,
  prompt?: string,
): Promise<PatternResult> {
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = validSizes.includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;

  // Render SVG to PNG at target dimensions via Sharp
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();

  // Route through imageToStitchGrid for consistent processing
  return imageToStitchGrid(pngBuffer, size, prompt);
}

// ─── generatePatternFromImage ───────────────────────────────────────────────

/**
 * Generate an embroidery pattern from a text prompt using an AI image model.
 *
 * This is the top-level function for the DALL-E / text-to-image pipeline.
 * It generates artwork via the provided `generateImage` callback, downloads
 * the resulting PNG, and converts it through the standard stitch pipeline.
 *
 * The `generateImage` callback abstraction makes this model-agnostic:
 * swap DALL-E for Stability AI, Leonardo, or any other generator without
 * touching the stitch conversion logic.
 *
 * @param prompt - Text description of the desired pattern
 * @param gridSize - Target grid dimensions (square)
 * @param generateImage - Async function that takes a prompt and returns {url, buffer}
 * @returns PatternResult
 */
export async function generatePatternFromImage(
  prompt: string,
  gridSize: number = DEFAULT_GRID_SIZE,
  generateImage: (prompt: string) => Promise<{ url: string; buffer: Buffer } | null>,
): Promise<PatternResult & { previewUrl?: string }> {
  const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
  const size = validSizes.includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;

  // Generate artwork
  const generation = await generateImage(prompt);

  if (!generation || !generation.buffer) {
    throw new Error("AI image generation failed. No image returned.");
  }

  // Convert through the standard pipeline
  const pattern = await imageToStitchGrid(generation.buffer, size, prompt);

  return {
    ...pattern,
    previewUrl: generation.url,
  };
}
