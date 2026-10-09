/**
 * Edge-halo fill tests (owner 10-09 retest #4 — stocking "white lip").
 *
 * The transition band around the blue body is a 6-8 cell white halo that
 * survives inside the masked silhouette. Acceptance (lip-facts.txt):
 *   - her real grid: depth-1 ring white fraction in the LEG region drops
 *     89% → <5%, cuff/toe rings stay white, snowflake count intact;
 *   - other shapes + ≤60 small grids byte-identical;
 *   - 'white background' prompts unaffected (thick white body is not a lip).
 *
 * Synthetic fixtures rebuild the exact anatomy with the REAL stocking
 * silhouette (buildProductSilhouette) so coordinates are honest: a blue body,
 * a 3-cell white transition band around it, a thick white cap (top), a thick
 * white toe, and a deep interior snowflake.
 */
import {
  edgeHaloFill,
  edgeHaloDepth,
  EDGE_HALO_MAX_DEPTH,
  EDGE_HALO_THICK_RUN,
  EDGE_HALO_TRIM_ROW_LO_FRAC,
  EDGE_HALO_TRIM_ROW_HI_FRAC,
} from "../domain/stitch/edgeHaloFill";
import { buildProductSilhouette } from "../domain/stitch/productShapeMask";
import type { StitchCell, StitchGrid } from "../domain/stitch/types";

const WHITE: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };
const BLUE: StitchCell = { color: "#2e609d", dmcCode: "799", dmcName: "Delft Blue" };
const LIGHT: StitchCell = { color: "#6c95c4", dmcCode: "800", dmcName: "Delft Blue Light" };
const CANVAS: StitchCell = { color: "" };

function cell(color: string): StitchCell {
  return color === "" ? { ...CANVAS } : color === "#ffffff" ? { ...WHITE } : color === "#2e609d" ? { ...BLUE } : { ...LIGHT };
}

/**
 * Build a stocking-shaped fixture with the exact retest-#4 anatomy:
 *   W x H, real stocking silhouette, a BLUE body inset by BAND cells, white
 *   band (depth 1..BAND) around it, a thick white CAP at the top and TOE at
 *   the bottom (their interiors are white — inward run >= EDGE_HALO_THICK_RUN),
 *   plus a 3x3 interior snowflake placed at a cell with depth >= 10.
 */
function buildStockingFixture(
  width: number,
  height: number,
  band = 3,
): { grid: StitchGrid; mask: boolean[][]; depth: number[][] } {
  const mask = buildProductSilhouette("stocking", width, height);
  // Base grid: canvas outside; white inside, then painted.
  const grid: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...WHITE })),
  );
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!mask[r][c]) grid[r][c] = { ...CANVAS };
    }
  }
  const depth = edgeHaloDepth(grid, mask);
  // Body + band: depth <= band stays white (the lip), deeper cells become blue.
  let maxR = -1;
  let minR = height;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r][c];
      if (d >= 1) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (d > band) grid[r][c] = { ...BLUE };
      }
    }
  }
  // Thick white cap = top ~25 rows of the silhouette (her real cap is
  // rows 22-43 = 21 deep on a narrow band — a 25-row cap gives ring cells a
  // long inward run, like her grid).
  for (let r = minR; r <= minR + 24; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c].color !== "") grid[r][c] = { ...WHITE };
    }
  }
  // Thick white toe = bottom ~14 rows (the silhouette toe points there).
  for (let r = maxR - 13; r <= maxR; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c].color !== "") grid[r][c] = { ...WHITE };
    }
  }
  // Interior snowflake: 3x3 white block centered on a deep interior cell.
  let deepRow = -1;
  let deepCol = -1;
  let deepD = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r][c];
      if (d > deepD) {
        deepD = d;
        deepRow = r;
        deepCol = c;
      }
    }
  }
  for (let r = deepRow - 1; r <= deepRow + 1; r++) {
    for (let c = deepCol - 1; c <= deepCol + 1; c++) {
      if (mask[r]?.[c]) grid[r][c] = { ...WHITE };
    }
  }
    return { grid, mask, depth, minR, maxR };
}

/** White count / total ring (depth 1) cells within [rowLo, rowHi). */
function ringWhiteFraction(
  grid: StitchGrid,
  depth: number[][],
  rowLo: number,
  rowHi: number,
): { white: number; total: number; fraction: number } {
  let white = 0;
  let total = 0;
  for (let r = rowLo; r < rowHi; r++) {
    for (let c = 0; c < depth[0]?.length ?? 0; c++) {
      if (depth[r]?.[c] === 1 && grid[r]?.[c]?.color !== "") {
        total++;
        if (grid[r][c]!.color.toLowerCase() === "#ffffff") white++;
      }
    }
  }
  return { white, total, fraction: total === 0 ? 0 : white / total };
}

function countColor(grid: StitchGrid, color: string): number {
  let n = 0;
  for (const row of grid) for (const c of row) if (c.color.toLowerCase() === color.toLowerCase()) n++;
  return n;
}

describe("edgeHaloFill — retest #4 stocking white lip", () => {
  it("clears the depth-1 ring in the leg region while keeping cap/toe/snowflake", () => {
    const { grid, mask, depth, minR, maxR } = buildStockingFixture(120, 180);
    const height = grid.length;
    const width = grid[0]!.length;
    const capHi = minR + 25;      // first row of the blue leg
    const toeLo = maxR - 14;      // first row of the white toe
    const before = ringWhiteFraction(grid, depth, 0, height);
    // The anatomy is deliberately a full white ring on a blue body.
    expect(before.total).toBeGreaterThan(0);
    const whiteBeforeTotal = countColor(grid, "#ffffff");
    const capWhiteBefore = ringWhiteFraction(grid, depth, 0, capHi).white;
    const toeWhiteBefore = ringWhiteFraction(grid, depth, toeLo, height).white;

    const out = edgeHaloFill(grid, "stocking", width, height);

    // Leg ring (the middle band region) white fraction collapses.
    const after = ringWhiteFraction(out, depth, capHi, toeLo);
    expect(after.fraction).toBeLessThan(0.05);
    // Overall ring feels like a body: blue dominates the ring now.
    expect(countColor(out, "#2e609d")).toBeGreaterThan(countColor(grid, "#2e609d"));
    // Cap and toe rings stay white (her real grid: 134→133 cap, 197→171 toe).
    expect(ringWhiteFraction(out, depth, 0, capHi).white).toBeGreaterThanOrEqual(capWhiteBefore * 0.9);
    expect(ringWhiteFraction(out, depth, toeLo, height).white).toBeGreaterThanOrEqual(toeWhiteBefore * 0.9);
    // No white was created anywhere — only recolored.
    expect(countColor(out, "#ffffff")).toBeLessThanOrEqual(whiteBeforeTotal);
    // Deep interior snowflake cells unchanged (their depth is far above the
    // 8-cell band gate).
    let snowflakeUnchanged = 0;
    let snowflakeTotal = 0;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const d = depth[r]?.[c] ?? 0;
        if (grid[r]?.[c]?.color.toLowerCase() === "#ffffff" && d >= 9) {
          snowflakeTotal++;
          if (out[r]?.[c]?.color.toLowerCase() === "#ffffff") snowflakeUnchanged++;
        }
      }
    }
    expect(snowflakeTotal).toBeGreaterThan(0);
    expect(snowflakeUnchanged).toBe(snowflakeTotal);
  });

  it("is byte-identical for non-stocking shapes (returns the same reference)", () => {
    const { grid, mask } = buildStockingFixture(120, 180);
    void mask;
    const asOrnament = edgeHaloFill(grid, "ornament", 70, 110);
    const asPillow = edgeHaloFill(grid, "pillow", 70, 110);
    expect(asOrnament).toBe(grid);
    expect(asPillow).toBe(grid);
  });

  it("leaves a 'white background' stocking untouched (no non-white cup exists)", () => {
    const { grid, mask } = buildStockingFixture(120, 180);
    // Remove every non-white cell → an all-white stocking on white.
    const whiteOnly = grid.map((row) => row.map((c) => (c.color === "" ? { ...CANVAS } : { ...WHITE })));
    const out = edgeHaloFill(whiteOnly, "stocking", 70, 110);
    expect(JSON.stringify(out)).toBe(JSON.stringify(whiteOnly));
    void mask;
  });

  it("is deterministic: identical inputs give identical outputs", () => {
    const { grid } = buildStockingFixture(120, 180);
    const a = edgeHaloFill(grid, "stocking", 120, 180);
    const b = edgeHaloFill(grid, "stocking", 120, 180);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).not.toBe(grid);
  });

  it("never mutates the input grid", () => {
    const { grid } = buildStockingFixture(120, 180);
    const snapshot = JSON.stringify(grid);
    edgeHaloFill(grid, "stocking", 120, 180);
    expect(JSON.stringify(grid)).toBe(snapshot);
  });

/**
 * White-washed fixture (owner 10-09 17:30Z verdict #2): her NEW source painted
 * a WHITE stocking on a blue background — inside the clipped silhouette a 12+
 * cell white transition band surrounds a blue core (measured on the real
 * 7f8d5a97 save: ring1 72%, ring3 68%, ring8 48%, ring12 33% white at the
 * SOURCE). The prompt declared the body blue ("blue background ... white top
 * and white toe"), so stockingBodyDirective fires → trimLegWhites must paint
 * the LEG band to the interior color while keeping the cap/toe and ANY
 * interior snowflake islands (the detail the owner wants back).
 */
function buildWashedStockingFixture(
  width: number,
  height: number,
  band = 12,
): { grid: StitchGrid; mask: boolean[][]; depth: number[][]; flakeCells: number } {
  const mask = buildProductSilhouette("stocking", width, height);
  const grid: StitchGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...WHITE })),
  );
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!mask[r][c]) grid[r][c] = { ...CANVAS };
    }
  }
  const depth = edgeHaloDepth(grid, mask);
  // Blue core: everything deeper than the wash band becomes the body color.
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r][c] ?? 0;
      if (d > band) grid[r][c] = { ...BLUE };
    }
  }
  // Four detached 3x3 snowflake islands inside the blue core (leg depth
  // plateau >= 15) — the detail that must SURVIVE the trim. Find the deepest
  // cell, then scatter four 3x3 blocks around it (spacing 8, so they never
  // touch the depth>=13 boundary or each other).
  let dr = 0;
  let dc = 0;
  let best = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const d = depth[r]?.[c] ?? 0;
      if (d > best) { best = d; dr = r; dc = c; }
    }
  }
  const spots: Array<[number, number]> = [
    [dr, dc],
    [dr - 8, dc - 8],
    [dr + 8, dc + 4],
    [dr - 4, dc + 10],
  ];
  let flakeCells = 0;
  for (const [r0, c0] of spots) {
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (mask[r]?.[c] && (depth[r]?.[c] ?? 0) >= 13) {
          grid[r][c] = { ...WHITE };
          flakeCells++;
        }
      }
    }
  }
  expect(flakeCells).toBeGreaterThanOrEqual(4 * 8); // at least ~4 solid flakes
  return { grid, mask, depth, flakeCells };
}
describe("edgeHaloFill — trimLegWhites (white-washed source, body-color prompt)", () => {
  const W = 120;
  const H = 180;
  it("collapses the leg ring to <5% while keeping cap/toe and interior flakes", () => {
    const { grid, depth, flakeCells } = buildWashedStockingFixture(W, H, 12);
    // The trim row band IS the acceptance leg region (real grid: rows 70-195 of
    // 238 ≈ 0.29-0.82 — the cuff ends ~55, the toe starts ~187/195 and the old
    // 0.87 hi would EAT it). Measure against the SAME constants the fill uses.
    const capHi = Math.floor(H * EDGE_HALO_TRIM_ROW_LO_FRAC);
    const toeLo = Math.floor(H * EDGE_HALO_TRIM_ROW_HI_FRAC);
    const before = ringWhiteFraction(grid, depth, capHi, toeLo);
    expect(before.fraction).toBeGreaterThan(0.3); // genuinely washed
    const capWhiteBefore = ringWhiteFraction(grid, depth, 0, capHi).white;
    const toeWhiteBefore = ringWhiteFraction(grid, depth, toeLo, H).white;
    const out = edgeHaloFill(grid, "stocking", W, H, { trimLegWhites: true });
    const after = ringWhiteFraction(out, depth, capHi, toeLo);
    expect(after.fraction).toBeLessThan(0.05);
    // Cap and toe rows stay white.
    expect(ringWhiteFraction(out, depth, 0, capHi).white).toBeGreaterThanOrEqual(capWhiteBefore * 0.9);
    expect(ringWhiteFraction(out, depth, toeLo, H).white).toBeGreaterThanOrEqual(toeWhiteBefore * 0.9);
    // All interior flake cells survive (isolated islands, density < 0.5).
    let intact = 0;
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const d = depth[r]?.[c] ?? 0;
        if (grid[r]?.[c]?.color.toLowerCase() === "#ffffff" && d >= 13) {
          if (out[r]?.[c]?.color.toLowerCase() === "#ffffff") intact++;
        }
      }
    }
    expect(intact).toBe(flakeCells);
    // Whites were only REMOVED, never added; the body grew.
    expect(countColor(out, "#ffffff")).toBeLessThan(countColor(grid, "#ffffff"));
    expect(countColor(out, "#2e609d")).toBeGreaterThan(countColor(grid, "#2e609d"));
  });
  it("is deterministic and never mutates the input (with trimLegWhites)", () => {
    const { grid } = buildWashedStockingFixture(W, H, 12);
    const snapshot = JSON.stringify(grid);
    const a = edgeHaloFill(grid, "stocking", W, H, { trimLegWhites: true });
    const b = edgeHaloFill(grid, "stocking", W, H, { trimLegWhites: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).not.toBe(grid);
    expect(JSON.stringify(grid)).toBe(snapshot);
  });
  it("is a no-op when there is no non-white cup (white-background prompt)", () => {
    const { grid } = buildWashedStockingFixture(W, H, 12);
    const whiteOnly = grid.map((row) => row.map((c) => (c.color === "" ? { ...CANVAS } : { ...WHITE })));
    const out = edgeHaloFill(whiteOnly, "stocking", W, H, { trimLegWhites: true });
    expect(JSON.stringify(out)).toBe(JSON.stringify(whiteOnly));
  });
  it("never trims for non-stocking shapes even with the option", () => {
    const { grid } = buildWashedStockingFixture(W, H, 12);
    const asOrnament = edgeHaloFill(grid, "ornament", W, H, { trimLegWhites: true });
    const asPillow = edgeHaloFill(grid, "pillow", W, H, { trimLegWhites: true });
    expect(asOrnament).toBe(grid);
    expect(asPillow).toBe(grid);
  });
});
  it("carries the body's dmc metadata onto recolored cells (palette consistency)", () => {
    const { grid } = buildStockingFixture(120, 180);
    const out = edgeHaloFill(grid, "stocking", 120, 180);
    const recolored = out
      .map((row, r) => row.map((c, i) => [r, i, c] as const))
      .flat()
      .filter(([, , c]) => c.color.toLowerCase() === "#2e609d");
    expect(recolored.length).toBeGreaterThan(0);
    for (const [, , c] of recolored) {
      expect(c.dmcCode).toBe("799");
      expect(c.dmcName).toBe("Delft Blue");
    }
  });
});

describe("edgeHaloFill constants are documented invariants", () => {
  it("band depth gate matches the measured 6-8 cell halo (rounded to 8)", () => {
    expect(EDGE_HALO_MAX_DEPTH).toBe(8);
    expect(EDGE_HALO_THICK_RUN).toBe(9);
  });
});