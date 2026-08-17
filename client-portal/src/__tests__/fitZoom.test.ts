/**
 * Tests for Designer auto-fit zoom (owner report: "the stocking toe is cutoff").
 *
 * fitZoomFor(cols, rows, availW, availH) shrinks the canvas so the whole grid
 * fits the visible panel: only ever zooms OUT (never above 1), 0.95 margin,
 * 0.15 floor. The 154×238 stocking preset is 11″×17″ at 14ct — at zoom=1 the
 * canvas is 1848×2856px, far larger than the ~700-800px panel, so clicking the
 * preset must auto-fit (≈0.22 zoom) or the toe (bottom-right) is off-screen.
 */
import { describe, it, expect } from 'vitest';
import { fitZoomFor } from '../pages/Designer';

describe('fitZoomFor — auto-fit zoom on preset click', () => {
  it('stocking 154×238 in an 800×700 panel (avail 752×652): fits, ~0.22', () => {
    const z = fitZoomFor(154, 238, 752, 652);
    // height is the binding constraint: 652 / (238×12) × 0.95 ≈ 0.217
    expect(z).toBeGreaterThan(0.2);
    expect(z).toBeLessThan(0.25);
    expect(z).toBeCloseTo(652 / (238 * 12) * 0.95, 4);
    // the whole 238-row canvas fits the 652px-tall panel (with the 0.95 margin)
    expect(238 * 12 * z * 0.95).toBeLessThanOrEqual(652);
    // ...and the toe (bottom-right, ~143,217 of 154×238) is therefore on-screen
    expect(217 * 12 * z).toBeLessThanOrEqual(652);
    expect(143 * 12 * z).toBeLessThanOrEqual(752);
  });

  it('42×42 small canvas in 800×700 panel → capped at 1 (never zooms in)', () => {
    expect(fitZoomFor(42, 42, 752, 652)).toBe(1);
  });

  it('tiny panel floors at 0.15', () => {
    expect(fitZoomFor(154, 238, 300, 300)).toBe(0.15);
    expect(fitZoomFor(154, 238, 120, 120)).toBe(0.15);
    expect(fitZoomFor(240, 240, 400, 400)).toBe(0.15);
  });

  it('never exceeds 1 for any input (only ever zooms out to fit)', () => {
    const cases: [number, number, number, number][] = [
      [6, 6, 100, 100],
      [240, 240, 500, 400],
      [10, 10, 10000, 10000],
      [154, 238, 100000, 100000],
      [154, 238, 100, 100],
      [42, 42, 752, 652],
    ];
    for (const [c, r, w, h] of cases) {
      expect(fitZoomFor(c, r, w, h)).toBeLessThanOrEqual(1);
    }
  });
});
