import { applyProductShapeMask, buildProductSilhouette, magnifyToFillShape, clipShapeEdge, enforceSnowflakeDefinition } from "../domain/stitch/productShapeMask";
import { enforceCharmFacePostClip } from "../domain/stitch/charmFacePostClip";
import { recenterGrid } from "../domain/stitch/recenterGrid";
import type { StitchCell } from "../domain/stitch/types";

const RED: StitchCell = { color: "#cc2222", dmcCode: "321", dmcName: "Red" };
const BLUE: StitchCell = { color: "#2244cc", dmcCode: "798", dmcName: "Blue" };
const WHITE: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };

function makeGrid(w: number, h: number, fill: StitchCell): StitchCell[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ...fill })));
}
function nonEmptyRowTop(grid: StitchCell[][]): number {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c]?.color && grid[r][c].color !== "#ffffff") return r;
    }
  }
  return -1;
}

describe("buildProductSilhouette", () => {
  it("ornament circle leaves corners outside the mask", () => {
    const mask = buildProductSilhouette("ornament", 40, 40);
    // corners must be empty
    expect(mask[0][0]).toBe(false);
    expect(mask[0][39]).toBe(false);
    expect(mask[39][0]).toBe(false);
    expect(mask[39][39]).toBe(false);
    // center must be inside
    expect(mask[20][20]).toBe(true);
  });

  it("pillow rounded-rect leaves corners outside the mask", () => {
    const mask = buildProductSilhouette("pillow", 40, 40);
    expect(mask[0][0]).toBe(false);
    expect(mask[0][39]).toBe(false);
    expect(mask[39][39]).toBe(false);
    // center + near-edge-midpoints inside
    expect(mask[20][20]).toBe(true);
    expect(mask[20][37]).toBe(true); // mid right edge (straight segment), inside
  });

  it("stocking silhouette is non-trivial and contained", () => {
    const mask = buildProductSilhouette("stocking", 100, 140);
    const anyInside = mask.some(row => row.some(v => v));
    expect(anyInside).toBe(true);
    // toe (bottom) region non-empty, absolute corner empty
    expect(mask[139][99]).toBe(false);
  });
});

describe("applyProductShapeMask", () => {
  it("ornament clip clears the corners of a full-bleed scene", () => {
    // Full-canvas red (simulates a full-bleed AI scene).
    const grid = makeGrid(40, 40, RED);
    const out = applyProductShapeMask(grid, "ornament", 40, 40);
    // corners outside the circle cleared to white
    expect(out[0][0].color).toBe(WHITE.color);
    expect(out[0][39].color).toBe(WHITE.color);
    expect(out[39][39].color).toBe(WHITE.color);
    // center inside stays red
    expect(out[20][20].color).toBe(RED.color);
  });

  it("pillow rounded-rect clip clears the corners", () => {
    const grid = makeGrid(40, 40, BLUE);
    const out = applyProductShapeMask(grid, "pillow", 40, 40);
    expect(out[0][0].color).toBe(WHITE.color);
    expect(out[0][39].color).toBe(WHITE.color);
    expect(out[39][39].color).toBe(WHITE.color);
    expect(out[20][20].color).toBe(BLUE.color);
  });

  it("enclosed interior BFS fill fills a donut hole to nearest color", () => {
    // 20x20: red square ring (rows/cols 5..14, border only) inside the pillow
    // silhouette, surrounding a white interior. The hole is enclosed (not
    // reachable from exterior through background) -> filled red.
    const grid = makeGrid(20, 20, WHITE);
    for (let r = 5; r <= 14; r++) {
      for (let c = 5; c <= 14; c++) {
        if (r === 5 || r === 14 || c === 5 || c === 14) grid[r][c] = { ...RED };
      }
    }
    const out = applyProductShapeMask(grid, "pillow", 20, 20);
    // the enclosed interior hole (center) gets filled with red
    expect(out[10][10].color).toBe(RED.color);
  });

  it("idempotent — running twice yields the same grid", () => {
    const grid = makeGrid(40, 40, RED);
    const once = applyProductShapeMask(grid, "ornament", 40, 40);
    const twice = applyProductShapeMask(once, "ornament", 40, 40);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  it("recenter + mask composition — full-bleed scene becomes centered silhouette with zero cells at edges", () => {
    // Full-bleed blue scene; recenter (no-op, already full) then ornament mask.
    const grid = makeGrid(50, 50, BLUE);
    const recentered = recenterGrid(grid);
    const out = applyProductShapeMask(recentered, "ornament", 50, 50);
    // Every edge cell is white background (zero content at canvas edges).
    for (let c = 0; c < 50; c++) {
      expect(out[0][c].color).toBe(WHITE.color);
      expect(out[49][c].color).toBe(WHITE.color);
    }
    for (let r = 0; r < 50; r++) {
      expect(out[r][0].color).toBe(WHITE.color);
      expect(out[r][49].color).toBe(WHITE.color);
    }
    // Content remains in the center.
    expect(out[25][25].color).toBe(BLUE.color);
  });

  it("does not mutate the input grid", () => {
    const grid = makeGrid(40, 40, RED);
    const snapshot = JSON.stringify(grid);
    applyProductShapeMask(grid, "ornament", 40, 40);
    expect(JSON.stringify(grid)).toBe(snapshot);
  });
});

describe("magnifyToFillShape top-gap trigger (P0 4dfb1359)", () => {
  it("does not touch a dense subject already at the shape top", () => {
    // subject STARTS at row 0 (top<=1): rows 0-1 red, rows 2-3 white.
    const atTop = makeGrid(28, 28, RED);
    for (let r0 = 2; r0 <= 3; r0++) for (let c = 0; c < 28; c++) atTop[r0][c] = { ...WHITE };
    const snapshot = JSON.stringify(atTop);
    const out = magnifyToFillShape(atTop, "ornament", 28, 28);
    expect(JSON.stringify(out)).toBe(snapshot); // dense AND top<=1 → skip
  });

  it("magnifies a dense subject stranded below a white cap", () => {
    const grid = makeGrid(28, 28, RED);
    // full-width white sky rows 0-2 → subject starts at row 3
    for (let r0 = 0; r0 <= 2; r0++) for (let c = 0; c < 28; c++) grid[r0][c] = { ...WHITE };
    const out = magnifyToFillShape(grid, "ornament", 28, 28);
    expect(JSON.stringify(out)).not.toBe(JSON.stringify(grid));
    // content must have moved UP: first non-white row strictly less than before
    const beforeTop = nonEmptyRowTop(grid);
    const afterTop = nonEmptyRowTop(out);
    expect(afterTop).toBeLessThan(beforeTop);
  });
});

describe("clipShapeEdge corner-convention clip (P0 4dfb1359)", () => {
  it("empties the corner-straddling ring but keeps interior geometry", () => {
    const grid = makeGrid(28, 28, BLUE);
    const out = clipShapeEdge(grid, "ornament", 28, 28);
    // (13,0) has corner-d ~14.04 > r13 → emptied
    expect(out[0][13]?.color).toBe("");
    // (13,2) corner-d ~12.04 <= 13 → kept
    expect(out[2][13]?.color).toBe(BLUE.color);
    // center kept
    expect(out[13][13]?.color).toBe(BLUE.color);
  });

  it("returns non-ornament shapes unchanged", () => {
    const grid = makeGrid(28, 28, BLUE);
    const out = clipShapeEdge(grid, "pillow", 28, 28);
    expect(JSON.stringify(out)).toBe(JSON.stringify(grid));
  });

  it("TRUE-corner convention (P0 4dfb1359 b132): row 0 empties, row 1 crown cols stay populated, corner circle respected", () => {
    const grid = makeGrid(28, 28, BLUE);
    const out = clipShapeEdge(grid, "ornament", 28, 28);
    // row 0: farthest corner dy = 13.5 > r = 13 -> the whole row is outside -> emptied
    expect(out[0][13]?.color || "").toBe("");
    // row 1: farthest corner dy = 12.5, so any col with dxMax <= sqrt(169-156.25)
    // (dxMax <= 3.57) survives the true-corner test: cols 10..16 (7 cells; col 13
    // dx 0.5 -> 156.5, col 10 dx 3.5 -> 168.5, both <= 169). b131's half-cell clip
    // wrongly emptied these.
    expect(out[1][13]?.color).toBe(BLUE.color);
    expect(out[1][11]?.color).toBe(BLUE.color);
    expect(out[1][10]?.color).toBe(BLUE.color);
    expect(out[1][16]?.color).toBe(BLUE.color);
    // cols 9 & 17: dxMax = 4.5 -> 176.5 > 169 -> stay outside the corner circle
    expect(out[1][9]?.color || "").toBe("");
    expect(out[1][17]?.color || "").toBe("");
  });
});

describe("enforceSnowflakeDefinition (P0 a9db240b)", () => {
  const gs = 100;
  function stockingBlobGrid(): StitchCell[][] {
    const grid = makeGrid(gs, gs, BLUE);
    // a dense white blob in the body band (rows 38..78 band window at 100)
    for (let r0 = 44; r0 <= 53; r0++) for (let c = 44; c <= 53; c++) grid[r0][c] = { ...WHITE };
    return grid;
  }
  it("is a no-op without a snowflake prompt", () => {
    const grid = stockingBlobGrid();
    const out = enforceSnowflakeDefinition(grid, "stocking", gs, gs, "a blue stocking");
    expect(JSON.stringify(out)).toBe(JSON.stringify(grid));
  });
  it("rewrites the blob into a star with blue gaps and leaves cuff/toe untouched", () => {
    const grid = stockingBlobGrid();
    const before = JSON.stringify(grid);
    const out = enforceSnowflakeDefinition(grid, "stocking", gs, gs, "blue stocking with white snowflakes");
    // cuff (r<16) and toe (r>78) rows are byte-identical
    expect(JSON.stringify(out.slice(0, 16))).toBe(JSON.stringify(grid.slice(0, 16)));
    expect(JSON.stringify(out.slice(79))).toBe(JSON.stringify(grid.slice(79)));
    // blue gaps opened inside the old blob bbox
    let gaps = 0;
    for (let r0 = 44; r0 <= 53; r0++) for (let c = 44; c <= 53; c++) if (out[r0][c]?.color === BLUE.color) gaps++;
    expect(gaps).toBeGreaterThan(0);
    // and the design is sparser (fewer white cells than the full blob)
    const whiteOut = out.flat().filter((c) => c?.color === WHITE.color).length;
    const whiteIn = grid.flat().filter((c) => c?.color === WHITE.color).length;
    expect(whiteOut).toBeLessThan(whiteIn);
    expect(before).toBe(JSON.stringify(grid));
  });
});

describe("enforceCharmFacePostClip face guarantee (P0 4dfb1359 b132)", () => {
  // beige fur is NOT dark (lum ~167 > 70), so a faceless beige charm must trip
  // the audit and receive injected eyes + nose
  const BEIGE: StitchCell = { color: "#c8a26a", dmcCode: "437", dmcName: "Tan" };
  const lum = (c?: StitchCell) => {
    if (!c || !c.color || c.color.length !== 7) return 256;
    return 0.299 * parseInt(c.color.slice(1, 3), 16) + 0.587 * parseInt(c.color.slice(3, 5), 16) + 0.114 * parseInt(c.color.slice(5, 7), 16);
  };
  function spillCount(g: StitchCell[][]): number {
    let n = 0;
    const gw = g[0]?.length ?? 0, gh = g.length;
    const cx = (gw - 1) / 2, cy = (gh - 1) / 2, rad = Math.min(gw, gh) / 2 - Math.max(1, Math.round(0.03 * Math.min(gw, gh)));
    for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) {
      const dx = Math.max(Math.abs(c - cx), Math.abs(c + 1 - cx));
      const dy = Math.max(Math.abs(r - cy), Math.abs(r + 1 - cy));
      if (dx * dx + dy * dy <= rad * rad) continue;
      // crown-row exception: row-0 center-on-arc cells count as inside (stored-convention boundary)
      if (r === 0) {
        const cdx = Math.abs(c + 0.5 - cx);
        const cdy = Math.abs(r + 0.5 - cy);
        if (cdx * cdx + cdy * cdy <= rad * rad) continue;
      }
      if (g[r]?.[c]?.color) n++;
    }
    return n;
  }
  it("injects a mirror-symmetric dark-eye pair + nose into a faceless charm, zero spill", () => {
    const grid = clipShapeEdge(makeGrid(28, 28, BEIGE), "ornament", 28, 28);
    const out = enforceCharmFacePostClip(grid, "ornament", 28, 28);
    // >=2 mirror-symmetric dark pairs in the upper-face band (rows 14-45%)
    let pairs = 0;
    for (let r = Math.max(1, Math.round(28 * 0.14)); r <= Math.round(28 * 0.45); r++) {
      for (let c = Math.round(28 * 0.18); c <= Math.round(28 * 0.82); c++) {
        const mc = 27 - c;
        if (Math.abs(mc - c) >= 4 && lum(out[r]?.[c]) <= 90 && lum(out[r]?.[mc]) <= 90) pairs++;
      }
    }
    expect(pairs).toBeGreaterThanOrEqual(2);
    // nose mark at vertical center (rows 38-58%)
    let nose = false;
    for (let r = Math.round(28 * 0.38); r <= Math.round(28 * 0.58); r++) {
      for (let c = Math.round(28 * 0.42); c <= Math.round(28 * 0.58); c++) {
        if (lum(out[r]?.[c]) <= 90) { nose = true; break; }
      }
      if (nose) break;
    }
    expect(nose).toBe(true);
    // absolute zero-spill invariant
    expect(spillCount(out)).toBe(0);
  });
  it("restores crown rows 0 AND 1 when the subject reaches the top — row 0 col 13 on-arc by center convention (matches stored a4c16a62: 1 cell, col 13)", () => {
    const grid = makeGrid(28, 28, { color: "", dmcCode: undefined, dmcName: undefined });
    for (let r = 2; r < 28; r++) for (let c = 0; c < 28; c++) grid[r][c] = { ...BLUE };
    const clipped = clipShapeEdge(grid, "ornament", 28, 28);
    const out = enforceCharmFacePostClip(clipped, "ornament", 28, 28);
    // row 1 crown restored (true-corner cols 11..16 at dy=12.5)
    expect(out[1][13]?.color).toBe(BLUE.color);
    expect(out[1][11]?.color).toBe(BLUE.color);
    // row 0: col 13's center (dy 13.0, dx 0 -> 169 <= 169) lies exactly on the
    // circle top arc (y = cy - r = 0.5) — the same center convention that put
    // the 1 cell in the STORED a4c16a62 grid. Cell-for-cell reproduction.
    expect(out[0][13]?.color).toBe(BLUE.color);
    // and only col 13: cols 12/14 have center dx 1 -> 170 > 169
    expect(out[0][12]?.color || "").toBe("");
    expect(out[0][14]?.color || "").toBe("");
    expect(spillCount(out)).toBe(0); // spill metric treats crown-row on-arc cells as inside
  });
});
