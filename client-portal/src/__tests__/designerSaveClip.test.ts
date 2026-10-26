/**
 * d1ee3f17 — save-time corner clip (close the manual-edit spill gap).
 *
 * clipGridToCircleCorners must mirror the backend's clipShapeEdge
 * (src/domain/stitch/productShapeMask.ts) TRUE-CORNER convention cell for
 * cell: a cell spans [c, c+1] × [rw, rw+1]; keep only when ALL FOUR true
 * corners are inside radius r = min(w,h)/2 − inset (inset = max(1,
 * round(0.03·min))), center (w−1)/2 / (h−1)/2; min-side > 60 = no-op.
 * Anchor geometry for the port: at 28×28 (r = 13, cx = cy = 13.5) row 1
 * keeps cols 10–16 and empties cols 9 and 17; row 0 is fully emptied;
 * row 13 empties its corner cells (max span keeps c 1..25).
 */
import { describe, it, expect } from 'vitest';
import { clipGridToCircleCorners } from '../pages/Designer';

type Cell = Parameters<typeof clipGridToCircleCorners>[0][number][number];

function make(w: number, h: number, fill = '#5d3c2e'): Cell[][] {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ color: fill }) as Cell),
  );
}

describe('clipGridToCircleCorners (save-time clipShapeEdge port)', () => {
  it('empties every row-0 cell on a 28×28 circle (true-corner rule)', () => {
    const clipped = clipGridToCircleCorners(make(28, 28));
    for (let c = 0; c < 28; c++) {
      expect(clipped[0][c]).toEqual({ color: '' });
    }
  });

  it('row 1 keeps cols 10–16 and empties cols 9 and 17 (anchor convention)', () => {
    const clipped = clipGridToCircleCorners(make(28, 28));
    for (let c = 0; c < 28; c++) {
      const kept = c >= 10 && c <= 16;
      expect(clipped[1][c]).toEqual(kept ? { color: '#5d3c2e' } : { color: '' });
    }
  });

  it('widest row (13) empties the corner cells and keeps the interior span', () => {
    const clipped = clipGridToCircleCorners(make(28, 28));
    // true-corner: c0 is 13.5 beyond center — outside; c1..25 inside; c26/27 out.
    expect(clipped[13][0]).toEqual({ color: '' });
    expect(clipped[13][26]).toEqual({ color: '' });
    expect(clipped[13][27]).toEqual({ color: '' });
    for (let c = 1; c <= 25; c++) {
      expect(clipped[13][c]).toEqual({ color: '#5d3c2e' });
    }
  });

  it('preserves cell payload (back-stitch dmcCode) on kept cells', () => {
    const grid = make(28, 28);
    grid[10][13] = { color: '#3c3c3c', dmcCode: 'back' };
    const clipped = clipGridToCircleCorners(grid);
    expect(clipped[10][13]).toEqual({ color: '#3c3c3c', dmcCode: 'back' });
    expect(clipped[10][13].dmcCode).toBe('back');
  });

  it('clips exactly when min side = 60 and no-ops when min side > 60', () => {
    const at60 = clipGridToCircleCorners(make(60, 60));
    expect(at60[0][0]).toEqual({ color: '' }); // corner cell outside r=27 (60/2−3)
    const at61 = clipGridToCircleCorners(make(61, 61));
    expect(at61[0][0]).toEqual({ color: '#5d3c2e' }); // untouched
  });

  it('no-ops for 70×70 ornaments (identical to clipShapeEdge > 60 gate)', () => {
    const grid = make(70, 70);
    const clipped = clipGridToCircleCorners(grid);
    expect(clipped).toEqual(grid);
    expect(clipped[0][0]).toEqual({ color: '#5d3c2e' });
  });

  it('does not mutate its input', () => {
    const grid = make(28, 28);
    const snapshot = JSON.stringify(grid);
    const clipped = clipGridToCircleCorners(grid);
    expect(JSON.stringify(grid)).toBe(snapshot);
    expect(clipped).not.toBe(grid);
    expect(clipped[1]).not.toBe(grid[1]);
  });

  it('handles empty and degenerate grids', () => {
    expect(clipGridToCircleCorners([])).toEqual([]);
    expect(clipGridToCircleCorners([[], []])).toEqual([[], []]);
    expect(clipGridToCircleCorners(make(28, 0))).toEqual([]);
  });

  it('is deterministic (same input → identical output)', () => {
    const a = clipGridToCircleCorners(make(28, 28));
    const b = clipGridToCircleCorners(make(28, 28));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});