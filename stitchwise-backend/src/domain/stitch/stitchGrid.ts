/**
 * Stitch Grid Utilities — Pure functions for manipulating StitchGrid data.
 *
 * All functions are immutable by default — they return new grid instances
 * rather than mutating the input. The exception is `cloneGrid` which is
 * an explicit deep copy.
 */

import type { StitchCell, StitchGrid } from "./types";
import { DMC_COLORS } from "./dmcColors";

// ─── Creation ──────────────────────────────────────────────────────────────

/**
 * Create an empty stitch grid filled with a default color.
 *
 * @param width - Number of columns
 * @param height - Number of rows
 * @param fillColor - Hex color string for each cell (default: white "#ffffff")
 * @returns A new StitchGrid with all cells set to fillColor
 */
export function createEmptyGrid(
  width: number,
  height: number,
  fillColor: string = "#ffffff",
): StitchGrid {
  const grid: StitchGrid = [];
  for (let row = 0; row < height; row++) {
    const gridRow: StitchCell[] = [];
    for (let col = 0; col < width; col++) {
      gridRow.push({ color: fillColor });
    }
    grid.push(gridRow);
  }
  return grid;
}

// ─── Dimensions ─────────────────────────────────────────────────────────────

/**
 * Get the width and height of a stitch grid.
 *
 * @returns { width, height } — number of columns, number of rows
 */
export function getGridDimensions(grid: StitchGrid): { width: number; height: number } {
  const height = grid.length;
  const width = height > 0 ? (grid[0]?.length ?? 0) : 0;
  return { width, height };
}

// ─── Color Validation ───────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Check whether a string is a valid 6-digit hex color (e.g. "#ff0000").
 */
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_RE.test(color);
}

const DMC_CODE_SET = new Set(DMC_COLORS.map(c => c.code));

/**
 * Check whether a DMC code is present in the canonical DMC color palette.
 */
export function isValidDmcCode(code: string): boolean {
  return DMC_CODE_SET.has(code);
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate a stitch grid for structural correctness.
 *
 * Checks:
 * - Non-empty (at least 1 row, 1 column)
 * - Rectangular (all rows have the same length)
 * - All cells have valid hex colors
 * - All DMC codes (if present) are valid
 *
 * @returns { valid: boolean, errors: string[] }
 */
export function validateGrid(grid: StitchGrid): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!grid || grid.length === 0) {
    errors.push("Grid is empty: no rows");
    return { valid: false, errors };
  }

  if (!grid[0] || grid[0].length === 0) {
    errors.push("Grid is empty: first row has no cells");
    return { valid: false, errors };
  }

  const width = grid[0].length;

  // Check rectangular
  for (let row = 0; row < grid.length; row++) {
    if (!grid[row]) {
      errors.push(`Row ${row} is undefined`);
    } else if (grid[row].length !== width) {
      errors.push(`Row ${row} has ${grid[row].length} cells, expected ${width}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check cell validity
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];
      if (!cell || typeof cell !== "object") {
        errors.push(`Cell at (${row},${col}) is not an object`);
      } else if (!cell.color || !isValidHexColor(cell.color)) {
        errors.push(`Cell at (${row},${col}) has invalid hex color: "${cell.color}"`);
      }
      if (cell?.dmcCode && !isValidDmcCode(cell.dmcCode)) {
        errors.push(`Cell at (${row},${col}) has invalid DMC code: "${cell.dmcCode}"`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Clone ─────────────────────────────────────────────────────────────────

/**
 * Deep-clone a stitch grid, ensuring modifications to the clone
 * do not affect the original.
 */
export function cloneGrid(grid: StitchGrid): StitchGrid {
  return grid.map(row =>
    row.map(cell => ({ ...cell }))
  );
}

// ─── Transformations ────────────────────────────────────────────────────────

/**
 * Flip the grid horizontally (mirror across the vertical axis).
 *
 *   ABC      CBA
 *   DEF  →   FED
 *   GHI      IHG
 */
export function flipGridHorizontal(grid: StitchGrid): StitchGrid {
  return grid.map(row => [...row].reverse());
}

/**
 * Flip the grid vertically (mirror across the horizontal axis).
 *
 *   ABC      GHI
 *   DEF  →   DEF
 *   GHI      ABC
 */
export function flipGridVertical(grid: StitchGrid): StitchGrid {
  return [...grid].reverse().map(row => [...row]);
}

/**
 * Rotate the grid 90 degrees clockwise.
 *
 *   ABC      GDA
 *   DEF  →   HEB
 *   GHI      IFC
 */
export function rotateGrid90(grid: StitchGrid): StitchGrid {
  const { width, height } = getGridDimensions(grid);
  const result: StitchGrid = [];
  for (let col = 0; col < width; col++) {
    const newRow: StitchCell[] = [];
    for (let row = height - 1; row >= 0; row--) {
      newRow.push({ ...grid[row][col] });
    }
    result.push(newRow);
  }
  return result;
}

/**
 * Rotate the grid 180 degrees.
 */
export function rotateGrid180(grid: StitchGrid): StitchGrid {
  return rotateGrid90(rotateGrid90(grid));
}

/**
 * Rotate the grid 270 degrees clockwise (90 degrees counter-clockwise).
 */
export function rotateGrid270(grid: StitchGrid): StitchGrid {
  return rotateGrid90(rotateGrid180(grid));
}

// ─── Statistics ─────────────────────────────────────────────────────────────

/**
 * Count stitches per color in the grid.
 *
 * @returns Map of hex color → number of stitches
 */
export function getColorStats(grid: StitchGrid): Map<string, number> {
  const stats = new Map<string, number>();
  for (const row of grid) {
    for (const cell of row) {
      const color = cell.color.toLowerCase();
      stats.set(color, (stats.get(color) ?? 0) + 1);
    }
  }
  return stats;
}