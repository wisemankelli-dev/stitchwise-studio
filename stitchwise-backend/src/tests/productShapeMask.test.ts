import { applyProductShapeMask, buildProductSilhouette } from "../domain/stitch/productShapeMask";
import { recenterGrid } from "../domain/stitch/recenterGrid";
import type { StitchCell } from "../domain/stitch/types";

const RED: StitchCell = { color: "#cc2222", dmcCode: "321", dmcName: "Red" };
const BLUE: StitchCell = { color: "#2244cc", dmcCode: "798", dmcName: "Blue" };
const WHITE: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };

function makeGrid(w: number, h: number, fill: StitchCell): StitchCell[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ...fill })));
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
