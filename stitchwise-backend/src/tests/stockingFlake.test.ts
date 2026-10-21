/**
 * b133 Fix D — stocking snowflake DEFINITION on her real palette.
 *
 * Owner b132 save (9de3c62a): 20.5–26.7k EMPTY cells, only #2e609d/#6c95c4/
 * white, 0 six-sector stars, in-band white comps [562, 225, 79, 4, 4] — the
 * white-on-mid-blue flakes never defined ("weird white lines"). Fix D draws
 * arms in a CONTRAST dark steel-blue #113b69 (DMC-recountable) and hardens
 * the audit: fail → rotate retry (3 angles) → erase, so no undefined blob
 * ever reaches the saved grid. Gates asserted here on a synthetic stocking
 * body that mirrors her canvas geometry (100 rows → band rows 16–78).
 */
import { describe, it, expect } from "@jest/globals";
import { enforceSnowflakeDefinition, buildProductSilhouette } from "../domain/stitch/productShapeMask";
import type { StitchCell } from "../domain/stitch/types";

const BODY = "#2e609d";
const ARM = "#113b69";

function whiteCompMax(grid: StitchCell[][], width: number, height: number): { max: number; arms: number; armedSectors: number } {
  const isW = (c: StitchCell | undefined) => !!c && c.color.toLowerCase() === "#ffffff";
  const isA = (c: StitchCell | undefined) => !!c && c.color.toLowerCase() === ARM;
  const seen = Array.from({ length: height }, () => new Array<boolean>(width).fill(false));
  let max = 0;
  let arms = 0;
  let acr = 0, acc = 0, acn = 0;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isA(grid[r]?.[c])) { arms++; acr += r; acc += c; acn++; }
      if (seen[r][c] || !isW(grid[r]?.[c])) continue;
      const q: Array<[number, number]> = [[r, c]];
      seen[r][c] = true;
      let n = 0;
      while (q.length) {
        const [rr, cc] = q.pop()!;
        n++;
        for (const [d1, d2] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nr = rr + d1, nc = cc + d2;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width && !seen[nr][nc] && isW(grid[nr]?.[nc])) {
            seen[nr][nc] = true;
            q.push([nr, nc]);
          }
        }
      }
      if (n > max) max = n;
    }
  }
  // Largest arm-cluster sector coverage (radius ≥ 0.5×max arm radius).
  let armedSectors = 0;
  for (const [r, c] of flattenArmCells(grid, width, height)) {
    if (acn === 0) break;
  }
  if (acn > 0) {
    const cr = Math.round(acr / acn), cc = Math.round(acc / acn);
    let maxR2 = 0;
    for (const [r, c] of flattenArmCells(grid, width, height)) {
      const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      if (d > maxR2) maxR2 = d;
    }
    const sect = new Set<number>();
    for (const [r, c] of flattenArmCells(grid, width, height)) {
      if (acn === 0) break;
      const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
      if (d < maxR2 * 0.25) continue;
      const a = ((Math.atan2(r - cr, c - cc) * 180) / Math.PI + 360) % 360;
      sect.add(Math.min(5, Math.floor(a / 60)));
    }
    armedSectors = sect.size;
  }
  return { max, arms, armedSectors };
}

function flattenArmCells(grid: StitchCell[][], width: number, height: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cell = grid[r]?.[c];
      if (cell && cell.color.toLowerCase() === ARM) out.push([r, c]);
    }
  }
  return out;
}

function stockingWithWhiteBlob(): StitchCell[][] {
  const width = 60, height = 100;
  const grid: StitchCell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ color: BODY, dmcCode: "799", dmcName: "Blue" })),
  );
  // A large white blob inside the flake band (rows 16–78% of the canvas).
  for (let r = 28; r <= 60; r++) {
    for (let c = 18; c <= 41; c++) {
      if (grid[r]?.[c]) grid[r][c] = { color: "#ffffff", dmcCode: "520", dmcName: "White" };
    }
  }
  return grid;
}

describe("enforceSnowflakeDefinition — b133 Fix D (dark arms, hard audit)", () => {
  it("never lets an undefined in-band white comp > 15 cells survive", () => {
    const width = 60, height = 100;
    const grid = stockingWithWhiteBlob();
    const out = enforceSnowflakeDefinition(grid, "stocking", width, height, "blue stocking with snowflakes");
    const { max } = whiteCompMax(out, width, height);
    expect(max).toBeLessThanOrEqual(15);
  });

  it("draws contrast dark-blue arms (≥ 20 cells) with ≥ 5 armed sectors", () => {
    const width = 60, height = 100;
    const out = enforceSnowflakeDefinition(stockingWithWhiteBlob(), "stocking", width, height, "blue stocking with snowflakes");
    const { arms, armedSectors } = whiteCompMax(out, width, height);
    expect(arms).toBeGreaterThanOrEqual(20);
    expect(armedSectors).toBeGreaterThanOrEqual(5);
  });

  it("a 759-cell white blob (≈ her 562-cell case) becomes a clean star field", () => {
    const width = 60, height = 100;
    const out = enforceSnowflakeDefinition(stockingWithWhiteBlob(), "stocking", width, height, "blue stocking with snowflakes");
    const { max, arms, armedSectors } = whiteCompMax(out, width, height);
    expect(max).toBeLessThanOrEqual(15);
    expect(arms).toBeGreaterThanOrEqual(20);
    expect(armedSectors).toBeGreaterThanOrEqual(5);
  });

  it("non-snowflake prompts pass through unchanged", () => {
    const grid = stockingWithWhiteBlob();
    const out = enforceSnowflakeDefinition(grid, "stocking", 60, 100, "a blue teddy bear");
    const { max } = whiteCompMax(out, 60, 100);
    expect(max).toBeGreaterThan(100); // untouched blob still there
  });
});