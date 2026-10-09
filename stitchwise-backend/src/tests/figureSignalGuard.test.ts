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
});