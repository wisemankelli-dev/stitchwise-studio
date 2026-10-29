/**
 * b136 — SECOND-GENERATE canvas contract (owner retest2 follow-up, 2026-10-29).
 * ===========================================================================
 * Owner workflow: she iterates prompts, so "Generate" twice in one session is
 * normal. Build 135 (#203) made the FIRST generation adopt the direct-draw
 * response verbatim (54x54 bear onto her 28x28 Bag Charm canvas), but the
 * legacy "preset dims win" re-apply that ran ~30 lines below the adopt fired on
 * the SECOND generate: by then canvasW is the ADOPTED 54 while presetW is still
 * the 28 preset, so it snapped the canvas back to 28 while the grid stayed
 * 54x54 -> windowed render + 28x28 save (undo already cleared).
 *
 * This test drives the REAL exported pipeline from ../pages/Designer through
 * one session, twice, exactly like handleGenerate does:
 *   canvas dims captured -> preset dims -> api response -> resolveGenerationResponse
 *   -> resolvePostGenerationCanvas (the single canvas decision point)
 *   -> buildManualGridData (the exact payload doSavePattern posts)
 * It is hermetic: no DOM, no network, no DB (fixtures only), same style as
 * qaRenderedPixelGate.test.ts.
 *
 * RED on main @ 691cf38 (canvas 28, saved 28x28), GREEN after b136.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveGenerationResponse,
  resolvePostGenerationCanvas,
  buildManualGridData,
  inchesToStitches,
  CANVAS_PRESETS,
} from '../pages/Designer';
import fixtures from './fixtures-r2-directdraw-grids.json';

type CanvasPreset = (typeof CANVAS_PRESETS)[number];

const charmRows = fixtures.charm as string[][]; // the shipped 54x54 DD bear
const BAG_CHARM = CANVAS_PRESETS.find((p) => p.name === 'Bag Charm') as CanvasPreset;

/** Mirrors the generate handler's newGrid loop: empty cells are skipped. */
function toRecord(rows: string[][]): Record<string, string> {
  const grid: Record<string, string> = {};
  rows.forEach((row, r) =>
    row.forEach((color, c) => {
      if (color) grid[`${r},${c}`] = color;
    }),
  );
  return grid;
}

type Canvas = { w: number; h: number };

/**
 * One click of "Generate" on the canvas the session currently has. Mirrors
 * handleGenerate step for step (the parts that decide dims), returning the
 * canvas AFTER the response is adopted plus the exact save payload.
 */
function generateOnce(
  canvas: Canvas,
  opts: { fabricCount: number; preset: CanvasPreset | null; rows: string[][]; directDraw: boolean },
) {
  const canvasW = canvas.w;
  const canvasH = canvas.h;
  const presetW = opts.preset ? inchesToStitches(opts.preset.inchW, opts.fabricCount) : canvasW;
  const presetH = opts.preset ? inchesToStitches(opts.preset.inchH, opts.fabricCount) : canvasH;

  const newGrid = toRecord(opts.rows);
  const newW = opts.rows[0]?.length ?? 0;
  const newH = opts.rows.length;
  const resolved = resolveGenerationResponse({
    newGrid,
    newStitchTypes: {},
    newW,
    newH,
    targetW: presetW,
    targetH: presetH,
  });

  const next = resolvePostGenerationCanvas({
    directDraw: opts.directDraw,
    adoptedW: resolved.width,
    adoptedH: resolved.height,
    canvasW,
    canvasH,
    presetW,
    presetH,
    hasPreset: !!opts.preset,
  });

  // doSavePattern: buildManualGridData(grid, types, gridWidth, gridHeight)
  const saved = buildManualGridData(resolved.grid, resolved.stitchTypes, next.width, next.height);
  return { canvas: { w: next.width, h: next.height }, grid: resolved.grid, saved };
}

describe('Bag Charm preset dims (fixture sanity for the owner scenario)', () => {
  it('2in @ 14ct = 28 (the canvas her first generate starts from)', () => {
    expect(inchesToStitches(BAG_CHARM.inchW, 14)).toBe(28);
    expect(inchesToStitches(BAG_CHARM.inchH, 14)).toBe(28);
  });
  it('the direct-draw contract is 54x54 (3in @ 18ct, owner floor)', () => {
    expect(charmRows.length).toBe(54);
    expect(charmRows[0].length).toBe(54);
    expect(inchesToStitches(3, 18)).toBe(54);
  });
});

describe('b136 — SECOND generate in one session must not re-shrink a 54x54 DD adopt', () => {
  const start: Canvas = { w: 28, h: 28 }; // Bag Charm at 14ct
  const args = { fabricCount: 14, preset: BAG_CHARM, rows: charmRows, directDraw: true };

  it('FIRST generate adopts 54x54 verbatim onto the 28 canvas (build 135 behaviour, unchanged)', () => {
    const g1 = generateOnce(start, args);
    expect(g1.canvas).toEqual({ w: 54, h: 54 });
    expect(g1.saved.grid.length).toBe(54);
    expect(g1.saved.grid[0].length).toBe(54);
  });

  it('SECOND generate keeps canvas 54x54 AND grid 54x54 (THE REGRESSION)', () => {
    const g1 = generateOnce(start, args);
    const g2 = generateOnce(g1.canvas, args); // her second click: canvas is now 54
    expect(g2.canvas).toEqual({ w: 54, h: 54 }); // main: 28  <- the bug
    expect(g2.saved.width).toBe(54); // main: 28
    expect(g2.saved.height).toBe(54); // main: 28
  });

  it('SECOND generate: the SAVED gridData is 54 rows x 54 cols with the full bear intact', () => {
    const g1 = generateOnce(start, args);
    const g2 = generateOnce(g1.canvas, args);
    expect(g2.saved.grid.length).toBe(54); // rows
    expect(g2.saved.grid[0].length).toBe(54); // cols
    // the 28-window crop (the -2 failure) would have kept 28x28 = 784 cells and
    // lost the muzzle/crown ring: the full 54x54 canvas keeps all 2916 cells.
    expect(g2.saved.grid.flat().length).toBe(2916);
    // every contract colour still present after the second generate (the B2
    // palette is exactly these five — the b134 #254267 sweater no longer exists)
    const hexes = new Set(g2.saved.grid.flat().map((c) => c.color).filter(Boolean));
    const B2 = ['#113b69', '#ffffff', '#5d3c2e', '#8a6c54', '#3c3c3c'];
    for (const hex of B2) {
      expect(hexes.has(hex)).toBe(true);
    }
    expect([...hexes].sort()).toEqual([...B2].sort()); // and NOTHING else (no sweater)
    expect(hexes.has('#254267')).toBe(false);
    // crown ring sits at row 4 / col 26 — outside a 28-wide window's face but
    // inside the 54 canvas, so it proves the canvas did not window the grid.
    expect(g2.saved.grid[4][26].color).toBe('#113b69');
  });

  it('THIRD generate is still 54x54 (the fix is stable, not a one-shot)', () => {
    let canvas = start;
    for (let i = 0; i < 3; i++) {
      const g = generateOnce(canvas, args);
      canvas = g.canvas;
      expect(g.canvas).toEqual({ w: 54, h: 54 });
      expect(g.saved.grid.length).toBe(54);
      expect(g.saved.grid[0].length).toBe(54);
    }
  });

  it('stocking: second generate keeps the adopted 154x238 portrait', () => {
    const stockRows = fixtures.stock as string[][];
    const stockPreset = CANVAS_PRESETS.find((p) => p.name === 'Stocking') as CanvasPreset;
    const a = { fabricCount: 14, preset: stockPreset, rows: stockRows, directDraw: true };
    const g1 = generateOnce({ w: 154, h: 238 }, a);
    expect(g1.canvas).toEqual({ w: 154, h: 238 });
    const g2 = generateOnce(g1.canvas, a);
    expect(g2.canvas).toEqual({ w: 154, h: 238 });
    expect(g2.saved.grid.length).toBe(238);
    expect(g2.saved.grid[0].length).toBe(154);
  });
});

describe("b136 — non-direct-draw flows keep today's behaviour exactly", () => {
  it('AI response on a stale canvas: the preset still wins (owner 08-18 ornament 17x17 bug)', () => {
    // stale 100x100 canvas, 5x5 ornament preset @14ct = 70x70
    const ornament = CANVAS_PRESETS.find((p) => p.name === 'Large Ornament') as CanvasPreset;
    const rows = Array.from({ length: 70 }, () => Array.from({ length: 70 }, () => '#ffffff'));
    const g = generateOnce({ w: 100, h: 100 }, { fabricCount: 14, preset: ornament, rows, directDraw: false });
    expect(g.canvas).toEqual({ w: 70, h: 70 });
  });

  it('AI response when the canvas already matches the preset: no resize, response dims adopted', () => {
    const ornament = CANVAS_PRESETS.find((p) => p.name === 'Large Ornament') as CanvasPreset;
    const rows = Array.from({ length: 70 }, () => Array.from({ length: 70 }, () => '#ffffff'));
    const g = generateOnce({ w: 70, h: 70 }, { fabricCount: 14, preset: ornament, rows, directDraw: false });
    expect(g.canvas).toEqual({ w: 70, h: 70 });
  });

  it('no preset, no response dims: canvas is untouched (legacy fallback)', () => {
    const g = generateOnce({ w: 100, h: 100 }, { fabricCount: 14, preset: null, rows: [], directDraw: false });
    expect(g.canvas).toEqual({ w: 100, h: 100 });
  });

  it('direct-draw wins over the preset even when the preset differs (the whole point)', () => {
    const r = resolvePostGenerationCanvas({
      directDraw: true,
      adoptedW: 54,
      adoptedH: 54,
      canvasW: 54,
      canvasH: 54,
      presetW: 28,
      presetH: 28,
      hasPreset: true,
    });
    expect(r).toEqual({ width: 54, height: 54 });
  });
});
