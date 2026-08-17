import { describe, it, expect } from 'vitest';
import { cellsBetween } from '../src/components/StitchGrid';

describe('cellsBetween (drag interpolation)', () => {
  it('returns just the target when there is no previous cell', () => {
    expect(cellsBetween(null, { row: 5, col: 5 })).toEqual([{ row: 5, col: 5 }]);
  });

  it('returns the target when both cells are the same', () => {
    expect(cellsBetween({ row: 5, col: 5 }, { row: 5, col: 5 })).toEqual([{ row: 5, col: 5 }]);
  });

  it('fills every horizontal cell between two distant samples (fast drag)', () => {
    const cells = cellsBetween({ row: 10, col: 0 }, { row: 10, col: 30 });
    expect(cells.length).toBe(30);
    expect(cells[0]).toEqual({ row: 10, col: 1 });
    expect(cells[29]).toEqual({ row: 10, col: 30 });
    // no gaps
    for (let c = 1; c <= 30; c++) {
      expect(cells).toContainEqual({ row: 10, col: c });
    }
  });

  it('fills every vertical cell too', () => {
    const cells = cellsBetween({ row: 0, col: 7 }, { row: 25, col: 7 });
    expect(cells.length).toBe(25);
    expect(cells[24]).toEqual({ row: 25, col: 7 });
  });

  it('handles diagonal drags', () => {
    const cells = cellsBetween({ row: 0, col: 0 }, { row: 5, col: 5 });
    expect(cells.length).toBe(5);
    expect(cells[4]).toEqual({ row: 5, col: 5 });
  });
});
