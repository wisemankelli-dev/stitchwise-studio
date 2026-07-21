/**
 * Editor Operations Tests — Pure function tests for grid mutations.
 *
 * Every test verifies immutability: the original grid must remain unchanged
 * after every operation.
 */

import { paintCells, eraseCells, cloneRegion, eyedropper, floodFill, stampText } from "../../src/domain/stitch/editorOperations";
import type { StitchCell, StitchGrid } from "../../src/domain/stitch/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGrid(size: number = 5, fillColor: string = "#ffffff"): StitchGrid {
  const grid: StitchGrid = [];
  for (let r = 0; r < size; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < size; c++) {
      row.push({ color: fillColor });
    }
    grid.push(row);
  }
  return grid;
}

function cloneGrid(g: StitchGrid): StitchGrid {
  return g.map(row => row.map(cell => ({ ...cell })));
}

// ─── Paint ───────────────────────────────────────────────────────────────────

describe("paintCells", () => {
  test("paints a single cell", () => {
    const grid = makeGrid(5);
    const original = cloneGrid(grid);
    const result = paintCells(grid, [{ row: 2, col: 2, color: "#ff0000" }]);

    expect(result.grid[2][2].color).toBe("#ff0000");
    expect(result.grid[0][0].color).toBe("#ffffff");
    // Immutability
    expect(grid[2][2].color).toBe("#ffffff");
    expect(grid).toEqual(original);
  });

  test("paints multiple cells", () => {
    const grid = makeGrid(5);
    const result = paintCells(grid, [
      { row: 0, col: 0, color: "#ff0000", dmcCode: "DMC 321" },
      { row: 4, col: 4, color: "#0000ff", dmcCode: "DMC 798" },
    ]);

    expect(result.grid[0][0].color).toBe("#ff0000");
    expect(result.grid[0][0].dmcCode).toBe("DMC 321");
    expect(result.grid[4][4].color).toBe("#0000ff");
    expect(result.grid[4][4].dmcCode).toBe("DMC 798");
    // Middle cells untouched
    expect(result.grid[2][2].color).toBe("#ffffff");
  });

  test("returns palette with correct counts", () => {
    const grid = makeGrid(5);
    const result = paintCells(grid, [
      { row: 0, col: 0, color: "#ff0000" },
      { row: 0, col: 1, color: "#ff0000" },
      { row: 1, col: 0, color: "#0000ff" },
    ]);

    expect(result.palette.length).toBeGreaterThanOrEqual(1);
    // 2 red + 1 blue, rest white (not counted)
    const totalColored = result.palette.reduce((s, c) => s + c.count, 0);
    expect(totalColored).toBe(3);
  });

  test("ignores out-of-bounds coordinates", () => {
    const grid = makeGrid(5);
    const result = paintCells(grid, [
      { row: 99, col: 0, color: "#ff0000" },
      { row: 0, col: -1, color: "#ff0000" },
    ]);
    // Should not crash, grid unchanged
    expect(result.grid[0][0].color).toBe("#ffffff");
  });

  test("does not mutate original grid", () => {
    const grid = makeGrid(5);
    const original = cloneGrid(grid);
    paintCells(grid, [{ row: 0, col: 0, color: "#ff0000" }]);
    expect(grid).toEqual(original);
  });
});

// ─── Erase ───────────────────────────────────────────────────────────────────

describe("eraseCells", () => {
  test("erases cells to white", () => {
    const grid = makeGrid(5);
    // Paint first, then erase
    const painted = paintCells(grid, [{ row: 0, col: 0, color: "#ff0000" }]).grid;
    const result = eraseCells(painted, [{ row: 0, col: 0 }]);

    expect(result.grid[0][0].color).toBe("#ffffff");
  });

  test("does not mutate original grid", () => {
    const grid = makeGrid(5);
    const painted = paintCells(grid, [{ row: 2, col: 2, color: "#ff0000" }]).grid;
    const original = cloneGrid(painted);
    eraseCells(painted, [{ row: 2, col: 2 }]);
    expect(painted).toEqual(original);
  });
});

// ─── Clone Region ────────────────────────────────────────────────────────────

describe("cloneRegion", () => {
  test("clones a rectangular region correctly", () => {
    const grid = makeGrid(5);
    const painted = paintCells(grid, [
      { row: 0, col: 0, color: "#ff0000" },
      { row: 0, col: 1, color: "#00ff00" },
      { row: 1, col: 0, color: "#0000ff" },
      { row: 1, col: 1, color: "#ffff00" },
    ]).grid;

    const result = cloneRegion(painted, {
      sourceRow: 0, sourceCol: 0, width: 2, height: 2,
      targetRow: 3, targetCol: 3,
    });

    expect(result.grid[3][3].color).toBe("#ff0000");
    expect(result.grid[3][4].color).toBe("#00ff00");
    expect(result.grid[4][3].color).toBe("#0000ff");
    expect(result.grid[4][4].color).toBe("#ffff00");
    // Source unchanged
    expect(result.grid[0][0].color).toBe("#ff0000");
  });

  test("clipping: does not write beyond grid bounds", () => {
    const grid = makeGrid(5);
    const painted = paintCells(grid, [{ row: 0, col: 0, color: "#ff0000" }]).grid;

    const result = cloneRegion(painted, {
      sourceRow: 0, sourceCol: 0, width: 2, height: 2,
      targetRow: 4, targetCol: 4, // would overflow
    });
    // Should not crash
    expect(result.grid[4][4].color).toBe("#ff0000");
  });

  test("does not mutate original grid", () => {
    const grid = makeGrid(5);
    const painted = paintCells(grid, [{ row: 0, col: 0, color: "#ff0000" }]).grid;
    const original = cloneGrid(painted);
    cloneRegion(painted, { sourceRow: 0, sourceCol: 0, width: 1, height: 1, targetRow: 2, targetCol: 2 });
    expect(painted).toEqual(original);
  });
});

// ─── Eyedropper ──────────────────────────────────────────────────────────────

describe("eyedropper", () => {
  test("returns cell color at coordinates", () => {
    const grid = makeGrid(5);
    const painted = paintCells(grid, [{ row: 2, col: 3, color: "#ff0000", dmcCode: "DMC 321" }]).grid;

    const result = eyedropper(painted, 2, 3);
    expect(result).not.toBeNull();
    expect(result!.color).toBe("#ff0000");
    expect(result!.dmcCode).toBe("DMC 321");
  });

  test("returns null for out-of-bounds", () => {
    const grid = makeGrid(5);
    expect(eyedropper(grid, 99, 0)).toBeNull();
    expect(eyedropper(grid, 0, -1)).toBeNull();
  });
});

// ─── Stamp Text ──────────────────────────────────────────────────────────────

describe("stampText", () => {
  test("stamps text at position", () => {
    const grid = makeGrid(20);
    const result = stampText(grid, "HI", 2, 2, "#ff0000");

    // Should have painted pixels — at least some cells should be red
    const redCells = result.grid.flat().filter(c => c.color === "#ff0000");
    expect(redCells.length).toBeGreaterThan(0);
  });

  test("does not mutate original grid", () => {
    const grid = makeGrid(20);
    const original = cloneGrid(grid);
    stampText(grid, "TEST", 0, 0, "#ff0000");
    expect(grid).toEqual(original);
  });

  test("clips text that overflows grid bounds", () => {
    const grid = makeGrid(10);
    // Stamp at bottom-right edge — should not crash
    const result = stampText(grid, "HELLO", 8, 8, "#ff0000");
    expect(result.grid).toBeDefined();
    expect(result.palette).toBeDefined();
  });
});

// ─── Flood Fill ──────────────────────────────────────────────────────────────

describe("floodFill", () => {
  test("fills a bounded region", () => {
    const grid = makeGrid(5);
    // Paint a red square border
    let g = paintCells(grid, [
      { row: 1, col: 1, color: "#ff0000" }, { row: 1, col: 2, color: "#ff0000" }, { row: 1, col: 3, color: "#ff0000" },
      { row: 2, col: 1, color: "#ff0000" }, { row: 2, col: 3, color: "#ff0000" },
      { row: 3, col: 1, color: "#ff0000" }, { row: 3, col: 2, color: "#ff0000" }, { row: 3, col: 3, color: "#ff0000" },
    ]).grid;

    // Flood fill the center (2,2) which is white and bounded by red
    const result = floodFill(g, 2, 2, "#0000ff");

    expect(result.grid[2][2].color).toBe("#0000ff");
    // Border should remain red
    expect(result.grid[1][1].color).toBe("#ff0000");
  });

  test("does not mutate original grid", () => {
    const grid = makeGrid(5);
    const original = cloneGrid(grid);
    floodFill(grid, 2, 2, "#ff0000");
    expect(grid).toEqual(original);
  });
});
