import { describe, it, expect } from 'vitest';
import { resolveGenerationResponse, shouldMaskGeneration } from '../pages/Designer';
import fixtures from './fixtures-r2-directdraw-grids.json';

describe('resolveGenerationResponse — verbatim-adopt (owner retest2 10-26 P0)', () => {
  it('adopts the response dims verbatim when present (54 onto a stale 28 canvas)', () => {
    const grid = { '0,0': '#ffffff' };
    const r = resolveGenerationResponse({ newGrid: grid, newStitchTypes: {}, newW: 54, newH: 54, targetW: 28, targetH: 28 });
    expect(r.width).toBe(54); expect(r.height).toBe(54); expect(r.grid).toBe(grid);
  });
  it('falls back to the canvas dims only when the response has NO grid dims', () => {
    const r = resolveGenerationResponse({ newGrid: {}, newStitchTypes: {}, newW: 0, newH: 0, targetW: 28, targetH: 28 });
    expect(r.width).toBe(28); expect(r.height).toBe(28);
  });
});

describe('shouldMaskGeneration — direct-draw grids are final designs (no re-mask)', () => {
  it('skips the guide mask for directDraw responses', () => {
    expect(shouldMaskGeneration({ directDraw: true, hasGuide: true, targetW: 54 })).toBe(false);
  });
  it('still masks AI art (guide + canvas present)', () => {
    expect(shouldMaskGeneration({ hasGuide: true, targetW: 154 })).toBe(true);
    expect(shouldMaskGeneration({ hasGuide: false, targetW: 154 })).toBe(false);
    expect(shouldMaskGeneration({ hasGuide: true, targetW: 0 })).toBe(false);
  });
});

describe('DD stocking — FIXED save contract vs the -2 regression (cell-level)', () => {
  const stock = fixtures.stock as string[][];
  it('fixture is the 238x154 shipped DD contract', () => {
    expect(stock.length).toBe(238);
    expect(stock[0].length).toBe(154);
    const count = (h: string) => stock.flat().filter(c => c === h).length;
    expect(count('#2e609d')).toBe(12083);
    expect(count('#ffffff')).toBe(2335);   // the cuff+toe the old mask culled to 0
    expect(count('#113b69')).toBe(1005);   // five stars
    expect(count('')).toBe(16514);
  });
  it('white cuff+toe survive the FIXED pipeline (no silhouette re-mask, no window crop)', () => {
    // the -2 save emptied rows 0..~31 (white cuff culled by the 49-pt polygon):
    // the FIXED contract keeps white from the very top (cuff) to the toe tip.
    const rowsWithWhite = stock.map((r, i) => (r.includes('#ffffff') ? i : -1)).filter(i => i >= 0);
    expect(rowsWithWhite.length).toBeGreaterThanOrEqual(25);    // white band across many rows (NOT culled to 0)
    expect(rowsWithWhite[0]).toBeLessThanOrEqual(5);           // cuff STARTS at the top (the -2 mask culled rows 0..~31)
  });
});

describe('DD charm — FIXED 54x54 contract (no 28-window crop)', () => {
  it('fixture is the 54x54 contract with the full bear', () => {
    const charm = fixtures.charm as string[][];
    expect(charm.length).toBe(54);
    expect(charm[0].length).toBe(54);
    const colored = charm.flat().filter(c => c && c !== '').length;
    expect(colored).toBeGreaterThan(1000);
    expect(charm[4][26]).toBe('#113b69'); // crown ring on the contract
  });
});
