/**
 * Geometric shape-mask enforcement for AI product shapes.
 *
 * Owner-conclusive (09-15 pillow repro): prompting "a heart-shaped pillow" with
 * shape=pillow returns a FULL-CANVAS scene — the pillow silhouette is NOT
 * enforced at the grid level, so the heart bleeds to the canvas edges and the
 * mask is over-filled. Identical root cause to the stocking snowflake-scene
 * defect: the prompt alone can't guarantee Gemini respects the shape outline.
 *
 * This module enforces the silhouette geometrically, AFTER the content has been
 * recentered (recenterGrid) and BEFORE the quality gate:
 *   1. Build the silhouette mask for the shape (stocking / ornament / pillow).
 *   2. Clear every cell OUTSIDE the silhouette to background.
 *   3. Fill: BFS-flood from the grid exterior; any interior background cell NOT
 *      reachable from outside (enclosed between subject content and the
 *      silhouette boundary) gets filled with the nearest non-background color,
 *      giving a coherent solid subject with true cut-out edges.
 *
 * Pure and side-effect free (returns a new grid; never mutates the input).
 * Fixes apply to NEW generations only — saved patterns keep their baked grids.
 */
import type { StitchCell, StitchGrid } from "./types";
import { isBackgroundCell } from "./recenterGrid";

/** Background fabric cell — matches the converter's white (DMC 520) merge. */
const BACKGROUND_CELL: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };

/** Product shapes the mask applies to (NOT square/rect/frame). */
export type ProductMaskShape = "stocking" | "ornament" | "pillow";

// ─── Stocking silhouette (ported from client src/data/guides.ts) ───────────
/**
 * Owner's recovered Blank Stocking silhouette, 49-point contour (toe at
 * bottom-right), normalized PER AXIS over the shape's own bbox. x was divided
 * by bbox WIDTH (67), y by bbox HEIGHT (96) — so x must be multiplied by
 * STOCKING_GUIDE_ASPECT (67/96) when mapping into a stitch box.
 */
const STOCKING_GUIDE: [number, number][] = [
  [0.0758, 0], [0.1061, 0.0421], [0.5909, 0.0842], [0.7121, 0.1263],
  [0.7121, 0.1684], [0.7121, 0.2105], [0.7121, 0.2526], [0.697, 0.2947],
  [0.6818, 0.3368], [0.6818, 0.3789], [0.6818, 0.4211], [0.6667, 0.4632],
  [0.6667, 0.5053], [0.6667, 0.5474], [0.6667, 0.5895], [0.6667, 0.6316],
  [0.697, 0.6737], [0.7273, 0.7158], [0.803, 0.7579], [0.8939, 0.8],
  [0.9394, 0.8421], [0.9545, 0.8526], [0.9697, 0.8658], [0.9818, 0.8816],
  [0.9909, 0.8987], [0.9939, 0.9105], [0.9909, 0.9211], [0.9818, 0.9342],
  [0.9667, 0.9474], [0.947, 0.9605], [0.9242, 0.9737], [0.9, 0.9868],
  [0.84, 0.9961], [0.76, 1], [0.66, 0.9974], [0.57, 0.9895],
  [0.48, 0.9789], [0.39, 0.9684], [0.31, 0.9605], [0.2879, 0.9579],
  [0.1364, 0.9158], [0.0758, 0.8737],
  [0.0606, 0.8316], [0.0606, 0.7895], [0.0758, 0.7474], [0.0758, 0.7053],
  [0.0909, 0.6632], [0.0909, 0.6211], [0.1061, 0.5789], [0.1061, 0.5368],
  [0.0909, 0.4947], [0.0909, 0.4526], [0.0909, 0.4105], [0.0909, 0.3684],
  [0.0758, 0.3263], [0.0606, 0.2842], [0.0606, 0.2421], [0.0606, 0.2],
  [0.0455, 0.1579], [0.0455, 0.1158], [0.0303, 0.0737], [0.0152, 0.0316],
  [0.0303, 0],
];
const STOCKING_GUIDE_ASPECT = 67 / 96;

/** Map the stocking contour into stitch coordinates (aspect-correct, ~14% margin). */
function stockingPointsInBox(colW: number, rowH: number): [number, number][] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of STOCKING_GUIDE) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const bboxW = (maxX - minX) * STOCKING_GUIDE_ASPECT;
  const bboxH = maxY - minY;
  const scale = Math.min(colW / bboxW, rowH / bboxH) * 0.86;
  const scaledW = bboxW * scale;
  const scaledH = bboxH * scale;
  const dx = (colW - scaledW) / 2 - minX * STOCKING_GUIDE_ASPECT * scale;
  const dy = (rowH - scaledH) / 2 - minY * scale;
  return STOCKING_GUIDE.map(([px, py]) => [
    px * STOCKING_GUIDE_ASPECT * scale + dx,
    py * scale + dy,
  ]);
}

/** Ray-casting point-in-polygon test on a cell's center. */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ─── Silhouette construction ────────────────────────────────────────────────
/** Deterministic rim inset so the silhouette reads as a cut-out with a thin
 *  fabric edge (never touches the absolute canvas edge). */
function rimInset(w: number, h: number): number {
  return Math.max(1, Math.round(0.03 * Math.min(w, h)));
}

/** Build a boolean silhouette mask (true = inside the shape). */
export function buildProductSilhouette(
  shape: ProductMaskShape,
  width: number,
  height: number,
): boolean[][] {
  const inset = rimInset(width, height);
  const mask: boolean[][] = Array.from({ length: height }, () => Array(width).fill(false));

  if (shape === "ornament") {
    // Circle inscribed in the inset box.
    const cx = (width - 1) / 2;
    const cy = (height - 1) / 2;
    const r = Math.min(width, height) / 2 - inset;
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        const dx = c + 0.5 - cx;
        const dy = rw + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) mask[rw][c] = true;
      }
    }
  } else if (shape === "pillow") {
    // Rounded rectangle: corner radius ~13% of the min side.
    const r = Math.round(0.13 * Math.min(width, height));
    const x0 = inset, x1 = width - 1 - inset;
    const y0 = inset, y1 = height - 1 - inset;
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        const cx = c + 0.5, cy = rw + 0.5;
        // Clamp to the inner rectangle edge, then test corner quarter-circle.
        const nx = Math.max(x0 + r, Math.min(cx, x1 - r));
        const ny = Math.max(y0 + r, Math.min(cy, y1 - r));
        const ddx = cx - nx, ddy = cy - ny;
        const inRoundedRect =
          cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 &&
          ddx * ddx + ddy * ddy <= r * r;
        mask[rw][c] = inRoundedRect;
      }
    }
  } else if (shape === "stocking") {
    // 49-point silhouette, aspect-correct, ~14% margin (already inset).
    const points = stockingPointsInBox(width - 2 * inset, height - 2 * inset);
    const shifted = points.map(([x, y]) => [x + inset, y + inset] as [number, number]);
    for (let rw = 0; rw < height; rw++) {
      for (let c = 0; c < width; c++) {
        if (pointInPolygon(c + 0.5, rw + 0.5, shifted)) mask[rw][c] = true;
      }
    }
  }
  return mask;
}

// ─── Mask application ───────────────────────────────────────────────────────
/**
 * Enforce a geometric product-shape silhouette on an AI-converted grid.
 *
 * 1. Build the shape silhouette (stocking / circle / rounded-rect), inset by a
 *    deterministic rim margin.
 * 2. Clear every cell OUTSIDE the silhouette to background.
 * 3. BFS-flood from the grid exterior through background cells; any interior
 *    background cell NOT reachable from outside (enclosed between subject
 *    content and the silhouette boundary) is filled with the nearest
 *    non-background color — a coherent solid subject with true cut-out edges.
 *
 * Idempotent: running twice produces the same grid (outside already cleared,
 * interior holes already filled, nearest-color source unchanged).
 */
export function applyProductShapeMask(
  grid: StitchGrid,
  shape: ProductMaskShape,
  targetW: number,
  targetH: number,
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const silhouette = buildProductSilhouette(shape, targetW || width, targetH || height);

  // Step 2: clear everything outside the silhouette; snapshot in-shape content.
  const inside: (StitchCell | null)[][] = Array.from({ length: height }, () => Array(width).fill(null));
  const out: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...BACKGROUND_CELL }) as StitchCell),
  );
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (silhouette[r]?.[c]) {
        const src = grid[r]?.[c];
        if (src && !isBackgroundCell(src)) {
          inside[r][c] = src;
          out[r][c] = src;
        }
      }
    }
  }

  // Step 3: BFS from the exterior through background cells (4-connected).
  const reachable = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: Array<[number, number]> = [];
  const push = (r: number, c: number) => {
    if (r < 0 || r >= height || c < 0 || c >= width) return;
    if (reachable[r][c]) return;
    if (out[r]?.[c] && !isBackgroundCell(out[r][c])) return; // only flood background
    reachable[r][c] = true;
    queue.push([r, c]);
  };
  for (let c = 0; c < width; c++) { push(0, c); push(height - 1, c); }
  for (let r = 0; r < height; r++) { push(r, 0); push(r, width - 1); }
  while (queue.length) {
    const [r, c] = queue.shift()!;
    push(r - 1, c); push(r + 1, c); push(r, c - 1); push(r, c + 1);
  }

  // Fill any enclosed interior background cell with the nearest non-bg color.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (silhouette[r]?.[c] && isBackgroundCell(out[r][c]) && !reachable[r][c]) {
        const near = nearestNonBackground(inside, r, c);
        if (near) out[r][c] = near;
      }
    }
  }
  return out;
}

/** BFS outward from (r,c) to the nearest non-background in-shape cell. */
function nearestNonBackground(
  inside: (StitchCell | null)[][],
  r0: number,
  c0: number,
): StitchCell | null {
  const height = inside.length;
  const width = inside[0]?.length ?? 0;
  const seen = Array.from({ length: height }, () => Array(width).fill(false));
  const queue: Array<[number, number, number]> = [[r0, c0, 0]];
  seen[r0][c0] = true;
  while (queue.length) {
    const [r, c, d] = queue.shift()!;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width || seen[nr][nc]) continue;
      seen[nr][nc] = true;
      const cell = inside[nr][nc];
      if (cell) return cell;
      queue.push([nr, nc, d + 1]);
    }
  }
  return null;
}
