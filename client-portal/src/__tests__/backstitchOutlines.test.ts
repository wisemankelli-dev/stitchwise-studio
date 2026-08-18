/**
 * Tests for Designer back-stitch outline helper `applyBackstitchOutlines`
 * (owner 08-18: "still does not give you detail like eyes on the bird").
 *
 * Converts color-boundary cells (neighbor of a different color, empty fabric,
 * or the design edge) to 'back' stitch type so fine features trace crisp lines
 * on small product canvases. The cell keeps its color fill.
 */
import { describe, it, expect } from 'vitest';
import { applyBackstitchOutlines } from '../pages/Designer';

const RED = '#e11d48';
const BLUE = '#0284c7';

/** 5×5 grid: red block rows 1..3 × cols 1..3, rest empty. */
function sampleGrid(): Record<string, string> {
  const g: Record<string, string> = {};
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= 3; c++) g[`${r},${c}`] = RED;
  return g;
}

describe('applyBackstitchOutlines', () => {
  it('marks edge cells of the subject as back-stitch', () => {
    const grid = sampleGrid();
    const types = applyBackstitchOutlines(grid, {}, 5, 5);
    // Interior cell (2,2) is surrounded by the same color → stays cross-less (absent).
    expect(types['2,2']).toBeUndefined();
    // Corners of the 3×3 red block touch empty fabric → 'back'.
    expect(types['1,1']).toBe('back');
    expect(types['3,3']).toBe('back');
    // Edge midpoints → 'back'.
    expect(types['1,2']).toBe('back');
    expect(types['2,3']).toBe('back');
    // Nothing outside the block
    expect(types['0,0']).toBeUndefined();
  });

  it('keeps existing stitch types for non-boundary cells', () => {
    const grid = sampleGrid();
    const types = applyBackstitchOutlines(grid, { '2,2': 'cross' }, 5, 5);
    expect(types['2,2']).toBe('cross');
    expect(types['1,1']).toBe('back');
  });

  it('records internal color boundaries too (eye-like small dark region)', () => {
    const grid = sampleGrid();
    // Add a 1-cell dark "eye" inside the red block.
    grid['2,2'] = '#000000';
    const types = applyBackstitchOutlines(grid, {}, 5, 5);
    // The dark eye cell borders red on all sides → outlined as back-stitch.
    expect(types['2,2']).toBe('back');
    // Red cells touching the eye also become boundaries.
    expect(types['1,2']).toBe('back');
  });
});