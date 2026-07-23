/**
 * Editor Operations — Pure grid mutation functions for the Pattern Editor.
 *
 * ALL functions are immutable — they return new grid/palette instances
 * without modifying the originals. Tests verify immutability.
 */

import type { StitchCell, StitchGrid, DmcUsage } from "./types";
import { CROSS_STITCH_SYMBOLS } from "./types";
import { cloneGrid, getColorStats } from "./stitchGrid";
import { closestDmcColor, rgbToHex } from "./dmcColors";
import { renderTextToCells } from "./pixelFont";

// ─── Paint ───────────────────────────────────────────────────────────────────

export interface PaintCell {
  row: number;
  col: number;
  color: string;
  dmcCode?: string;
  dmcName?: string;
}

/**
 * Paint cells at specific coordinates. Does NOT mutate the original grid.
 * Returns updated grid and recalculated palette.
 */
export function paintCells(
  grid: StitchGrid,
  cells: PaintCell[],
): { grid: StitchGrid; palette: DmcUsage[] } {
  const newGrid = cloneGrid(grid);

  for (const { row, col, color, dmcCode, dmcName } of cells) {
    if (row >= 0 && row < newGrid.length && col >= 0 && col < newGrid[row].length) {
      newGrid[row][col] = { color, dmcCode, dmcName };
    }
  }

  return { grid: newGrid, palette: computePalette(newGrid) };
}

// ─── Erase ───────────────────────────────────────────────────────────────────

/**
 * Erase cells (set to white). Does NOT mutate original grid.
 */
export function eraseCells(
  grid: StitchGrid,
  cells: Array<{ row: number; col: number }>,
): { grid: StitchGrid; palette: DmcUsage[] } {
  const newGrid = cloneGrid(grid);

  for (const { row, col } of cells) {
    if (row >= 0 && row < newGrid.length && col >= 0 && col < newGrid[row].length) {
      newGrid[row][col] = { color: "#ffffff" };
    }
  }

  return { grid: newGrid, palette: computePalette(newGrid) };
}

// ─── Clone Region ────────────────────────────────────────────────────────────

export interface CloneRegionParams {
  sourceRow: number;
  sourceCol: number;
  width: number;
  height: number;
  targetRow: number;
  targetCol: number;
}

/**
 * Clone a rectangular region from source to target position.
 * Does NOT mutate the original grid.
 */
export function cloneRegion(
  grid: StitchGrid,
  params: CloneRegionParams,
): { grid: StitchGrid; palette: DmcUsage[] } {
  const newGrid = cloneGrid(grid);
  const { sourceRow, sourceCol, width, height, targetRow, targetCol } = params;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const sr = sourceRow + r;
      const sc = sourceCol + c;
      const tr = targetRow + r;
      const tc = targetCol + c;

      if (
        sr >= 0 && sr < grid.length && sc >= 0 && sc < grid[sr].length &&
        tr >= 0 && tr < newGrid.length && tc >= 0 && tc < newGrid[tr].length
      ) {
        newGrid[tr][tc] = { ...grid[sr][sc] };
      }
    }
  }

  return { grid: newGrid, palette: computePalette(newGrid) };
}

// ─── Eyedropper ──────────────────────────────────────────────────────────────

/**
 * Get the color at a specific cell coordinate.
 */
export function eyedropper(
  grid: StitchGrid,
  row: number,
  col: number,
): { color: string; dmcCode?: string; dmcName?: string } | null {
  if (row < 0 || row >= grid.length || col < 0 || col >= (grid[row]?.length ?? 0)) {
    return null;
  }
  const cell = grid[row][col];
  return { color: cell.color, dmcCode: cell.dmcCode, dmcName: cell.dmcName };
}

// ─── Fill ────────────────────────────────────────────────────────────────────

/**
 * Flood fill starting at (row, col) with the given color.
 * Only fills cells matching the original color at the start point.
 * Does NOT mutate the original grid.
 */
export function floodFill(
  grid: StitchGrid,
  row: number,
  col: number,
  color: string,
  dmcCode?: string,
  dmcName?: string,
): { grid: StitchGrid; palette: DmcUsage[] } {
  const newGrid = cloneGrid(grid);

  if (row < 0 || row >= grid.length || col < 0 || col >= (grid[row]?.length ?? 0)) {
    return { grid: newGrid, palette: computePalette(newGrid) };
  }

  const targetColor = grid[row][col].color;
  if (targetColor === color) {
    return { grid: newGrid, palette: computePalette(newGrid) };
  }

  const stack: Array<[number, number]> = [[row, col]];
  const visited = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    const k = key(r, c);

    if (visited.has(k)) continue;
    if (r < 0 || r >= newGrid.length || c < 0 || c >= newGrid[r].length) continue;
    if (newGrid[r][c].color !== targetColor) continue;

    visited.add(k);
    newGrid[r][c] = { color, dmcCode, dmcName };

    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }

  return { grid: newGrid, palette: computePalette(newGrid) };
}

// ─── Text ────────────────────────────────────────────────────────────────────

/**
 * Stamp text at a position using the 5×7 pixel font.
 * Does NOT mutate original grid.
 */
export function stampText(
  grid: StitchGrid,
  text: string,
  targetRow: number,
  targetCol: number,
  color: string,
  dmcCode?: string,
  dmcName?: string,
): { grid: StitchGrid; palette: DmcUsage[] } {
  const newGrid = cloneGrid(grid);
  const textGrid = renderTextToCells(text, color, dmcCode, dmcName);

  for (let r = 0; r < textGrid.length; r++) {
    for (let c = 0; c < textGrid[r].length; c++) {
      const tr = targetRow + r;
      const tc = targetCol + c;
      if (
        tr >= 0 && tr < newGrid.length &&
        tc >= 0 && tc < (newGrid[tr]?.length ?? 0)
      ) {
        const cell = textGrid[r][c];
        if (cell.color !== "#ffffff") {
          newGrid[tr][tc] = { ...cell };
        }
      }
    }
  }

  return { grid: newGrid, palette: computePalette(newGrid) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computePalette(grid: StitchGrid): DmcUsage[] {
  const stats = getColorStats(grid);
  // group by dmcCode when available, fall back to hex
  const dmcMap = new Map<string, DmcUsage>();

  for (const [hex, count] of stats) {
    if (hex === "#ffffff") continue; // skip white/background

    // try to find the dmcCode from any cell with this hex
    let dmcCode: string | undefined;
    let dmcName: string | undefined;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.color.toLowerCase() === hex && cell.dmcCode) {
          dmcCode = cell.dmcCode;
          dmcName = cell.dmcName;
          break;
        }
      }
      if (dmcCode) break;
    }

    const key = dmcCode ?? hex;
    const existing = dmcMap.get(key);
    if (existing) {
      existing.count += count;
    } else {
      dmcMap.set(key, { code: dmcCode ?? hex, name: dmcName ?? hex, hex, count });
    }
  }

  const sorted = Array.from(dmcMap.values()).sort((a, b) => b.count - a.count);
  return sorted.map((entry, i) => ({
    ...entry,
    symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
  }));
}
