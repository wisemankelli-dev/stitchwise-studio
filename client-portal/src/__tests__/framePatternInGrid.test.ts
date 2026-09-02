/**
 * Tests for Designer auto-frame helper `framePatternInGrid` (owner bug report,
 * freeze lifted for grid framing on generate/import only).
 *
 * Owner-reported bug: generated/imported patterns are cut off at the grid edges
 * because the converter fills the entire grid edge-to-edge with the image, so a
 * subject that fills the photo (e.g. the Blank Stocking) runs flush into the
 * pattern border (earlier stocking PDF: bbox rows 4-99, bottom touching row 99).
 *
 * Owner 09-03 contract (AI conversion must translate into a STITCHABLE pattern):
 * - Margin shrinks to ~2% of min(w,h) (was 5%) so the subject fills more canvas.
 * - Background cells are KEPT as a light fabric color (#ffffff) instead of being
 *   deleted to empty — no background-hollowing, no blank 73%-of-canvas gaps.
 * - The framed region is fully populated: every sampled cell is a stitch (the
 *   source background maps to #ffffff), so the chart reads without holes.
 *
 * Covers:
 * 1. Subject touching the bottom edge → scaled/centered with ≥ M margin on all sides
 * 2. Already-margined (sparse) grid → unchanged (byte-identical maps)
 * 3. Background detection (border majority) + bg pockets kept as #ffffff
 * 4. Fractional/stitch-type keys remap correctly through the resample
 * 5. Fully-empty / background-only grids → unchanged (guards)
 * 6. Non-square grids
 * 7. Square AI art → taller canvas (stocking) regression + dense coverage
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

/** Content bbox of a result grid — ignores the light-fabric background (#ffffff)
 *  so the bbox measures the SUBJECT, not the fully populated framed region. */
function bboxOf(grid: Record<string, string>) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  for (const key of Object.keys(grid)) {
    const color = grid[key];
    // Background keeps its #ffffff key — skip it; measure only the subject.
    if (!color || color === WHITE) continue;
    const [r, c] = key.split(',').map(Number);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  if (maxR < 0) return { minR: -1, maxR: -1, minC: -1, maxC: -1 };
  return { minR, maxR, minC, maxC };
}

describe('framePatternInGrid', () => {
  it('scales + centers a subject touching the bottom edge with ≥ M margin on all sides', () => {
    // Blank-Stocking-like case: subject bbox rows 4-99 (bottom touches row 99),
    // cols 20-80, white paper background everywhere else (fully populated).
    const grid = populatedGrid(100, 100, 4, 99, 20, 80);
    const { grid: out, stitchTypes, cellFractions } = framePatternInGrid(grid, {}, {}, 100, 100);

    const M = 2; // max(2, round(0.02 × min(100,100)))
    const { minR, maxR, minC, maxC } = bboxOf(out);

    // ≥ M margin on all four sides
    expect(minR).toBeGreaterThanOrEqual(M);
    expect(99 - maxR).toBeGreaterThanOrEqual(M);
    expect(minC).toBeGreaterThanOrEqual(M);
    expect(99 - maxC).toBeGreaterThanOrEqual(M);

    // Expected geometry: scale = min(96/61, 96/96, 1) = 1,
    // scaled 61×96 → 61×96, centered → rows 2-97, cols 19-79.
    expect(minR).toBe(2);
    expect(maxR).toBe(97);
    expect(minC).toBe(19);
    expect(maxC).toBe(79);

    // The framed region is fully populated (every sampled cell is a stitch):
    // subject 61×96 = 5856 cells. No background-hollowing (owner 09-03).
    expect(Object.keys(out)).toHaveLength(61 * 96);
    expect(Object.values(out).every((c) => c === RED)).toBe(true);
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

  it('detects the background from the border majority and keeps it as light fabric', () => {
    // Fully populated: white everywhere, red subject rows 4-60 × cols 20-70
    // (touches the top edge). Border majority is white → background.
    const grid = populatedGrid(100, 100, 4, 60, 20, 70);
    const out = framePatternInGrid(grid, {}, {}, 100, 100);

    // scale = min(96/51, 96/57, 1) = 1 → 51×57 at offset (24, 21).
    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    expect(minC).toBe(24);
    expect(maxC).toBe(74);
    expect(minR).toBe(21);
    expect(maxR).toBe(77);

    // The framed region (51×57) is fully populated — no holes.
    expect(Object.keys(out.grid)).toHaveLength(51 * 57);
    expect(Object.values(out.grid).every((c) => c === RED)).toBe(true);
  });

  it('keeps background-colored pockets INSIDE the subject as #ffffff (no hollowing)', () => {
    // Red subject rows 20-79 × cols 20-79, with a 10×10 WHITE "hole" pocket in
    // the middle (rows 50-59 × cols 50-59) — like the white gaps between
    // shapes in real AI art. Old code dropped those cells → empty holes.
    const grid: Record<string, string> = {};
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const inHole = y >= 50 && y <= 59 && x >= 50 && x <= 59;
        grid[`${y},${x}`] =
          inHole || y < 20 || y > 79 || x < 20 || x > 79 ? WHITE : RED;
      }
    }
    const out = framePatternInGrid(grid, {}, {}, 100, 100);

    // scale = min(96/60, 96/60, 1) = 1 → 60×60 framed at offset (20,20).
    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    expect(minR).toBe(20);
    expect(maxR).toBe(79);
    expect(minC).toBe(20);
    expect(maxC).toBe(79);

    // The framed region is FULLY populated: every cell is a stitch.
    // The background pocket became #ffffff (light fabric), NOT dropped.
    expect(Object.keys(out.grid)).toHaveLength(60 * 60);
    const whiteCells = Object.values(out.grid).filter((c) => c === WHITE).length;
    const redCells = Object.values(out.grid).filter((c) => c === RED).length;
    expect(whiteCells).toBe(10 * 10);
    expect(redCells).toBe(60 * 60 - 10 * 10);
    // The pocket cells are at the SAME relative position (scale 1, offset 20).
    expect(out.grid['50,50']).toBe(WHITE);
    expect(out.grid['59,59']).toBe(WHITE);
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
    // 150×100 grid; M = max(2, round(0.02 × 100)) = 2.
    // Subject (90 wide × 96 tall) touches the bottom edge.
    const grid = populatedGrid(150, 100, 4, 99, 30, 119);
    const out = framePatternInGrid(grid, {}, {}, 150, 100);

    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    expect(minR).toBeGreaterThanOrEqual(2);
    expect(99 - maxR).toBeGreaterThanOrEqual(2);
    expect(minC).toBeGreaterThanOrEqual(2);
    expect(149 - maxC).toBeGreaterThanOrEqual(2);
    // scale = min(146/90, 96/96, 1) = 1 → 90×96 → centered at (30, 2)
    expect(minR).toBe(2);
    expect(maxR).toBe(97);
    expect(minC).toBe(30);
    expect(maxC).toBe(119);
    // Framed region fully populated (90×96), no hollowed holes.
    expect(Object.keys(out.grid)).toHaveLength(90 * 96);
  });

  it('frames square AI art into a taller canvas WITHOUT cutting the right side (238×238 → 154×238 stocking)', () => {
    // AI generation returns a SQUARE grid (gridSize × gridSize = 238×238) for the
    // 154×238 stocking canvas. Owner bug 08-17: "New design was cut in half" —
    // the framing pass read the art as if it were 154 wide, so columns 154–237 of
    // the art were never seen and the leftover slice was stretched to fill.
    // Regression guard: with the old code this produced rows 15–222 (208 tall,
    // subject squashed/stretched) — now the FULL subject is centered at 148×148.
    const grid = populatedGrid(238, 238, 12, 225, 12, 225); // white bg + red subject
    const out = framePatternInGrid(grid, {}, {}, 154, 238, 238, 238);

    const { minR, maxR, minC, maxC } = bboxOf(out.grid);
    // M = max(2, round(0.02 × min(154, 238))) = 3; scale = min(148/214, 232/214, 1)
    // ≈ 0.6916 → 148×148 → centered → rows 45-192, cols 3-150.
    expect(minC).toBe(3);
    expect(maxC).toBe(150);
    expect(minR).toBe(45);
    expect(maxR).toBe(192);
    // The subject kept its square aspect: width == height == 148.
    expect(maxC - minC + 1).toBe(148);
    expect(maxR - minR + 1).toBe(148);
    // The framed region is fully populated (148×148 = 21904 — no hollowing).
    expect(Object.keys(out.grid)).toHaveLength(148 * 148);
    // Shrinking the margin from 5% to 2% pushes subject coverage of the whole
    // canvas from ~52% (138×138) to ~60% (148×148) — the owner's dense-coverage
    // bar (≥60% on preset canvases, 09-03).
    const subjectCells = Object.values(out.grid).filter((c) => c !== WHITE).length;
    expect(subjectCells / (154 * 238)).toBeGreaterThanOrEqual(0.59);
    // Nothing lands in the right strip that the old bug silently dropped.
    expect(maxC).toBeLessThanOrEqual(153);
  });
});