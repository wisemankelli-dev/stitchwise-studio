/**
 * Deterministic content recentering for AI-converted stitch grids.
 *
 * Gemini image variance sometimes draws the subject off-center in the canvas;
 * the pixel→grid conversion carries the offset through, so the pattern ends up
 * with a white band on one side (owner 09-15: snowflake ornament "is not
 * centered and left white edge"). This module shifts the whole grid so the
 * subject's content bounding box centers on the canvas — with an optional
 * deterministic margin band (frame canvases) that the shift may never push
 * content into.
 *
 * Pure and side-effect free: the input grid is never mutated; a new grid is
 * returned when a shift is needed, and the same reference when already
 * centered (idempotent). Fixes apply to NEW generations only — saved patterns
 * keep their baked grids.
 */
import type { StitchCell, StitchGrid } from "./types";

/** Background fabric cell — matches the converter's white (DMC 520) merge. */
const BACKGROUND_CELL: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };

/**
 * True when a cell reads as blank fabric background.
 *
 * Same rule as qualityGate's background test (and the converter's isLightFabric
 * halo): exact white, near-white, or light + low-saturation tones count as
 * background so the subject's true bbox is not inflated by the AI art's halo.
 */
export function isBackgroundCell(cell: StitchCell | undefined): boolean {
  const h = (cell?.color || "").toLowerCase();
  if (h === "#ffffff") return true;
  if (h.length !== 7) return true; // missing/blank cells read as background
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (r > 245 && g > 245 && b > 245) || (max >= 190 && (max - min) / max <= 0.2);
}

/** Content bounding box in grid coordinates (inclusive). */
interface ContentBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function contentBox(grid: StitchGrid): ContentBox | null {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let r = 0; r < height; r++) {
    const row = grid[r];
    for (let c = 0; c < width; c++) {
      if (isBackgroundCell(row?.[c])) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  return bottom < top ? null : { top, bottom, left, right };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Deterministic content recenter.
 *
 * Computes the content bounding box (any non-background cell), then shifts the
 * whole grid so the box's center lands on the canvas center. Skips the shift
 * when content is already centered within ~1 cell (idempotent, preserves any
 * existing symmetric margin). Shifting reallocates cells: a fresh all-white
 * grid is filled by copying old cells at their shifted positions; anything
 * that would land outside the canvas is clipped (defensive — a centered bbox
 * already fits).
 *
 * @param grid - Stitch grid to recenter (never mutated).
 * @param opts.frameMargin - Deterministic margin band in cells that the
 *   content must stay inside. Pass the band size for FRAME canvases
 *   (square/landscape frames get the visible margin); product shapes pass
 *   nothing (pure recentering, margins already symmetric when centered).
 * @returns The recentered grid, or the same reference when no shift is needed.
 */
export function recenterGrid(
  grid: StitchGrid,
  opts?: { frameMargin?: number },
): StitchGrid {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return grid;
  const box = contentBox(grid);
  if (!box) return grid; // all background — nothing to recenter

  const contentCenterRow = (box.top + box.bottom) / 2;
  const contentCenterCol = (box.left + box.right) / 2;
  const canvasCenterRow = (height - 1) / 2;
  const canvasCenterCol = (width - 1) / 2;
  let shiftRow = Math.round(canvasCenterRow - contentCenterRow);
  let shiftCol = Math.round(canvasCenterCol - contentCenterCol);

  // Idempotent: already centered within ~1 cell → return unchanged.
  if (Math.abs(shiftRow) <= 1 && Math.abs(shiftCol) <= 1) return grid;

  // Frame canvases: the deterministic margin band is sacred — the subject's
  // whole bbox must stay inside [band, dim-1-band] on every side. Clamp the
  // desired shift to the available room (the desired shift already centers
  // when both sides have room). If the content is wider than the band allows,
  // fall back to the canvas bounds so the recenter never pushes it out.
  const band = opts?.frameMargin && opts.frameMargin > 0 ? Math.round(opts.frameMargin) : 0;
  if (band > 0) {
    const loRow = band - box.top;
    const hiRow = height - 1 - band - box.bottom;
    const loCol = band - box.left;
    const hiCol = width - 1 - band - box.right;
    shiftRow = loRow <= hiRow ? clamp(shiftRow, loRow, hiRow) : clamp(shiftRow, -box.top, height - 1 - box.bottom);
    shiftCol = loCol <= hiCol ? clamp(shiftCol, loCol, hiCol) : clamp(shiftCol, -box.left, width - 1 - box.right);
    if (shiftRow === 0 && shiftCol === 0) return grid;
  }

  // Reallocate: fresh all-white grid, copy old cells at shifted positions.
  const out: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...BACKGROUND_CELL }) as StitchCell),
  );
  for (let r = 0; r < height; r++) {
    const row = grid[r];
    for (let c = 0; c < width; c++) {
      const src = row?.[c];
      if (!src) continue;
      const nr = r + shiftRow;
      const nc = c + shiftCol;
      if (nr < 0 || nr >= height || nc < 0 || nc >= width) continue; // defensive clip
      out[nr][nc] = src; // content (and any interior background) moves 1:1
    }
  }
  return out;
}