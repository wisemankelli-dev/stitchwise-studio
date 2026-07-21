/**
 * Stitch Grid Utility Tests — Comprehensive tests for grid operations.
 *
 * Covers: creation, dimensions, validation, clone, flip, rotate, color stats,
 * and edge cases (hex validation, DMC code validation, 1x1 grid, 200x200 grid).
 */

import {
  createEmptyGrid,
  getGridDimensions,
  validateGrid,
  cloneGrid,
  flipGridHorizontal,
  flipGridVertical,
  rotateGrid90,
  rotateGrid180,
  rotateGrid270,
  getColorStats,
  isValidHexColor,
  isValidDmcCode,
} from "../../src/domain/stitch/stitchGrid";
import type { StitchCell, StitchGrid } from "../../src/domain/stitch/types";

// ─── Creation ──────────────────────────────────────────────────────────────

describe("createEmptyGrid", () => {
  test("creates a 3x3 grid with default white", () => {
    const grid = createEmptyGrid(3, 3);
    expect(grid.length).toBe(3);
    for (const row of grid) {
      expect(row.length).toBe(3);
      for (const cell of row) {
        expect(cell.color).toBe("#ffffff");
        expect(cell.dmcCode).toBeUndefined();
      }
    }
  });

  test("creates a grid with custom fill color", () => {
    const grid = createEmptyGrid(2, 2, "#ff0000");
    expect(grid[0][0].color).toBe("#ff0000");
    expect(grid[1][1].color).toBe("#ff0000");
  });

  test("creates a 1x1 grid", () => {
    const grid = createEmptyGrid(1, 1, "#000000");
    expect(grid.length).toBe(1);
    expect(grid[0].length).toBe(1);
    expect(grid[0][0].color).toBe("#000000");
  });

  test("creates a 200x200 grid (max size)", () => {
    const grid = createEmptyGrid(200, 200);
    const dims = getGridDimensions(grid);
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(200);
  });

  test("creates independent rows (structural clone)", () => {
    const grid = createEmptyGrid(3, 3, "#ffffff");
    grid[0][0].color = "#ff0000";
    // Modifying one cell should not affect others
    expect(grid[0][1].color).toBe("#ffffff");
    expect(grid[1][0].color).toBe("#ffffff");
  });
});

// ─── Dimensions ─────────────────────────────────────────────────────────────

describe("getGridDimensions", () => {
  test("returns correct dimensions for a square grid", () => {
    const grid = createEmptyGrid(5, 5);
    const dims = getGridDimensions(grid);
    expect(dims.width).toBe(5);
    expect(dims.height).toBe(5);
  });

  test("returns correct dimensions for a rectangular grid", () => {
    // Manually create a rectangular grid
    const grid: StitchGrid = [[{ color: "#fff" }, { color: "#fff" }], [{ color: "#fff" }, { color: "#fff" }], [{ color: "#fff" }, { color: "#fff" }]];
    const dims = getGridDimensions(grid);
    expect(dims.width).toBe(2);
    expect(dims.height).toBe(3);
  });

  test("returns 0 width for empty grid", () => {
    const grid: StitchGrid = [];
    const dims = getGridDimensions(grid);
    expect(dims.width).toBe(0);
    expect(dims.height).toBe(0);
  });
});

// ─── Color Validation ───────────────────────────────────────────────────────

describe("isValidHexColor", () => {
  test("validates standard hex colors", () => {
    expect(isValidHexColor("#ffffff")).toBe(true);
    expect(isValidHexColor("#000000")).toBe(true);
    expect(isValidHexColor("#ff0000")).toBe(true);
    expect(isValidHexColor("#00FF00")).toBe(true);
    expect(isValidHexColor("#abcdef")).toBe(true);
    expect(isValidHexColor("#ABCDEF")).toBe(true);
  });

  test("rejects invalid hex strings", () => {
    expect(isValidHexColor("ffffff")).toBe(false);    // missing #
    expect(isValidHexColor("#fff")).toBe(false);       // 3-digit
    expect(isValidHexColor("#fffffff")).toBe(false);   // 7 digits
    expect(isValidHexColor("#gggggg")).toBe(false);    // non-hex chars
    expect(isValidHexColor("")).toBe(false);
    expect(isValidHexColor("#")).toBe(false);
  });
});

describe("isValidDmcCode", () => {
  test("validates known DMC codes", () => {
    expect(isValidDmcCode("DMC 321")).toBe(true);
    expect(isValidDmcCode("DMC 310")).toBe(true);
    expect(isValidDmcCode("DMC blanc")).toBe(true);
    expect(isValidDmcCode("DMC 3865")).toBe(true);
  });

  test("rejects invalid DMC codes", () => {
    expect(isValidDmcCode("DMC 99999")).toBe(false);
    expect(isValidDmcCode("DMC INVALID")).toBe(false);
    expect(isValidDmcCode("")).toBe(false);
    expect(isValidDmcCode("321")).toBe(false);
  });
});

// ─── Validation ────────────────────────────────────────────────────────────

describe("validateGrid", () => {
  test("validates a well-formed grid", () => {
    const grid = createEmptyGrid(5, 5, "#ff0000");
    // Add valid DMC codes to some cells
    grid[0][0].dmcCode = "DMC 321";
    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("rejects empty grid (no rows)", () => {
    const result = validateGrid([]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("empty"))).toBe(true);
  });

  test("rejects empty grid (first row empty)", () => {
    const grid: StitchGrid = [[]];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("empty"))).toBe(true);
  });

  test("rejects non-rectangular grid", () => {
    const grid: StitchGrid = [
      [{ color: "#fff" }, { color: "#fff" }, { color: "#fff" }],
      [{ color: "#fff" }, { color: "#fff" }], // Only 2 cells
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("length"))).toBe(true);
  });

  test("rejects grid with invalid hex color", () => {
    const grid = createEmptyGrid(2, 2);
    (grid[0][0] as StitchCell).color = "not-a-color";
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("invalid hex"))).toBe(true);
  });

  test("rejects grid with invalid DMC code", () => {
    const grid = createEmptyGrid(2, 2, "#ffffff");
    grid[0][0].dmcCode = "DMC BOGUS";
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("invalid DMC"))).toBe(true);
  });

  test("accepts grid with optional fields missing", () => {
    const grid = createEmptyGrid(2, 2, "#123456");
    // No dmcCode or dmcName — should be valid
    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
  });
});

// ─── Clone ─────────────────────────────────────────────────────────────────

describe("cloneGrid", () => {
  test("produces an independent deep copy", () => {
    const grid = createEmptyGrid(3, 3, "#ffffff");
    const cloned = cloneGrid(grid);

    // Same content
    expect(cloned.length).toBe(3);
    expect(cloned[0][0].color).toBe("#ffffff");

    // Modify clone
    cloned[0][0].color = "#ff0000";
    cloned[1][1].dmcCode = "DMC 321";

    // Original should be unchanged
    expect(grid[0][0].color).toBe("#ffffff");
    expect(grid[1][1].dmcCode).toBeUndefined();
  });

  test("cloning a 1x1 grid works", () => {
    const grid = createEmptyGrid(1, 1, "#000000");
    grid[0][0].dmcCode = "DMC 310";
    const cloned = cloneGrid(grid);
    expect(cloned[0][0].color).toBe("#000000");
    expect(cloned[0][0].dmcCode).toBe("DMC 310");

    cloned[0][0].color = "#ffffff";
    expect(grid[0][0].color).toBe("#000000");
  });
});

// ─── Flip ──────────────────────────────────────────────────────────────────

describe("flipGridHorizontal", () => {
  test("mirrors a 3x3 grid correctly", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }, { color: "#0000ff" }],
      [{ color: "#111111" }, { color: "#222222" }, { color: "#333333" }],
      [{ color: "#aaaaaa" }, { color: "#bbbbbb" }, { color: "#cccccc" }],
    ];
    const flipped = flipGridHorizontal(grid);

    // First row should be reversed
    expect(flipped[0][0].color).toBe("#0000ff");
    expect(flipped[0][1].color).toBe("#00ff00");
    expect(flipped[0][2].color).toBe("#ff0000");

    // Original unchanged
    expect(grid[0][0].color).toBe("#ff0000");
  });

  test("double flip returns original", () => {
    const grid = createEmptyGrid(3, 3, "#ffffff");
    grid[0][0].color = "#ff0000";
    grid[2][2].color = "#0000ff";
    const flipped = flipGridHorizontal(flipGridHorizontal(grid));
    expect(flipped[0][0].color).toBe("#ff0000");
    expect(flipped[2][2].color).toBe("#0000ff");
  });
});

describe("flipGridVertical", () => {
  test("mirrors a 3x3 grid correctly", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }, { color: "#0000ff" }],
      [{ color: "#111111" }, { color: "#222222" }, { color: "#333333" }],
      [{ color: "#aaaaaa" }, { color: "#bbbbbb" }, { color: "#cccccc" }],
    ];
    const flipped = flipGridVertical(grid);

    // Last row should become first
    expect(flipped[0][0].color).toBe("#aaaaaa");
    expect(flipped[2][0].color).toBe("#ff0000");

    // Original unchanged
    expect(grid[0][0].color).toBe("#ff0000");
  });

  test("double flip returns original", () => {
    const grid = createEmptyGrid(3, 3, "#ffffff");
    grid[0][0].color = "#ff0000";
    grid[2][2].color = "#0000ff";
    const flipped = flipGridVertical(flipGridVertical(grid));
    expect(flipped[0][0].color).toBe("#ff0000");
    expect(flipped[2][2].color).toBe("#0000ff");
  });
});

// ─── Rotate ────────────────────────────────────────────────────────────────

describe("rotateGrid90", () => {
  test("rotates a 2x2 grid clockwise", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }],
      [{ color: "#0000ff" }, { color: "#000000" }],
    ];
    const rotated = rotateGrid90(grid);

    // After 90° CW:
    //   AB      CA
    //   CD  →   DB
    expect(rotated.length).toBe(2); // width becomes height
    expect(rotated[0].length).toBe(2); // height becomes width
    expect(rotated[0][0].color).toBe("#0000ff"); // bottom-left → top-left
    expect(rotated[0][1].color).toBe("#ff0000"); // top-left → top-right
    expect(rotated[1][0].color).toBe("#000000"); // bottom-right → bottom-left
    expect(rotated[1][1].color).toBe("#00ff00"); // top-right → bottom-right
  });

  test("four rotations return original", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }],
      [{ color: "#0000ff" }, { color: "#000000" }],
    ];
    let rotated = rotateGrid90(grid);
    rotated = rotateGrid90(rotated);
    rotated = rotateGrid90(rotated);
    rotated = rotateGrid90(rotated);
    expect(rotated[0][0].color).toBe(grid[0][0].color);
    expect(rotated[1][1].color).toBe(grid[1][1].color);
  });
});

describe("rotateGrid180", () => {
  test("180 degree rotation is equivalent to double 90", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }],
      [{ color: "#0000ff" }, { color: "#000000" }],
    ];
    const direct = rotateGrid180(grid);
    const composed = rotateGrid90(rotateGrid90(grid));
    expect(direct[0][0].color).toBe(composed[0][0].color);
    expect(direct[1][1].color).toBe(composed[1][1].color);
  });
});

describe("rotateGrid270", () => {
  test("270 degree rotation is equivalent to triple 90", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#00ff00" }],
      [{ color: "#0000ff" }, { color: "#000000" }],
    ];
    const direct = rotateGrid270(grid);
    let composed = rotateGrid90(grid);
    composed = rotateGrid90(composed);
    composed = rotateGrid90(composed);
    expect(direct[0][0].color).toBe(composed[0][0].color);
    expect(direct[1][1].color).toBe(composed[1][1].color);
  });
});

// ─── Color Statistics ──────────────────────────────────────────────────────

describe("getColorStats", () => {
  test("counts colors correctly", () => {
    const grid: StitchGrid = [
      [{ color: "#ff0000" }, { color: "#ff0000" }],
      [{ color: "#00ff00" }, { color: "#0000ff" }],
    ];
    const stats = getColorStats(grid);
    expect(stats.get("#ff0000")).toBe(2);
    expect(stats.get("#00ff00")).toBe(1);
    expect(stats.get("#0000ff")).toBe(1);
  });

  test("returns empty map for empty grid", () => {
    const grid: StitchGrid = [];
    const stats = getColorStats(grid);
    expect(stats.size).toBe(0);
  });

  test("case-insensitive color matching", () => {
    const grid: StitchGrid = [[{ color: "#FF0000" }, { color: "#ff0000" }]];
    const stats = getColorStats(grid);
    expect(stats.get("#ff0000")).toBe(2);
  });
});