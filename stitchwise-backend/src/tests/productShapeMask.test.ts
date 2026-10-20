import { applyProductShapeMask, buildProductSilhouette, magnifyToFillShape, clipShapeEdge, enforceSnowflakeDefinition } from "../domain/stitch/productShapeMask";
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

  it("keeps rows 0-1 empty (geometry fact: they are never inside the corner circle)", () => {
    const grid = makeGrid(28, 28, BLUE);
    const out = clipShapeEdge(grid, "ornament", 28, 28);
    expect(out[0][13]?.color || "").toBe("");
    expect(out[1][13]?.color || "").toBe("");
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
