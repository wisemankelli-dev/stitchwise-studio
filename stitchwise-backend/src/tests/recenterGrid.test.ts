/**
 * Deterministic content recenter — unit tests.
 *
 * Owner 09-15: generated snowflake ornament "is not centered and left white
 * edge" — Gemini image variance can draw the subject off-center and the
 * pixel→grid conversion carries the offset through. `recenterGrid` shifts the
 * whole grid so the content bbox centers on the canvas.
 */
import { describe, it, expect } from "@jest/globals";
import { recenterGrid, isBackgroundCell } from "../domain/stitch/recenterGrid";
import type { StitchCell, StitchGrid } from "../domain/stitch/types";

const RED: StitchCell = { color: "#e11d48", dmcCode: "321", dmcName: "Christmas Red" };
const WHITE: StitchCell = { color: "#ffffff", dmcCode: "520", dmcName: "White" };
const NEAR_WHITE: StitchCell = { color: "#fcfcfc", dmcCode: "ecru", dmcName: "Ecru" };

/** Build a w×h grid; `fill` returns a content cell or null for background. */
function makeGrid(
  w: number,
  h: number,
  fill: (r: number, c: number) => StitchCell | null,
): StitchGrid {
  const g: StitchGrid = [];
  for (let r = 0; r < h; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < w; c++) row.push(fill(r, c) ?? { ...WHITE });
    g.push(row);
  }
  return g;
}

/** Content bounding box using the same background rule as the recenter. */
function bboxOf(grid: StitchGrid): { top: number; bottom: number; left: number; right: number } | null {
  const H = grid.length;
  const W = grid[0]?.length ?? 0;
  let top = H, bottom = -1, left = W, right = -1;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (isBackgroundCell(grid[r]?.[c])) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  return bottom < top ? null : { top, bottom, left, right };
}

function countRed(grid: StitchGrid): number {
  let n = 0;
  for (const row of grid) for (const cell of row) if (cell?.color === RED.color) n++;
  return n;
}

describe("recenterGrid", () => {
  it("recenters left-biased content to symmetric margins (42×42, content cols 0..29)", () => {
    // Content: cols 0..29, rows 10..31 — left-biased (right 12 empty cols).
    const grid = makeGrid(42, 42, (r, c) =>
      c >= 0 && c <= 29 && r >= 10 && r <= 31 ? { ...RED } : null,
    );
    const before = countRed(grid);
    const out = recenterGrid(grid);
    const box = bboxOf(out)!;
    // Left edge shifts +6 → content now cols 6..35, rows unchanged.
    expect(box).toEqual({ top: 10, bottom: 31, left: 6, right: 35 });
    // Symmetric margins on both axes.
    expect(box.left).toBe(42 - 1 - box.right);
    expect(box.top).toBe(42 - 1 - box.bottom);
    // Every content cell preserved 1:1.
    expect(countRed(out)).toBe(before);
  });

  it("is idempotent for already-centered content (returns the same grid)", () => {
    // Content centered: cols 12..31 (center 20.5), rows 12..31 → shift -1, within threshold.
    const centered = makeGrid(42, 42, (r, c) =>
      c >= 12 && c <= 31 && r >= 12 && r <= 31 ? { ...RED } : null,
    );
    expect(recenterGrid(centered)).toBe(centered);
    // Exactly centered → also unchanged.
    const exact = makeGrid(42, 42, (r, c) =>
      c >= 11 && c <= 30 && r >= 11 && r <= 30 ? { ...RED } : null,
    );
    expect(recenterGrid(exact)).toBe(exact);
  });

  it("all-background grid returns unchanged", () => {
    const blank = makeGrid(20, 20, () => null);
    expect(recenterGrid(blank)).toBe(blank);
  });

  it("frame canvas keeps a subject near an edge inside the margin band", () => {
    // 50×50 frame, frameMargin 3 → band [3, 46]. Content near the left edge.
    const grid = makeGrid(50, 50, (r, c) =>
      c >= 0 && c <= 32 && r >= 15 && r <= 34 ? { ...RED } : null,
    );
    const out = recenterGrid(grid, { frameMargin: 3 });
    const box = bboxOf(out)!;
    // Subject's whole bbox stays inside the deterministic margin band.
    expect(box.left).toBeGreaterThanOrEqual(3);
    expect(box.right).toBeLessThanOrEqual(46);
    // And it is now centered on the canvas (within 1 cell).
    const centerCol = (box.left + box.right) / 2;
    expect(Math.abs(centerCol - (50 - 1) / 2)).toBeLessThanOrEqual(1);
  });

  it("frame canvas never pushes oversized content outside the canvas", () => {
    // Content wider than the band allows (cols 0..47 of 50, band 3 → avail 44).
    const grid = makeGrid(50, 50, (r, c) =>
      c >= 0 && c <= 47 && r >= 20 && r <= 29 ? { ...RED } : null,
    );
    const out = recenterGrid(grid, { frameMargin: 3 });
    const box = bboxOf(out)!;
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(49);
  });

  it("white-out corners do not affect the content bounding box", () => {
    // 10×10: near-white corners plus a red block near the top-left.
    const grid = makeGrid(10, 10, (r, c) => {
      if ((r === 0 && c === 0) || (r === 0 && c === 9) || (r === 9 && c === 0) || (r === 9 && c === 9)) {
        return { ...NEAR_WHITE };
      }
      return c >= 1 && c <= 3 && r >= 1 && r <= 3 ? { ...RED } : null;
    });
    const out = recenterGrid(grid);
    const box = bboxOf(out)!;
    // Corners are background — bbox is just the red block, recentered.
    expect(box).not.toEqual({ top: 0, bottom: 9, left: 0, right: 9 });
    expect(Math.abs(((box.left + box.right) / 2) - (10 - 1) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(((box.top + box.bottom) / 2) - (10 - 1) / 2)).toBeLessThanOrEqual(1);
    // Near-white corners are background: they do not inflate the bbox, but
    // they shift with the rest of the grid (spec: copy old cells at shifted
    // positions) — (0,0) moves to (3,3); the vacated (0,0) is fresh white.
    expect(out[3][3].color).toBe(NEAR_WHITE.color);
    expect(out[0][0].color).toBe(WHITE.color);
  });

  it("does not mutate the input grid", () => {
    const grid = makeGrid(20, 20, (r, c) => (c <= 4 && r <= 4 ? { ...RED } : null));
    const before = grid.map(row => row.map(cell => ({ ...cell })));
    recenterGrid(grid);
    expect(grid.map(row => row.map(cell => ({ ...cell })))).toEqual(before);
  });
});
