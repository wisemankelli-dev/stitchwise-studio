/**
 * figureSignalGuard — deterministic scatter/pattern figure-signal tests.
 *
 * Owner-conclusive (09-21, gap #41 3rd report): "snowflakes on a blue
 * stocking" (regenerated after PR #185) has the correct 3-color palette but
 * STILL draws ONE big snowman-like figure instead of scattered white
 * snowflakes on blue. These tests pin the two deterministic layers:
 *   1. isScatterPatternPrompt — prompt-side scatter gate (feeds the NEW
 *      repeating-pattern shape sentences in enrichAIPrompt).
 *   2. analyzeFigureSignal / figureSignalWarning — grid-side connected-
 *      component classifier wired into qualityGate.
 */
import { describe, it, expect } from "@jest/globals";
import {
  isScatterPatternPrompt,
  analyzeFigureSignal,
  figureSignalWarning,
} from "../domain/stitch/figureSignalGuard";
import type { StitchCell } from "../domain/stitch/types";

const BLUE = "#3366cc";
const WHITE = "#ffffff";
const RED = "#cc3333";
const DARK_BLUE = "#2e609d"; // dark figure color from the real 10-09 snapshot
const LIGHT_BLUE = "#6c95c4"; // light splash color from the real 10-09 snapshot

function makeGrid(h: number, w: number, fill = BLUE): StitchCell[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ color: fill })));
}

/**
 * The owner's failing-sample signature at 40×50: ONE tall snowman figure
 * (white head circle + white body circle connected by a red scarf bar) on a
 * blue canvas — a single component covering ~100% of the foreground, tall.
 */
function snowmanGrid(h = 50, w = 40): StitchCell[][] {
  const g = makeGrid(h, w);
  const circle = (cr: number, cc: number, rad: number) => {
    for (let r = cr - rad; r <= cr + rad; r++) {
      for (let c = cc - rad; c <= cc + rad; c++) {
        if (r < 0 || r >= h || c < 0 || c >= w) continue;
        if ((r - cr) ** 2 + (c - cc) ** 2 <= rad * rad) g[r][c].color = WHITE;
      }
    }
  };
  circle(10, Math.floor(w / 2), 7);   // head
  circle(29, Math.floor(w / 2), 12);  // body
  for (let c = Math.floor(w / 2) - 12; c <= Math.floor(w / 2) + 12; c++) g[16][c].color = RED;
  return g;
}

/** The desired output: many small separate white flakes on blue. */
function scatterGrid(h = 40, w = 44): StitchCell[][] {
  const g = makeGrid(h, w);
  const spots: Array<[number, number]> = [
    [4, 4], [4, 12], [4, 20], [4, 28], [4, 36],
    [12, 8], [12, 16], [12, 24], [12, 32],
    [20, 4], [20, 20], [20, 36], [28, 12], [28, 28],
    [34, 6], [34, 18], [34, 30],
  ];
  for (const [r, c] of spots) {
    g[r][c].color = WHITE;
    if (c + 1 < w) g[r][c + 1].color = WHITE;
    if (r + 1 < h) g[r + 1][c].color = WHITE;
  }
  return g;
}

// ─── isScatterPatternPrompt ─────────────────────────────────────────────
describe("isScatterPatternPrompt", () => {
  it("matches scattered/repeating-pattern subjects", () => {
    expect(isScatterPatternPrompt("snowflakes with a blue background")).toBe(true);
    expect(isScatterPatternPrompt("snowflakes")).toBe(true);
    expect(isScatterPatternPrompt("white stars")).toBe(true);
    expect(isScatterPatternPrompt("polka dots")).toBe(true);
    expect(isScatterPatternPrompt("candy canes on a stocking")).toBe(true);
    expect(isScatterPatternPrompt("repeating hearts")).toBe(true);
    expect(isScatterPatternPrompt("many small flowers")).toBe(true);
    expect(isScatterPatternPrompt("scattered confetti")).toBe(true);
  });
  it("does NOT match single-object prompts or animals", () => {
    expect(isScatterPatternPrompt("a red star")).toBe(false);
    expect(isScatterPatternPrompt("snowman")).toBe(false);
    expect(isScatterPatternPrompt("teddy bear")).toBe(false);
    expect(isScatterPatternPrompt("kitten face")).toBe(false);
    expect(isScatterPatternPrompt("a yellow sunflower")).toBe(false);
    expect(isScatterPatternPrompt("")).toBe(false);
  });
});

// ─── analyzeFigureSignal ────────────────────────────────────────────────
describe("analyzeFigureSignal", () => {
  it("sees the snowman as ONE dominant vertically-elongated component (owner 09-21 repro)", () => {
    const s = analyzeFigureSignal(snowmanGrid());
    expect(s.filled).toBeGreaterThan(300);
    expect(s.componentCount).toBe(1);
    expect(s.largestFraction).toBeGreaterThan(0.9);
    expect(s.rowSpan).toBeGreaterThanOrEqual(s.colSpan * 1.3);
    expect(s.dominantHex).toBe(BLUE);
  });
  it("sees scattered flakes as MANY small components (none dominating)", () => {
    const s = analyzeFigureSignal(scatterGrid());
    expect(s.componentCount).toBeGreaterThanOrEqual(17);
    expect(s.largestFraction).toBeLessThan(0.2);
    expect(s.dominantHex).toBe(BLUE);
  });
  it("returns zeros for an empty single-color canvas", () => {
    const s = analyzeFigureSignal(makeGrid(10, 10));
    expect(s.filled).toBe(0);
    expect(s.componentCount).toBe(0);
    expect(s.largestFraction).toBe(0);
    expect(s.bbox).toBeNull();
  });
});

// ─── figureSignalWarning ────────────────────────────────────────────────
describe("figureSignalWarning", () => {
  it("warns when a scatter prompt converts to ONE big figure (owner 09-21 repro)", () => {
    const warning = figureSignalWarning(snowmanGrid(), "snowflakes with a blue background");
    expect(warning).toContain("single figure");
    expect(warning).toContain("please regenerate");
  });
  it("stays silent for genuinely scattered flakes", () => {
    expect(figureSignalWarning(scatterGrid(), "snowflakes with a blue background")).toBeNull();
  });
  it("stays silent for NON-scatter prompts even with one big figure (animal/single-subject paths)", () => {
    expect(figureSignalWarning(snowmanGrid(), "teddy bear")).toBeNull();
    expect(figureSignalWarning(snowmanGrid(), "a snowman")).toBeNull();
    expect(figureSignalWarning(snowmanGrid(), "kitten face")).toBeNull();
  });
  it("respects a supplied dominant hex (test override path)", () => {
    const g = makeGrid(20, 20, WHITE);
    for (let c = 8; c < 12; c++) g[8][c].color = BLUE; // one small blue mark
    expect(figureSignalWarning(g, "snowflakes", { dominantHex: WHITE })).toBeNull();
  });
  it("warns on the REAL live sample — 10-09 'snowflake stocking blue' (154x238 snapshot, dominant WHITE field + ONE tall dark-blue figure)", () => {
    // Faithful reduction of live-dev-20261009T114034Z: white #ffffff field
    // (7630 cells, dominant), ONE dark-blue #2e609d figure with a head →
    // shoulders → waist → hips → toe-taper profile (5967 cells, rows 39–209
    // of 238 = 0.72 of canvas height), plus a light-blue #6c95c4 splash.
    const R = 40, C = 48;
    const g: StitchCell[][] = Array.from({ length: R }, () =>
      Array.from({ length: C }, () => ({ color: WHITE })),
    );
    const fig = (r: number, c0: number, c1: number) => {
      for (let c = c0; c <= c1; c++) g[r][c].color = DARK_BLUE;
    };
    fig(2, 21, 26); fig(3, 20, 27); fig(4, 20, 27); fig(5, 21, 26); // head
    fig(8, 11, 36); fig(11, 8, 39); fig(14, 9, 38); fig(17, 12, 35); // shoulders
    fig(21, 16, 31); fig(24, 17, 30); // waist
    fig(29, 9, 38); fig(32, 7, 40); fig(35, 8, 39); // hips
    fig(37, 21, 26); fig(38, 23, 24); fig(39, 23, 24); // toe taper
    g[6][40].color = LIGHT_BLUE; // detached light-blue splash (like the 2489 cells)
    const s = analyzeFigureSignal(g);
    // Single dominating figure: largestFraction near 1, tall on the canvas.
    expect(s.largestFraction).toBeGreaterThan(0.9);
    expect(s.componentCount).toBe(2);
    expect(s.heightExtentRatio).toBeGreaterThan(0.6);
    expect(figureSignalWarning(g, "blue background with white snowflakes")).toContain("single figure");
    // Same grid must stay silent for a single-subject prompt.
    expect(figureSignalWarning(g, "teddy bear")).toBeNull();
  });
});