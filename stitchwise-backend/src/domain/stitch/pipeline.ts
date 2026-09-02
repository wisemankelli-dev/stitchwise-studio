/**
 * Model-Agnostic Image-to-Stitch Pipeline
 *
 * Provides a clean separation between image generation (any AI model)
 * and stitch grid conversion. The pipeline normalizes any image source
 * (DALL-E, OpenAI AI, SVG rendering, file upload) into raw RGBA pixels,
 * then deterministically converts them to a stitch grid.
 *
 * Architecture:
 *   generatePatternFromImage() — calls DALL-E/OpenAI, downloads PNG
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
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE, CROSS_STITCH_SYMBOLS } from "./types";
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
  height?: number,
): PatternResult {
  // Step 1: Quantize colors using the existing frequency-based reducer.
  // This does color clustering with a merge threshold to collapse near-identical
  // colors (photo noise, JPEG artifacts) into distinct embroidery colors.
  const widthPx = gridSize;
  const heightPx = height ?? gridSize;
  const maxColors = Math.min(24, Math.max(5, Math.floor(widthPx * heightPx / 100)));
  const quantizedColors = quantizePixels(rawPixels as unknown as Uint8ClampedArray, maxColors);

  // Step 2: Despeckle — remove isolated single pixels.
  // A pixel is isolated if none of its 4-connected neighbors share its quantized color.
  // Replace isolated pixels with the most frequent neighbor color.
  const gridW = widthPx;
  const gridH = heightPx;

  // Pre-compute quantized color index for each pixel for fast neighbor lookups
  const pixelColorIdx = new Uint8Array(gridW * gridH);
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const idx = (row * gridW + col) * 4;
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
      pixelColorIdx[row * gridW + col] = bestIdx;
    }
  }

  // Despeckle pass
  const cleanedColorIdx = new Uint8Array(pixelColorIdx);
  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const curIdx = pixelColorIdx[row * gridW + col];

      // Gather 4-connected neighbors
      const neighbors: number[] = [];
      if (row > 0) neighbors.push(pixelColorIdx[(row - 1) * gridW + col]);
      if (row < gridH - 1) neighbors.push(pixelColorIdx[(row + 1) * gridW + col]);
      if (col > 0) neighbors.push(pixelColorIdx[row * gridW + (col - 1)]);
      if (col < gridW - 1) neighbors.push(pixelColorIdx[row * gridW + (col + 1)]);

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
        cleanedColorIdx[row * gridW + col] = bestN;
      }
    }
  }

  // Step 3: Map each pixel to nearest DMC thread color and build the grid
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  for (let row = 0; row < gridH; row++) {
    const gridRow: StitchCell[] = [];
    for (let col = 0; col < gridW; col++) {
      const qi = cleanedColorIdx[row * gridW + col];
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

  // Step 3b: Merge near-duplicate DMC colors so the pattern reads as clean,
  // distinct regions (recognizability fix — muddy near-identical threads make
  // the subject unreadable). Greedy by frequency: each color joins the first
  // representative within 80 RGB sum-distance; the most-used color in a
  // cluster becomes the representative.
  {
    const WHITE_CODE = "520";
    if (!dmcCountMap.has(WHITE_CODE)) {
      dmcCountMap.set(WHITE_CODE, { code: WHITE_CODE, name: "White", hex: "#ffffff", count: 0 });
    }
    const used = Array.from(dmcCountMap.entries()).sort((a, b) => b[1].count - a[1].count);
    const repOf = new Map<string, string>();
    const reps: Array<{ code: string; rgb: [number, number, number] }> = [];
    let mergedAny = false;
    // Light + low-saturation colors are background halo from the AI artwork's
    // soft edges — merge them into pure white so the subject silhouette is
    // crisp instead of a fuzzy blob (owner report 08-18: "looks like blobs").
    const halo = new Set<string>();
    for (const [code, entry] of dmcCountMap) {
      const hex = entry.hex.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max >= 190 && (max - min) / max <= 0.2) halo.add(code);
    }
    for (const [code] of used) {
      if (halo.has(code)) {
        repOf.set(code, WHITE_CODE);
        if (code !== WHITE_CODE) mergedAny = true;
        continue;
      }
      const entry = dmcCountMap.get(code)!;
      const hex = entry.hex.replace("#", "");
      const rgb: [number, number, number] = [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
      let rep = code;
      for (const r of reps) {
        const d = Math.abs(rgb[0] - r.rgb[0]) + Math.abs(rgb[1] - r.rgb[1]) + Math.abs(rgb[2] - r.rgb[2]);
        if (d <= 80) { rep = r.code; break; }
      }
      if (rep === code) reps.push({ code, rgb }); else mergedAny = true;
      repOf.set(code, rep);
    }
    if (mergedAny) {
      const merged = new Map<string, { code: string; name: string; hex: string; count: number }>();
      // Re-point grid cells at their representative
      for (const row of grid) {
        for (const cell of row) {
          const target = repOf.get(cell.dmcCode)!;
          const src = dmcCountMap.get(target)!;
          cell.dmcCode = target;
          cell.dmcName = src.name;
          cell.color = src.hex;
        }
      }
      // Sum counts per representative
      for (const [code, entry] of dmcCountMap) {
        const target = repOf.get(code)!;
        const repEntry = dmcCountMap.get(target)!;
        const cur = merged.get(target) ?? { code: target, name: repEntry.name, hex: repEntry.hex, count: 0 };
        cur.count += entry.count;
        merged.set(target, cur);
      }
      dmcCountMap.clear();
      for (const [code, v] of merged) dmcCountMap.set(code, v);
    }
  }

  // Step 4: Build DMC usage array sorted by count (descending), with cross-stitch symbols
  const dmcColors: DmcUsage[] = Array.from(dmcCountMap.values())
    .sort((a, b) => b.count - a.count)
    .map((entry, i) => ({
      ...entry,
      symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
    }));

  return {
    grid,
    gridSize,
    stitchCount: widthPx * heightPx,
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
  const size = gridSize >= 8 && gridSize <= 200 ? gridSize : DEFAULT_GRID_SIZE;

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
  const size = gridSize >= 8 && gridSize <= 200 ? gridSize : DEFAULT_GRID_SIZE;

  // Render SVG at high resolution (1024px) to preserve organic curved paths,
  // then let imageToStitchGrid downscale to the target grid via nearest-neighbor.
  // Rendering directly at gridSize (e.g. 50px) destroys all detail.
  const SVG_RENDER_SIZE = 1024;
  const pngBuffer = await sharp(Buffer.from(svgString))
    .resize(SVG_RENDER_SIZE, SVG_RENDER_SIZE, {
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
 * swap DALL-E for OpenAI AI, OpenAI, or any other generator without
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
  const size = gridSize >= 8 && gridSize <= 200 ? gridSize : DEFAULT_GRID_SIZE;

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
