/**
 * Line Art Pipeline — Converts coloring-book-style line art to embroidery stitch grids.
 *
 * Pipeline steps:
 *  1. Resize — Scale input image to grid dimensions using nearest-neighbor
 *     (preserves hard edges in coloring-book-style line art).
 *  2. Classify pixels — Each pixel is classified as OUTLINE (black), BACKGROUND
 *     (white/near-white), or REGION (colored interior).
 *  3. Contour tracing — Group adjacent outline pixels into connected paths.
 *  4. Path simplification — Map traced outlines to grid positions for backstitch.
 *  5. Region filling — Flood-fill each closed region surrounded by outlines,
 *     computing the average color and mapping to nearest DMC thread.
 *  6. Stitch mapping — Build the final StitchGrid: outline cells get "back" stitch
 *     type, region cells get "cross" stitch type.
 *
 * Input:  PNG image buffer (line art: black outlines on white, closed regions)
 * Output: PatternResult with per-cell stitchType and DMC color assignments
 */

import sharp from "sharp";
import type { StitchGrid, StitchCell, PatternResult, DmcUsage } from "../../domain/stitch/types";
import { CROSS_STITCH_SYMBOLS, DEFAULT_GRID_SIZE } from "../../domain/stitch/types";
import { closestDmcColor, rgbToHex, DMC_COLORS } from "../../domain/stitch/dmcColors";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Classification result for a single pixel. */
type PixelClass = "outline" | "background" | "region";

/** A 2D point in image or grid space. */
interface Point {
  x: number;
  y: number;
}

/** A connected outline (contour) made up of adjacent pixels. */
interface Contour {
  points: Point[];
}

/** Options controlling the pipeline behavior. */
export interface LineArtPipelineOptions {
  /** Target stitch grid size (default 100). Must be a valid grid size. */
  gridSize?: number;
  /** Threshold for classifying black pixels (sum of R+G+B, default 128). */
  outlineThreshold?: number;
  /** Threshold for classifying white/near-white pixels (min of R,G,B, default 240). */
  backgroundThreshold?: number;
  /** DMC code for the outline backstitch color (default "DMC 310" Black). */
  outlineDmcCode?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_OUTLINE_THRESHOLD = 128;   // R+G+B below this → outline (black)
const DEFAULT_BACKGROUND_THRESHOLD = 240; // min(R,G,B) above this → background (white)
const DEFAULT_OUTLINE_DMC = "DMC 310";   // Black

// ─── Pixel Classification ─────────────────────────────────────────────────────

/**
 * Classify a single pixel as outline, background, or region.
 *
 * For coloring-book-style line art:
 * - Black pixels (low brightness) → outline
 * - Near-white pixels → background
 * - Everything else → region (colored fill)
 */
function classifyPixel(r: number, g: number, b: number, outlineThreshold: number, backgroundThreshold: number): PixelClass {
  // Black outline: all channels very dark
  if (r + g + b < outlineThreshold) return "outline";

  // White background: all channels very bright
  if (r >= backgroundThreshold && g >= backgroundThreshold && b >= backgroundThreshold) return "background";

  // Colored region interior
  return "region";
}

// ─── Contour Tracing ──────────────────────────────────────────────────────────

/**
 * Trace connected outline pixels into contour paths.
 *
 * Uses 8-connectivity (N, NE, E, SE, S, SW, W, NW) to group adjacent
 * outline pixels. Returns a list of contours (connected components).
 *
 * A maximum of 5000 contours is enforced to prevent infinite loops on
 * very noisy images.
 */
function traceContours(outlineMask: boolean[][], size: number): Contour[] {
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const contours: Contour[] = [];

  const directions: [number, number][] = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!outlineMask[y][x] || visited[y][x]) continue;

      // Start a new contour via flood-fill
      const contour: Contour = { points: [] };
      const stack: Point[] = [{ x, y }];

      while (stack.length > 0) {
        const p = stack.pop()!;
        if (p.x < 0 || p.x >= size || p.y < 0 || p.y >= size) continue;
        if (!outlineMask[p.y][p.x] || visited[p.y][p.x]) continue;

        visited[p.y][p.x] = true;
        contour.points.push(p);

        for (const [dy, dx] of directions) {
          stack.push({ x: p.x + dx, y: p.y + dy });
        }
      }

      if (contour.points.length > 0) {
        contours.push(contour);
      }

      // Safety cap: don't trace endless contours on chaotic images
      if (contours.length > 5000) break;
    }
    if (contours.length > 5000) break;
  }

  return contours;
}

// ─── Path Simplification ──────────────────────────────────────────────────────

/**
 * Simplify contour paths to the target grid resolution.
 *
 * Each contour point is already at image resolution (gridSize × gridSize),
 * so mapping is 1:1. Path simplification here converts dense contour pixel
 * runs into a minimal set of cells that adequately cover the outline.
 *
 * Returns a Set of "y,x" grid positions that should be backstitched.
 */
function simplifyPaths(contours: Contour[]): Set<string> {
  const outlineCells = new Set<string>();

  for (const contour of contours) {
    // Every point in the contour is an outline cell at the target resolution,
    // since the image was already resized to gridSize × gridSize.
    for (const p of contour.points) {
      outlineCells.add(`${p.y},${p.x}`);
    }
  }

  return outlineCells;
}

// ─── Region Filling ───────────────────────────────────────────────────────────

/**
 * Flood-fill closed regions bounded by outlines.
 *
 * Iterates over every pixel not classified as outline or background,
 * flood-fills the connected region, computes its average color from the
 * raw pixel data, and maps it to the nearest DMC thread color.
 *
 * Returns:
 *   - regionColors: a map from "y,x" → { hex, dmcCode, dmcName }
 *   - regionMap: a 2D array tracking which region ID each pixel belongs to
 *     (0 = outline/background, 1+ = region ID)
 */
function fillRegions(
  pixelClass: PixelClass[][],
  rawData: Uint8ClampedArray,
  size: number,
): { regionColors: Map<string, { hex: string; dmcCode: string; dmcName: string }>; regionMap: number[][] } {
  const visited: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const regionMap: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  const regionColors = new Map<string, { hex: string; dmcCode: string; dmcName: string }>();

  const directions: [number, number][] = [
    [-1, 0], [0, -1], [0, 1], [1, 0],
  ];
  let regionId = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cls = pixelClass[y][x];
      if (cls !== "region" || visited[y][x]) continue;

      regionId++;

      // Flood-fill this region
      const stack: Point[] = [{ x, y }];
      let rSum = 0, gSum = 0, bSum = 0, count = 0;

      while (stack.length > 0) {
        const p = stack.pop()!;
        if (p.x < 0 || p.x >= size || p.y < 0 || p.y >= size) continue;
        if (visited[p.y][p.x]) continue;

        const pClass = pixelClass[p.y][p.x];
        // Only flood fill through region pixels; stop at outlines and background
        if (pClass !== "region") continue;

        visited[p.y][p.x] = true;
        regionMap[p.y][p.x] = regionId;

        const idx = (p.y * size + p.x) * 4;
        rSum += rawData[idx];
        gSum += rawData[idx + 1];
        bSum += rawData[idx + 2];
        count++;

        for (const [dy, dx] of directions) {
          stack.push({ x: p.x + dx, y: p.y + dy });
        }
      }

      // Compute average color for this region
      if (count > 0) {
        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);
        const dmc = closestDmcColor(avgR, avgG, avgB);
        const hex = rgbToHex(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);

        // Store per-region color
        regionColors.set(`${regionId}`, {
          hex,
          dmcCode: dmc.code,
          dmcName: dmc.name,
        });

        // Also store per-cell for the final grid mapping
        // (We'll look this up by regionId during stitch mapping)
      }
    }
  }

  return { regionColors, regionMap };
}

// ─── Stitch Mapping ───────────────────────────────────────────────────────────

/**
 * Build the final StitchGrid from classified pixels, outline cells, and region mapping.
 *
 * Outline cells → stitch type "back" (backstitch)
 * Region cells  → stitch type "cross"
 * Background cells → filled with white DMC
 */
function mapToStitchGrid(
  pixelClass: PixelClass[][],
  outlineCells: Set<string>,
  regionColors: Map<string, { hex: string; dmcCode: string; dmcName: string }>,
  regionMap: number[][],
  size: number,
  outlineDmcCode: string,
): { grid: StitchGrid; dmcCountMap: Map<string, { code: string; name: string; hex: string; count: number }> } {
  const grid: StitchGrid = [];
  const dmcCountMap = new Map<string, { code: string; name: string; hex: string; count: number }>();

  // Look up the outline DMC color from the palette
  const outlineDmc = DMC_COLORS.find((c) => c.code === outlineDmcCode) || DMC_COLORS.find((c) => c.code === "DMC 310")!;
  const outlineHex = rgbToHex(outlineDmc.rgb[0], outlineDmc.rgb[1], outlineDmc.rgb[2]);

  // Background: white DMC
  const whiteDmc = DMC_COLORS.find((c) => c.code === "DMC 520")!;
  const whiteHex = rgbToHex(whiteDmc.rgb[0], whiteDmc.rgb[1], whiteDmc.rgb[2]);

  for (let y = 0; y < size; y++) {
    const gridRow: StitchCell[] = [];
    for (let x = 0; x < size; x++) {
      const cls = pixelClass[y][x];
      const isOutline = outlineCells.has(`${y},${x}`);

      if (cls === "outline" || isOutline) {
        // Outline → backstitch
        gridRow.push({
          color: outlineHex,
          dmcCode: outlineDmc.code,
          dmcName: outlineDmc.name,
          stitchType: "back",
        });

        const key = outlineDmc.code;
        if (dmcCountMap.has(key)) {
          dmcCountMap.get(key)!.count++;
        } else {
          dmcCountMap.set(key, {
            code: outlineDmc.code,
            name: outlineDmc.name,
            hex: outlineHex,
            count: 1,
          });
        }
      } else if (cls === "region") {
        const rId = regionMap[y][x];
        const colorInfo = regionColors.get(`${rId}`);
        if (colorInfo) {
          gridRow.push({
            color: colorInfo.hex,
            dmcCode: colorInfo.dmcCode,
            dmcName: colorInfo.dmcName,
            stitchType: "cross",
          });
        } else {
          // Fallback: white
          gridRow.push({
            color: whiteHex,
            dmcCode: whiteDmc.code,
            dmcName: whiteDmc.name,
            stitchType: "cross",
          });
        }

        const actualColor = colorInfo || { dmcCode: whiteDmc.code, dmcName: whiteDmc.name, hex: whiteHex };
        const key = actualColor.dmcCode;
        if (dmcCountMap.has(key)) {
          dmcCountMap.get(key)!.count++;
        } else {
          dmcCountMap.set(key, {
            code: actualColor.dmcCode,
            name: actualColor.dmcName,
            hex: actualColor.hex,
            count: 1,
          });
        }
      } else {
        // Background → white cross stitch
        gridRow.push({
          color: whiteHex,
          dmcCode: whiteDmc.code,
          dmcName: whiteDmc.name,
          stitchType: "cross",
        });

        const key = whiteDmc.code;
        if (dmcCountMap.has(key)) {
          dmcCountMap.get(key)!.count++;
        } else {
          dmcCountMap.set(key, {
            code: whiteDmc.code,
            name: whiteDmc.name,
            hex: whiteHex,
            count: 1,
          });
        }
      }
    }
    grid.push(gridRow);
  }

  return { grid, dmcCountMap };
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Convert a line art image buffer to an embroidery stitch grid.
 *
 * Full pipeline: resize → classify → contour trace → simplify → fill → stitch map.
 *
 * @param imageBuffer - Raw PNG/JPEG/WebP image data
 * @param options - Pipeline configuration options
 * @returns PatternResult with stitchType per cell, DMC palette, and symbols
 */
export async function lineArtToPattern(
  imageBuffer: Buffer,
  options: LineArtPipelineOptions = {},
): Promise<PatternResult> {
  const {
    gridSize = DEFAULT_GRID_SIZE,
    outlineThreshold = DEFAULT_OUTLINE_THRESHOLD,
    backgroundThreshold = DEFAULT_BACKGROUND_THRESHOLD,
    outlineDmcCode = DEFAULT_OUTLINE_DMC,
  } = options;

  // Validate grid size (any reasonable size, default 100)
  const size = gridSize > 0 && gridSize <= 500 ? gridSize : DEFAULT_GRID_SIZE;

  // Step 1: Resize to target grid dimensions using nearest-neighbor
  const { data } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      kernel: sharp.kernel.nearest,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rawPixels = new Uint8ClampedArray(data);

  // Step 2: Classify every pixel as outline, background, or region
  const pixelClass: PixelClass[][] = Array.from({ length: size }, () => Array(size).fill("background" as PixelClass));
  const outlineMask: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const r = rawPixels[idx];
      const g = rawPixels[idx + 1];
      const b = rawPixels[idx + 2];

      const cls = classifyPixel(r, g, b, outlineThreshold, backgroundThreshold);
      pixelClass[y][x] = cls;
      outlineMask[y][x] = cls === "outline";
    }
  }

  // Step 3: Contour tracing — group connected outline pixels
  const contours = traceContours(outlineMask, size);

  // Step 4: Path simplification — convert contours to a set of outline cells
  const outlineCells = simplifyPaths(contours);

  // Step 5: Region filling — flood-fill each closed region
  const { regionColors, regionMap } = fillRegions(pixelClass, rawPixels, size);

  // Step 6: Stitch mapping — build the final grid
  const { grid, dmcCountMap } = mapToStitchGrid(
    pixelClass, outlineCells, regionColors, regionMap, size, outlineDmcCode,
  );

  // Build sorted DMC usage array with symbols
  const dmcColors: DmcUsage[] = Array.from(dmcCountMap.values())
    .sort((a, b) => b.count - a.count)
    .map((c, i) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      count: c.count,
      symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
    }));

  return {
    grid,
    gridSize: size,
    stitchCount: size * size,
    dmcColors,
  };
}

// ─── Exported Helpers for Testing ─────────────────────────────────────────────

export {
  classifyPixel,
  traceContours,
  simplifyPaths,
  fillRegions,
  mapToStitchGrid,
};
