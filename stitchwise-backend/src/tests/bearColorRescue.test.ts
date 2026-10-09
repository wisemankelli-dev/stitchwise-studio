/**
 * Deterministic bear-fur color rescue tests (owner 10-09 17:40Z charm verdict
 * #2 — "Teddy bag charm- No blue sweater" aba0bd27: 0 blue pixels, bear rust
 * #bf5816; prior f2a09e8e: blue sweater survived but bear orange #e27323).
 *
 * Acceptance (charm-sweater-facts.txt):
 *   A. brown/tan-DOMINANT bear (no rust/orange family dominance);
 *   B. blue sweater present (≥ a solid blue run in the final grid).
 * The prompt directive is advisory — the deterministic rescue is what closes
 * the loop on the small-grid charm path.
 */
import { describe, it, expect } from "@jest/globals";
import { applyBearColorRescue, needsBearColorRescue, missingNamedOtherColor, countColorFamily } from "../domain/stitch/bearColorRescue";
import { naturalColorDirectives, otherNounColorPairs } from "../domain/stitch/naturalColorDirective";
import { CROSS_STITCH_SYMBOLS } from "../domain/stitch/types";
import type { StitchCell, StitchGrid, DmcUsage } from "../domain/stitch/types";

function cell(color: string): StitchCell {
  return { color, dmcCode: "MAN-1", dmcName: color };
}
function makeGrid(hueCells: Array<[number, number, string]>, size: number): StitchGrid {
  const grid: StitchGrid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({ color: "" }) as StitchCell),
  );
  for (const [r, c, hex] of hueCells) grid[r][c] = cell(hex);
  return grid;
}
function paletteOf(grid: StitchGrid): DmcUsage[] {
  const counts = new Map<string, number>();
  for (const row of grid) for (const cell of row) {
    if (!cell?.color) continue;
    counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
  }
  return [...counts.entries()].map(([hex, count], i) => ({
    code: `MAN-${i + 1}`, name: hex, hex, count,
    symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
  }));
}
const ORANGE = "#e27323"; // hexFamily → orange (rust family)
const ORANGE2 = "#bf5816"; // hexFamily → orange
const BROWN = "#8a6c54";   // hexFamily → brown
const DARK_BROWN = "#5d3c2e"; // hexFamily → brown
const BLUE = "#2e609d";    // hexFamily → blue
const LIGHT_BLUE = "#6c95c4";

describe("scoped bear directive (owner 10-09 17:40Z verdict #2)", () => {
  it("'teddy bear with blue sweater' scopes the body directive and carries the sweater color", () => {
    const m = naturalColorDirectives("teddy bear with blue sweater");
    const bear = m.find((x) => x.subject === "a teddy bear");
    expect(bear).toBeDefined();
    // The old directive said "use only brown and tan tones" — image-wide, so
    // Gemini monochromed the sweater too (aba0bd27: 0 blue). New wording must
    // SCOPE the fur and carry the sweater blue through.
    expect(bear!.directive).not.toContain("use only brown and tan tones");
    expect(bear!.directive).toContain("FUR and FACE are brown and tan");
    expect(bear!.directive).toContain("The blue sweater stays blue (navy/royal)");
    expect(bear!.directive).toContain("no red");
    expect(bear!.directive).toContain("no orange");
    expect(bear!.directive).toContain("no pink");
  });
  it("'teddybear with pink sweater' carries pink through", () => {
    const m = naturalColorDirectives("teddybear with pink sweater");
    const bear = m.find((x) => x.subject === "a teddy bear");
    expect(bear).toBeDefined();
    expect(bear!.directive).toContain("The pink sweater stays pink");
  });
  it("no other color → the original image-wide wording is preserved (byte-identical)", () => {
    const m = naturalColorDirectives("teddy bear");
    const bear = m.find((x) => x.subject === "a teddy bear");
    expect(bear).toBeDefined();
    expect(bear!.directive).toContain("use only brown and tan tones");
    expect(bear!.directive).toContain("Natural colors: a teddy bear is brown and tan");
  });
  it("user-named bear color still wins (no directive)", () => {
    expect(naturalColorDirectives("brown teddy bear")).toEqual([]);
  });
  it("'white top and white toe' on a stocking are NOT carried noun-color pairs", () => {
    expect(otherNounColorPairs("blue background with white top and white toe. Add white snowflakes")).toEqual([]);
  });
  it("'blue teddy bear' is the subject's own color, not a pair", () => {
    expect(otherNounColorPairs("blue teddy bear")).toEqual([]);
  });
});

describe("bearColorRescue — rust→brown (charm-sweeper-facts acceptance A)", () => {
  it("recolors an orange-DOMINANT teddy bear to brown/tan (aba0bd27-shaped grid)", () => {
    const grid = makeGrid(
      [
        // rust-dominant body (orange families)
        ...Array.from({ length: 6 }, (_, i) => [2, i, ORANGE] as const),
        ...Array.from({ length: 6 }, (_, i) => [3, i, ORANGE2] as const),
        ...Array.from({ length: 2 }, (_, i) => [4, i, DARK_BROWN] as const),
      ],
      8,
    );
    const dmc = paletteOf(grid);
    expect(needsBearColorRescue(grid, "teddy bear")).toBe(true);
    const rescued = applyBearColorRescue(grid, dmc, "teddy bear");
    // All orange-family cells became brown; brown/tan now dominates.
    let orange = 0;
    let brown = 0;
    for (const row of rescued.grid) for (const cell of row) {
      if (!cell?.color) continue;
      const h = cell.color.toLowerCase();
      if (h === ORANGE || h === ORANGE2) orange++;
      if (h.startsWith("#8a6c54") || h.startsWith("#5d3c2e") || h === BROWN || h === DARK_BROWN) brown++;
    }
    expect(orange).toBe(0);
    expect(brown).toBeGreaterThanOrEqual(14);
    // Palette counts stay consistent: no orphan symbols, sum preserved.
    const totalBefore = dmc.reduce((a, d) => a + d.count, 0);
    const totalAfter = rescued.dmcColors.reduce((a, d) => a + d.count, 0);
    expect(totalAfter).toBe(totalBefore);
    expect(rescued.dmcColors.every((d) => d.symbol)).toBe(true);
  });
  it("no-ops (same references) when brown/tan already dominates", () => {
    const grid = makeGrid(
      [
        ...Array.from({ length: 9 }, (_, i) => [2, i, BROWN] as const),
        ...Array.from({ length: 1 }, (_, i) => [3, i, ORANGE] as const),
      ],
      8,
    );
    const dmc = paletteOf(grid);
    const rescued = applyBearColorRescue(grid, dmc, "teddy bear");
    expect(rescued.grid).toBe(grid);
    expect(rescued.dmcColors).toBe(dmc);
  });
  it("no-ops for non-bear subjects (snowman with a yellow smile)", () => {
    const grid = makeGrid([[2, 2, ORANGE], [3, 3, ORANGE2]], 8);
    const dmc = paletteOf(grid);
    const rescued = applyBearColorRescue(grid, dmc, "snowman");
    expect(rescued.grid).toBe(grid);
  });
  it("no-ops when the user named a bear color (directive silent)", () => {
    const grid = makeGrid([[2, 2, ORANGE], [3, 3, ORANGE2]], 8);
    const dmc = paletteOf(grid);
    expect(needsBearColorRescue(grid, "brown teddy bear")).toBe(false);
  });
  it("no-ops on non-small grids (larger canvases keep their freedom)", () => {
    const grid = makeGrid([[2, 2, ORANGE], [3, 3, ORANGE2]], 80);
    const dmc = paletteOf(grid);
    const rescued = applyBearColorRescue(grid, dmc, "teddy bear");
    expect(rescued.grid).toBe(grid);
  });
});

describe("missingNamedOtherColor — re-roll trigger (acceptance B)", () => {
  it("detects 'blue sweater' named but ZERO blue cells in the final grid", () => {
    const grid = makeGrid([[2, 2, BROWN], [3, 3, DARK_BROWN]], 8);
    const missing = missingNamedOtherColor(grid, "teddy bear with blue sweater");
    expect(missing).toEqual({ color: "blue", noun: "sweater" });
  });
  it("returns null when the named color IS present", () => {
    const grid = makeGrid([[2, 2, BLUE], [3, 3, LIGHT_BLUE], [4, 4, BROWN]], 8);
    expect(missingNamedOtherColor(grid, "teddy bear with blue sweater")).toBeNull();
    expect(countColorFamily(grid, "blue")).toBe(2);
  });
  it("returns null when no other-noun color is named", () => {
    const grid = makeGrid([[2, 2, BLUE]], 8);
    expect(missingNamedOtherColor(grid, "teddy bear")).toBeNull();
  });
  it("'white top and white toe' on a stocking is not a re-roll trigger", () => {
    const grid = makeGrid([[2, 2, BLUE]], 8);
    expect(missingNamedOtherColor(grid, "blue background with white top and white toe")).toBeNull();
  });
});