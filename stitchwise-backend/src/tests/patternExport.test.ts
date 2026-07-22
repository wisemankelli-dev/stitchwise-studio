/**
 * Pattern Export Tests — Validates PDF generation and grid-to-paths conversion.
 */

import { generatePatternPDF } from "../../src/infrastructure/services/pdfExporter";
import { gridToDesignPaths } from "../../src/infrastructure/services/gridToPaths";
import { createEmptyGrid } from "../../src/domain/stitch/stitchGrid";
import { paintCells } from "../../src/domain/stitch/editorOperations";
import type { StitchGrid, DmcUsage } from "../../src/domain/stitch/types";

const RED = { color: "#ff0000", dmcCode: "DMC 321", dmcName: "Christmas Red" };
const BLUE = { color: "#0000ff", dmcCode: "DMC 798", dmcName: "Delft Blue" };
const BLACK = { color: "#000000", dmcCode: "DMC 310", dmcName: "Black" };

function makePalette(grid: StitchGrid): DmcUsage[] {
  const map = new Map<string, { code: string; name: string; hex: string; count: number }>();
  for (const row of grid) {
    for (const cell of row) {
      if (cell.color === "#ffffff") continue;
      const key = cell.dmcCode ?? cell.color;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { code: cell.dmcCode ?? cell.color, name: cell.dmcName ?? cell.color, hex: cell.color, count: 1 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

describe("generatePatternPDF", () => {
  test("generates a non-empty buffer", () => {
    const grid = createEmptyGrid(5, 5);
    const result = paintCells(grid, [{ row: 1, col: 1, ...RED }]);
    const palette = makePalette(result.grid);
    const pdf = generatePatternPDF(result.grid, palette, { name: "Test", gridSize: 5 });
    expect(pdf).toBeDefined();
    expect(pdf.length).toBeGreaterThan(0);
    expect(pdf.toString("utf-8")).toContain("StitchWise Studio");
  });

  test("includes pattern name and grid size", () => {
    const grid = createEmptyGrid(10, 10);
    const result = paintCells(grid, [{ row: 3, col: 3, ...BLUE }]);
    const palette = makePalette(result.grid);
    const pdf = generatePatternPDF(result.grid, palette, { name: "My Pattern", gridSize: 10 });
    const text = pdf.toString("utf-8");
    expect(text).toContain("My Pattern");
    expect(text).toContain("10 × 10");
  });

  test("includes DMC color key", () => {
    const grid = createEmptyGrid(8, 8);
    const result = paintCells(grid, [
      { row: 0, col: 0, ...RED },
      { row: 0, col: 1, ...BLUE },
    ]);
    const palette = makePalette(result.grid);
    const pdf = generatePatternPDF(result.grid, palette, { name: "Colors", gridSize: 8 });
    const text = pdf.toString("utf-8");
    expect(text).toContain("DMC 321");
    expect(text).toContain("DMC 798");
    expect(text).toContain("DMC Color Key");
  });

  test("handles empty pattern (all white)", () => {
    const grid = createEmptyGrid(5, 5);
    const palette: DmcUsage[] = [];
    const pdf = generatePatternPDF(grid, palette, { name: "Empty", gridSize: 5 });
    expect(pdf).toBeDefined();
    expect(pdf.length).toBeGreaterThan(0);
  });
});

describe("gridToDesignPaths", () => {
  test("converts grid with stitches to design paths", () => {
    const grid = createEmptyGrid(10, 10);
    const result = paintCells(grid, [
      { row: 2, col: 2, ...RED },
      { row: 2, col: 3, ...RED },
      { row: 4, col: 4, ...BLUE },
    ]);
    const { paths, totalStitches } = gridToDesignPaths(result.grid);
    expect(paths.length).toBeGreaterThan(0);
    expect(totalStitches).toBe(3);
  });

  test("returns zero paths for empty grid", () => {
    const grid = createEmptyGrid(5, 5);
    const { paths, totalStitches } = gridToDesignPaths(grid);
    expect(totalStitches).toBe(0);
  });

  test("groups stitches by color", () => {
    const grid = createEmptyGrid(10, 10);
    const result = paintCells(grid, [
      { row: 1, col: 1, ...RED },
      { row: 1, col: 2, ...RED },
      { row: 3, col: 3, ...BLUE },
    ]);
    const { paths } = gridToDesignPaths(result.grid);
    // Should have 2 color groups (red + blue)
    expect(paths.length).toBe(2);
  });

  test("merges consecutive pixels into single segments", () => {
    const grid = createEmptyGrid(10, 10);
    // 3 consecutive pixels in same row = 1 segment
    const result = paintCells(grid, [
      { row: 5, col: 5, ...RED },
      { row: 5, col: 6, ...RED },
      { row: 5, col: 7, ...RED },
    ]);
    const { paths, totalStitches } = gridToDesignPaths(result.grid);
    expect(totalStitches).toBe(3);
    // Each path should have segments
    expect(paths.every(p => p.segments.length > 0)).toBe(true);
  });

  test("handles non-consecutive pixels", () => {
    const grid = createEmptyGrid(10, 10);
    const result = paintCells(grid, [
      { row: 5, col: 1, ...RED },
      { row: 5, col: 5, ...RED }, // gap at col 2-4
    ]);
    const { paths, totalStitches } = gridToDesignPaths(result.grid);
    expect(totalStitches).toBe(2);
  });
});
