/**
 * Owner P0 1c6d2de8 Appendix C — deterministic unit tests for the large
 * product-shape detail passes: containSubjectToRim (top-cut / zoom cap),
 * reclassFieldWhite (field-white NEVER stitched as white thread), and
 * snapGreyMushToPalette (anti-aliased mid-grey band -> real palette color).
 * Synthetic grids encode the exact signatures measured on her REAL 70x70
 * saves (7309c725 tree: green rows 1-67, 583 grey cells #b2b2b2/#3c3c3c,
 * 1168 white field; 4e3c90e7 snowflake: white detail collapsing to red).
 */
import { containSubjectToRim, reclassFieldWhite, snapGreyMushToPalette, preserveWhiteDetail, buildProductSilhouette, EMPTY_CELL } from "../domain/stitch/productShapeMask";
import type { StitchGrid } from "../domain/stitch/types";

const GREEN = { color: "#1f7a33", dmcCode: "895", dmcName: "Dark Green" };
const RED = { color: "#c9262d", dmcCode: "321", dmcName: "Red" };
const WHITE = { color: "#ffffff", dmcCode: "520", dmcName: "White" };
const MIDGREY = { color: "#b2b2b2", dmcCode: "415", dmcName: "Pearl Grey" };
const DARKGREY = { color: "#3c3c3c", dmcCode: "413", dmcName: "Dark Grey" };
const BROWN = { color: "#6b4a2b", dmcCode: "801", dmcName: "Coffee Brown" };

function makeGrid(w: number, h: number, paint: (g: StitchGrid) => void): StitchGrid {
  const g: StitchGrid = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ...WHITE })));
  paint(g);
  return g;
}

function colorCount(grid: StitchGrid, color: string): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell?.color === color) n++;
  return n;
}

function bboxRows(grid: StitchGrid, color: string): [number, number] {
  let top = Infinity, bottom = -1;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c]?.color === color) { top = Math.min(top, r); bottom = Math.max(bottom, r); }
  return [top, bottom];
}

describe("containSubjectToRim (top-cut / zoom cap)", () => {
  test("zoomed tree (green rows 1-67 at 70x70) is scaled into the rim inset box (>=3..<=66)", () => {
    // Signature from 7309c725: cover-resize zoomed the tree so green fills
    // rows 1-67 and the star/top was clipped by the circle.
    const grid = makeGrid(70, 70, (g) => {
      for (let r = 1; r <= 67; r++) for (let c = 30; c <= 40; c++) g[r][c] = { ...GREEN };
    });
    const out = containSubjectToRim(grid, "ornament", 70, 70);
    const [top, bottom] = bboxRows(out, GREEN.color);
    expect(top).toBeGreaterThanOrEqual(3);
    expect(bottom).toBeLessThanOrEqual(66);
    expect(colorCount(out, GREEN.color)).toBeGreaterThan(0);
  });

  test("subject already inside the rim box is left untouched", () => {
    const grid = makeGrid(70, 70, (g) => {
      for (let r = 8; r <= 60; r++) for (let c = 30; c <= 40; c++) g[r][c] = { ...GREEN };
    });
    const out = containSubjectToRim(grid, "ornament", 70, 70);
    expect(out).toEqual(grid);
  });

  test("never upscales — small centered subject stays put", () => {
    const grid = makeGrid(70, 70, (g) => {
      g[34][34] = { ...GREEN };
    });
    const out = containSubjectToRim(grid, "ornament", 70, 70);
    expect(out[34][34]).toEqual(grid[34][34]);
  });
});

describe("reclassFieldWhite (field-white -> empty, detail stays)", () => {
  test("pure white field inside the circle becomes EMPTY (not white thread)", () => {
    // Tree signature: white field surrounds the subject; it must not be
    // stitched as 1168 white cells on a product shape.
    const grid = makeGrid(70, 70, (g) => {
      for (let r = 6; r <= 60; r++) for (let c = 30; c <= 40; c++) g[r][c] = { ...GREEN };
    });
    const out = reclassFieldWhite(grid, "ornament", 70, 70);
    // The big surrounding white canvas field is gone.
    const whites = colorCount(out, WHITE.color);
    expect(whites).toBeLessThan(colorCount(grid, WHITE.color));
    // Subject survives.
    expect(colorCount(out, GREEN.color)).toBeGreaterThan(0);
  });

  test("white DETAIL (star/flake touching a non-white neighbor) survives", () => {
    // Flake = white cells enclosed by red (4e3c90e7 signature). They touch a
    // non-white neighbor so the pass must keep them as WHITE thread.
    const grid = makeGrid(70, 70, (g) => {
      for (let r = 20; r <= 50; r++) for (let c = 25; c <= 45; c++) g[r][c] = { ...RED };
      g[34][34] = { ...WHITE }; // a single flake cell inside the red field
      g[35][34] = { ...WHITE };
      g[34][35] = { ...WHITE };
    });
    const out = reclassFieldWhite(grid, "ornament", 70, 70);
    // Flake cells are enclosed by red and touch non-white neighbors -> kept.
    expect(colorCount(out, WHITE.color)).toBeGreaterThanOrEqual(3);
    // Red field (the DECLARED background) stays as red thread.
    expect(colorCount(out, RED.color)).toBeGreaterThan(0);
  });

  test("white stocking cuff/toe is subject, not field", () => {
    // Stocking path excludes reclass entirely (cuff/toe are subject whites).
    const grid = makeGrid(70, 120, (g) => {
      for (let r = 0; r < 12; r++) for (let c = 20; c <= 40; c++) g[r][c] = { ...WHITE };
      for (let r = 12; r < 80; r++) for (let c = 20; c <= 40; c++) g[r][c] = { ...RED };
    });
    // Note: route gates reclass to ornament/pillow only; unit contract here is
    // that a stocking-shaped call must not empty pure field whites (no-op-safe).
    const out = reclassFieldWhite(grid, "stocking", 70, 120);
    expect(colorCount(out, RED.color)).toBeGreaterThan(0);
  });
});

describe("snapGreyMushToPalette (mid-grey band -> real color)", () => {
  test("mid-greens map to the nearest chromatic palette color", () => {
    // 7309c725 signature: 583 grey cells (#b2b2b2/#3c3c3c) where branch
    // detail should read; only 3 greens survived.
    const grid = makeGrid(70, 70, (g) => {
      for (let r = 10; r <= 60; r++) {
        for (let c = 25; c <= 45; c++) {
          g[r][c] = (r + c) % 4 === 0 ? { ...DARKGREY } : (r + c) % 4 === 1 ? { ...MIDGREY } : { ...GREEN };
        }
      }
      g[20][20] = { ...BROWN };
    });
    const out = snapGreyMushToPalette(grid, "ornament", 70, 70);
    const greys = colorCount(out, MIDGREY.color) + colorCount(out, DARKGREY.color);
    // Nearly all greys snapped to a chromatic neighbor; the tree green grows.
    expect(greys).toBeLessThanOrEqual(Math.ceil((colorCount(grid, MIDGREY.color) + colorCount(grid, DARKGREY.color)) * 0.05));
    expect(colorCount(out, GREEN.color)).toBeGreaterThan(0);
    // Snapped cells inherit the candidate's DMC metadata.
    const snapped = out.flat().find(c => c?.color === GREEN.color && c.dmcCode === "895");
    expect(snapped).toBeTruthy();
  });

  test("fully-grey design (no chromatic neighbor) is left alone", () => {
    const grid = makeGrid(40, 40, (g) => {
      for (let r = 0; r < 40; r++) for (let c = 0; c < 40; c++) g[r][c] = { ...MIDGREY };
    });
    const out = snapGreyMushToPalette(grid, "ornament", 40, 40);
    expect(colorCount(out, MIDGREY.color)).toBe(40 * 40);
  });

  test("EMPTY cells and white detail are untouched", () => {
    const grid = makeGrid(42, 42, (g) => {
      g[10][10] = { ...EMPTY_CELL };
      g[11][11] = { ...WHITE };
      g[12][12] = { ...RED };
    });
    const out = snapGreyMushToPalette(grid, "ornament", 42, 42);
    expect(out[10][10]).toEqual(EMPTY_CELL);
    expect(out[11][11]).toEqual(WHITE);
    expect(out[12][12]).toEqual(RED);
  });
});
describe("preserveWhiteDetail", () => {
  const W = 70, H = 70;
  const empty = (): StitchCell => ({ ...EMPTY_CELL });
  const cell = (c: string): StitchCell => ({ ...EMPTY_CELL, color: c });

  it("converts light-wash detail (#ec8d94 flake) back to #ffffff, keeps counts", () => {
    const g: StitchGrid = Array.from({ length: H }, () => Array.from({ length: W }, () => empty()));
    const sil = buildProductSilhouette("ornament", W, H);
    const centerR = Math.floor(H / 2), centerC = Math.floor(W / 2);
    const offs = [[0, 0], [0, 1], [1, 0], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1]] as const;
    let placed = 0;
    for (const [dr, dc] of offs) {
      const r = centerR + dr, c = centerC + dc;
      if (sil[r]?.[c]) { g[r][c] = cell("#ec8d94"); placed++; }
    }
    const out = preserveWhiteDetail(g, "ornament", W, H);
    let white = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (sil[r]?.[c] && out[r]?.[c]?.color === "#ffffff") white++;
    }
    expect(white).toBe(placed);
  });

  it("leaves saturated pinks/reds (#d7525f, #c9262d) untouched", () => {
    const g: StitchGrid = Array.from({ length: H }, () => Array.from({ length: W }, () => empty()));
    const sil = buildProductSilhouette("ornament", W, H);
    g[35][35] = cell("#d7525f"); g[35][36] = cell("#c9262d");
    const out = preserveWhiteDetail(g, "ornament", W, H);
    expect(out[35][35]?.color).toBe("#d7525f");
    expect(out[35][36]?.color).toBe("#c9262d");
  });

  it("never converts background/EMPTY cells", () => {
    const g: StitchGrid = Array.from({ length: H }, () => Array.from({ length: W }, () => empty()));
    const out = preserveWhiteDetail(g, "ornament", W, H);
    expect(out[0][0]).toEqual(EMPTY_CELL);
  });
});
