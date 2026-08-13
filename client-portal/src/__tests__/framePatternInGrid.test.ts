/**
 * Tests for Designer auto-frame helper `framePatternInGrid` (owner bug report,
 * freeze lifted for grid framing on generate/import only).
 *
 * Owner-reported bug: generated/imported patterns are cut off at the grid edges
 * because the converter fills the entire grid edge-to-edge with the image, so a
 * subject that fills the photo (e.g. the Blank Stocking) runs flush into the
 * pattern border (earlier stocking PDF: bbox rows 4-99, bottom touching row 99).
 *
 * Covers:
 * 1. Subject touching the bottom edge → scaled/centered with ≥ M margin on all sides
 * 2. Already-margined (sparse) grid → unchanged (byte-identical maps)
 * 3. Background detection (border majority) with background cells dropped from result
 * 4. Fractional/stitch-type keys remap correctly through the resample
 * 5. Fully-empty / background-only grids → unchanged (guards)
 */
import { describe, it, expect } from 'vitest';
import { framePatternInGrid } from '../pages/Designer';

const WHITE = '#ffffff';
const RED = '#e11d48';
const BLUE = '#0284c7';

/** Build a fully-populated grid (image/AI path: every cell painted) with a
 *  white background and a red subject rectangle [rowTop..rowBottom]×[colLeft..colRight]. */
function populatedGrid(
  width: number,
  height: number,
  rowTop: number,
  rowBottom: number,
  colLeft: number,
  colRight: number,
): Record<string, string> {
  const grid: Record<string, string> = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[`${y},${x}`] =
        y >= rowTop && y <= rowBottom && x >= colLeft && x <= colRight ? RED : WHITE;
    }
  }
  return grid;
}

/** Content bbox of a result grid (cells present). */
function bboxOf(grid: Record<string, string>) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of Object.keys(grid)) {
    const [r, c] = key.split(',').map(Number);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  return { minR, maxR, minC, maxC };
}

describe('framePatternInGrid', () => {
  it('scales + centers a subject touching the bottom edge with ≥ M margin on all sides', () => {
    // Blank-Stocking-like case: subject bbox rows 4-99 (bottom touches row 99),
    // cols 20-80, white paper background everywhere else (fully populated).
    const grid = populatedGrid(100, 100, 4, 99, 20, 80);
    const { grid: out, stitchTypes, cellFractions } = framePatternInGrid(grid, {}, {}, 100, 100);

    const M = 5; // max(3, round(0.05 × min(100,100)))
    const { minR, maxR, minC, maxC } = bboxOf(out);

    // ≥ M margin on all four sides
    expect(minR).toBeGreaterThanOrEqual(M);
    expect(99 - maxR).toBeGreaterThanOrEqual(M);
    expect(minC).toBeGreaterThanOrEqual(M);
    expect(99 - maxC).toBeGreaterThanOrEqual(M);

    // Expected geometry: scale = min(90/61, 90/96, 1) = 0.9375,
    // scaled 61×96 → 57×90, centered → rows 5-94, cols 21-77.
    expect(minR).toBe(5);
    expect(maxR).toBe(94);
    expect(minC).toBe(21);
    expect(maxC).toBe(77);

    // Background (white) cells are omitted — empty fabric, not stitches.
    expect(Object.values(out).every((color) => color !== WHITE)).toBe(true);
    // Stitch types / fractions (empty inputs) come back empty.
    expect(Object.keys(stitchTypes)).toHaveLength(0);
    expect(Object.keys(cellFractions)).toHaveLength(0);
  });

  it('returns an already-margined sparse grid unchanged (byte-identical maps)', () => {
    // Sparse grid: red subject rows 30-69 × cols 30-69, white background cells
    // rows 6-93 × cols 6-93, and ≥ M fully-empty rows/cols around everything.
    const grid: Record<string, string> = {};
    for (let y = 6; y <= 93; y++) {
      for (let x = 6; x <= 93; x++) {
        grid[`${y},${x}`] =
          y >= 30 && y <= 69 && x >= 30 && x <= 69 ? RED : WHITE;
      }
    }
    const stitchTypes = { '50,50': 'back' };
    const cellFractions = { '50,50': 0.5 };

    const out = framePatternInGrid(grid, stitchTypes, cellFractions, 100, 100);

    // Byte-identical: same object references, unchanged content.
    expect(out.grid).toBe(grid);
    expect(out.stitchTypes).toBe(stitchTypes);
    expect(out.cellFractions).toBe(cellFractions);
    expect(out.grid).toEqual(grid);
  });

  it('detects the background from the border majority and drops background cells', () => {
    // Fully populated: white everywhere, red subject rows 4-60 × cols 20-70
    // (touches the top edge). Border majority is white → background.
    const grid = populatedGrid(100, 100, 4, 60, 20, 70);
    const out = framePatternInGrid(grid, {}, {}, 100, 100);

    // scale = min(90/51, 90/57, 1) = 1 → 51×57 at offset (24, 21).
    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    expect(minC).toBe(24);
    expect(maxC).toBe(74);
    expect(minR).toBe(21);
    expect(maxR).toBe(77);

    // All background-colored cells dropped from the result.
    expect(Object.values(out.grid).every((color) => color !== WHITE)).toBe(true);
    // Every original red cell survived the nearest-neighbor resample at scale 1.
    expect(Object.keys(out.grid)).toHaveLength(51 * 57);
  });

  it('remaps fractional and stitch-type keys through the resample', () => {
    const grid = populatedGrid(100, 100, 4, 99, 20, 80);
    // Mark every red subject cell with a stitch type + half-stitch fraction.
    const stitchTypes: Record<string, string> = {};
    const cellFractions: Record<string, number> = {};
    for (let y = 4; y <= 99; y++) {
      for (let x = 20; x <= 80; x++) {
        stitchTypes[`${y},${x}`] = 'back';
        cellFractions[`${y},${x}`] = 0.5;
      }
    }

    const out = framePatternInGrid(grid, stitchTypes, cellFractions, 100, 100);

    // Every content cell in the result keeps its stitch type and fraction.
    for (const key of Object.keys(out.grid)) {
      expect(out.stitchTypes[key]).toBe('back');
      expect(out.cellFractions[key]).toBe(0.5);
    }
    expect(Object.keys(out.stitchTypes)).toHaveLength(Object.keys(out.grid).length);
    expect(Object.keys(out.cellFractions)).toHaveLength(Object.keys(out.grid).length);
    // No background cells leak types/fractions.
    expect(Object.values(out.grid).every((color) => color !== WHITE)).toBe(true);
  });

  it('leaves a fully-empty grid unchanged', () => {
    const out = framePatternInGrid({}, {}, {}, 100, 100);
    expect(out.grid).toEqual({});
    expect(out.stitchTypes).toEqual({});
    expect(out.cellFractions).toEqual({});
  });

  it('leaves a background-only grid unchanged (no content to frame)', () => {
    const grid: Record<string, string> = {};
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) grid[`${y},${x}`] = WHITE;
    }
    const out = framePatternInGrid(grid, {}, {}, 100, 100);
    expect(out.grid).toBe(grid);
  });

  it('handles non-square grids with the margin scaled to min dimension', () => {
    // 150×100 grid; M = max(3, round(0.05 × 100)) = 5.
    // Subject (90 wide × 96 tall) touches the bottom edge.
    const grid = populatedGrid(150, 100, 4, 99, 30, 119);
    const out = framePatternInGrid(grid, {}, {}, 150, 100);

    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    expect(minR).toBeGreaterThanOrEqual(5);
    expect(99 - maxR).toBeGreaterThanOrEqual(5);
    expect(minC).toBeGreaterThanOrEqual(5);
    expect(149 - maxC).toBeGreaterThanOrEqual(5);
    // scale = min(140/90, 90/96, 1) = 0.9375 → 84×90 → centered at (33, 5)
    expect(minR).toBe(5);
    expect(maxR).toBe(94);
    expect(minC).toBe(33);
    expect(maxC).toBe(116);
    expect(Object.values(out.grid).every((color) => color !== WHITE)).toBe(true);
  });
});
