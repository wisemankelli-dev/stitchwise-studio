/**
 * Line Art Pipeline Tests — Comprehensive unit tests for the line art
 * to stitch grid conversion pipeline.
 *
 * Covers: pixel classification, contour tracing, path simplification,
 * region filling, stitch mapping, and full pipeline integration.
 */

import sharp from "sharp";
import {
  classifyPixel,
  traceContours,
  simplifyPaths,
  fillRegions,
  mapToStitchGrid,
  lineArtToPattern,
} from "../../src/infrastructure/services/lineArtPipeline";
import { DMC_COLORS } from "../../src/domain/stitch/dmcColors";

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a simple test PNG with known pixel colors.
 * Format: a 4x4 grid where each pixel has known RGB values.
 */
async function createTestImage(pixels: number[][][]): Promise<Buffer> {
  const height = pixels.length;
  const width = pixels[0].length;
  const rawData = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawData[idx] = pixels[y][x][0];     // R
      rawData[idx + 1] = pixels[y][x][1]; // G
      rawData[idx + 2] = pixels[y][x][2]; // B
      rawData[idx + 3] = 255;             // A
    }
  }

  return sharp(rawData, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Create a raw Uint8ClampedArray representing RGBA pixel data.
 */
function makeRawData(pixels: number[][][]): Uint8ClampedArray {
  const height = pixels.length;
  const width = pixels[0].length;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = pixels[y][x][0];
      data[idx + 1] = pixels[y][x][1];
      data[idx + 2] = pixels[y][x][2];
      data[idx + 3] = 255;
    }
  }

  return data;
}

// ─── Pixel Classification ─────────────────────────────────────────────────────

describe("classifyPixel", () => {
  test("classifies pure black as outline", () => {
    expect(classifyPixel(0, 0, 0, 128, 240)).toBe("outline");
  });

  test("classifies dark gray as outline (below threshold)", () => {
    expect(classifyPixel(40, 40, 40, 128, 240)).toBe("outline");
    // 40+40+40=120 < 128 → outline
  });

  test("classifies medium dark gray as outline (still below threshold)", () => {
    // 42+42+42=126 < 128
    expect(classifyPixel(42, 42, 42, 128, 240)).toBe("outline");
  });

  test("classifies slightly darker gray as NOT outline (just above threshold)", () => {
    // 43+43+43=129 >= 128, but all channels < 240 → region
    expect(classifyPixel(43, 43, 43, 128, 240)).toBe("region");
  });

  test("classifies pure white as background", () => {
    expect(classifyPixel(255, 255, 255, 128, 240)).toBe("background");
  });

  test("classifies near-white as background", () => {
    // All channels ≥ 240 → background
    expect(classifyPixel(240, 240, 240, 128, 240)).toBe("background");
    expect(classifyPixel(245, 250, 242, 128, 240)).toBe("background");
  });

  test("classifies near-white with one channel below threshold as region", () => {
    // G=239 < 240 → not background (288+239+290=817 > 128 → not outline → region)
    expect(classifyPixel(250, 239, 250, 128, 240)).toBe("region");
  });

  test("classifies red as region", () => {
    expect(classifyPixel(255, 0, 0, 128, 240)).toBe("region");
  });

  test("classifies blue as region", () => {
    expect(classifyPixel(0, 0, 255, 128, 240)).toBe("region");
  });

  test("classifies green as region", () => {
    expect(classifyPixel(0, 255, 0, 128, 240)).toBe("region");
  });

  test("custom outline threshold changes classification", () => {
    // Pixel (20,20,20) has r+g+b=60.
    // With threshold 50: 60 < 50 is false → not outline → region (dark gray)
    // With threshold 70: 60 < 70 is true → outline
    expect(classifyPixel(20, 20, 20, 50, 240)).toBe("region");
    expect(classifyPixel(20, 20, 20, 70, 240)).toBe("outline");
  });

  test("custom background threshold changes classification", () => {
    // With bgThreshold=200, near-white pixel (210,210,210) is background
    expect(classifyPixel(210, 210, 210, 128, 200)).toBe("background");
    // With bgThreshold=240, same pixel is region
    expect(classifyPixel(210, 210, 210, 128, 240)).toBe("region");
  });
});

// ─── Contour Tracing ──────────────────────────────────────────────────────────

describe("traceContours", () => {
  test("returns empty for an empty mask", () => {
    const mask: boolean[][] = [
      [false, false],
      [false, false],
    ];
    const contours = traceContours(mask, 2);
    expect(contours).toHaveLength(0);
  });

  test("traces a single outline pixel", () => {
    const mask: boolean[][] = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];
    const contours = traceContours(mask, 3);
    expect(contours).toHaveLength(1);
    expect(contours[0].points).toHaveLength(1);
    expect(contours[0].points[0]).toEqual({ x: 1, y: 1 });
  });

  test("traces a connected horizontal line", () => {
    const mask: boolean[][] = [
      [false, false, false],
      [true, true, true],
      [false, false, false],
    ];
    const contours = traceContours(mask, 3);
    expect(contours).toHaveLength(1);
    expect(contours[0].points).toHaveLength(3);
  });

  test("traces a connected vertical line", () => {
    const mask: boolean[][] = [
      [false, true, false],
      [false, true, false],
      [false, true, false],
    ];
    const contours = traceContours(mask, 3);
    expect(contours).toHaveLength(1);
    expect(contours[0].points).toHaveLength(3);
  });

  test("traces a simple shape (square)", () => {
    const mask: boolean[][] = [
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ];
    const contours = traceContours(mask, 3);
    // All 8 outline pixels are 8-connected → one contour
    expect(contours).toHaveLength(1);
    expect(contours[0].points).toHaveLength(8);
  });

  test("traces multiple disconnected shapes", () => {
    const mask: boolean[][] = [
      [true, false, true],
      [false, false, false],
      [true, false, true],
    ];
    const contours = traceContours(mask, 3);
    expect(contours).toHaveLength(4);
  });

  test("traces diagonal connections (8-connectivity)", () => {
    const mask: boolean[][] = [
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ];
    const contours = traceContours(mask, 3);
    // Three pixels connected diagonally via 8-connectivity → one contour
    expect(contours).toHaveLength(1);
    expect(contours[0].points).toHaveLength(3);
  });

  test("non-outline pixels are not traced", () => {
    const mask: boolean[][] = [
      [false, true, false],
      [true, false, true],
      [false, true, false],
    ];
    const contours = traceContours(mask, 3);
    // 4 true pixels, not all connected → check they sum to 4
    const totalPoints = contours.reduce((sum, c) => sum + c.points.length, 0);
    expect(totalPoints).toBe(4);
  });
});

// ─── Path Simplification ──────────────────────────────────────────────────────

describe("simplifyPaths", () => {
  test("converts single-point contour to outline cell", () => {
    const contours = [{ points: [{ x: 5, y: 3 }] }];
    const cells = simplifyPaths(contours);
    expect(cells.size).toBe(1);
    expect(cells.has("3,5")).toBe(true);
  });

  test("converts multi-point contour correctly", () => {
    const contours = [{
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    }];
    const cells = simplifyPaths(contours);
    expect(cells.size).toBe(3);
    expect(cells.has("0,0")).toBe(true);
    expect(cells.has("0,1")).toBe(true);
    expect(cells.has("0,2")).toBe(true);
  });

  test("handles empty contours", () => {
    const cells = simplifyPaths([]);
    expect(cells.size).toBe(0);
  });

  test("deduplicates overlapping points from multiple contours", () => {
    const contours = [
      { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { points: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }, // overlap at (0,0)
    ];
    const cells = simplifyPaths(contours);
    expect(cells.size).toBe(3); // (0,0), (1,1), (2,2)
  });
});

// ─── Region Filling ───────────────────────────────────────────────────────────

describe("fillRegions", () => {
  test("fills a simple closed region", () => {
    // 3x3: outline ring, interior region
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline", "outline", "outline"],
      ["outline", "region", "outline"],
      ["outline", "outline", "outline"],
    ];
    const rawData = makeRawData([
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [255, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ]);
    const { regionColors, regionMap } = fillRegions(pixelClass, rawData, 3);

    // One region should have been found
    expect(regionColors.size).toBe(1);
    // Center cell should be mapped to region 1
    expect(regionMap[1][1]).toBeGreaterThan(0);
  });

  test("fills multiple disconnected regions", () => {
    // 5x5: two separate regions
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline", "outline", "outline", "background", "outline"],
      ["outline", "region", "outline", "background", "outline"],
      ["outline", "outline", "outline", "background", "background"],
      ["background", "background", "background", "background", "background"],
      ["outline", "outline", "outline", "outline", "outline"],
    ];
    const rawData = makeRawData([
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [255, 255, 255], [0, 0, 0]],
      [[0, 0, 0], [255, 0, 0], [0, 0, 0], [255, 255, 255], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [255, 255, 255], [255, 255, 255]],
      [[255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255], [255, 255, 255]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ]);
    const { regionColors } = fillRegions(pixelClass, rawData, 5);

    // One region found (the top-left red region) — the bottom row is just outline
    expect(regionColors.size).toBeGreaterThanOrEqual(1);
  });

  test("does not fill outline or background cells", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline", "background"],
      ["background", "region"],
    ];
    const rawData = makeRawData([
      [[0, 0, 0], [255, 255, 255]],
      [[255, 255, 255], [0, 255, 0]],
    ]);
    const { regionColors, regionMap } = fillRegions(pixelClass, rawData, 2);

    // Region at (1,1) should be filled
    expect(regionColors.size).toBe(1);
    expect(regionMap[1][1]).toBe(1);
    // Outline and background stay 0
    expect(regionMap[0][0]).toBe(0);
    expect(regionMap[0][1]).toBe(0);
    expect(regionMap[1][0]).toBe(0);
  });

  test("regions map to nearest DMC color", () => {
    // A single red region
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["region"],
    ];
    const rawData = makeRawData([[[220, 40, 50]]]); // Near Christmas Red
    const { regionColors } = fillRegions(pixelClass, rawData, 1);
    expect(regionColors.size).toBe(1);
    const color = Array.from(regionColors.values())[0];
    // Should map to closest DMC red (Christmas Red DMC 321)
    expect(color.dmcCode).toBe("DMC 321");
  });
});

// ─── Stitch Mapping ───────────────────────────────────────────────────────────

describe("mapToStitchGrid", () => {
  test("outline cells get backstitch type", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline"],
    ];
    const outlineCells = new Set(["0,0"]);
    const { grid } = mapToStitchGrid(
      pixelClass,
      outlineCells,
      new Map(),
      [[0]],
      1,
      "DMC 310",
    );

    expect(grid[0][0].stitchType).toBe("back");
    expect(grid[0][0].dmcCode).toBe("DMC 310");
  });

  test("background cells get cross stitch type (white)", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["background"],
    ];
    const { grid } = mapToStitchGrid(
      pixelClass,
      new Set(),
      new Map(),
      [[0]],
      1,
      "DMC 310",
    );

    expect(grid[0][0].stitchType).toBe("cross");
    expect(grid[0][0].dmcCode).toBe("DMC 520"); // White
  });

  test("region cells get cross stitch type with region color", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["region"],
    ];
    const regionColors = new Map([
      ["1", { hex: "#e11d48", dmcCode: "DMC 321", dmcName: "Christmas Red" }],
    ]);
    const regionMap = [[1]];

    const { grid } = mapToStitchGrid(
      pixelClass,
      new Set(),
      regionColors,
      regionMap,
      1,
      "DMC 310",
    );

    expect(grid[0][0].stitchType).toBe("cross");
    expect(grid[0][0].dmcCode).toBe("DMC 321");
    expect(grid[0][0].color).toBe("#e11d48");
  });

  test("correctly counts DMC colors", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline", "region"],
      ["region", "background"],
    ];
    const outlineCells = new Set(["0,0"]);
    const regionColors = new Map([
      ["1", { hex: "#e11d48", dmcCode: "DMC 321", dmcName: "Christmas Red" }],
      ["2", { hex: "#0c6700", dmcCode: "DMC 700", dmcName: "Green" }],
    ]);
    const regionMap = [[0, 1], [2, 0]];

    const { dmcCountMap } = mapToStitchGrid(
      pixelClass,
      outlineCells,
      regionColors,
      regionMap,
      2,
      "DMC 310",
    );

    expect(dmcCountMap.size).toBe(4); // outline, 2 regions, background
    expect(dmcCountMap.get("DMC 310")!.count).toBe(1); // outline
    expect(dmcCountMap.get("DMC 321")!.count).toBe(1); // region 1
    expect(dmcCountMap.get("DMC 700")!.count).toBe(1); // region 2
    expect(dmcCountMap.get("DMC 520")!.count).toBe(1); // white background
  });

  test("builds grid with correct dimensions", () => {
    const pixelClass: ("outline" | "background" | "region")[][] = [
      ["outline", "outline"],
      ["outline", "outline"],
    ];
    const outlineCells = new Set(["0,0", "0,1", "1,0", "1,1"]);
    const { grid } = mapToStitchGrid(
      pixelClass,
      outlineCells,
      new Map(),
      [[0, 0], [0, 0]],
      2,
      "DMC 310",
    );

    expect(grid.length).toBe(2);
    expect(grid[0].length).toBe(2);
    expect(grid[1].length).toBe(2);
  });
});

// ─── Full Pipeline Integration ────────────────────────────────────────────────

describe("lineArtToPattern (full pipeline)", () => {
  test("processes a simple black square on white background", async () => {
    // 4x4 image: black outline square with white interior
    const pixels = [
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0]],
      [[0, 0, 0], [255, 255, 255], [255, 255, 255], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ];
    const buffer = await createTestImage(pixels);

    // Run the pipeline at gridSize=4 (matching input dimensions)
    const result = await lineArtToPattern(buffer, { gridSize: 4 });

    expect(result.gridSize).toBe(4);
    expect(result.stitchCount).toBe(16);
    expect(result.grid.length).toBe(4);

    // Count stitch types
    let backCount = 0;
    let crossCount = 0;
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
        else crossCount++;
      }
    }
    // 12 outline pixels, 4 white interior pixels
    expect(backCount).toBe(12);
    expect(crossCount).toBe(4);
  });

  test("processes a colored region inside a black outline", async () => {
    // 3x3: black ring with red center
    const pixels = [
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [255, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ];
    const buffer = await createTestImage(pixels);

    const result = await lineArtToPattern(buffer, { gridSize: 3 });

    // 8 outline (back), 1 red (cross)
    let backCount = 0;
    let crossCount = 0;
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
        else crossCount++;
      }
    }
    expect(backCount).toBe(8);
    expect(crossCount).toBe(1);

    // Center cell should be mapped to a DMC color (closest to red)
    expect(result.grid[1][1].stitchType).toBe("cross");
    expect(result.grid[1][1].dmcCode).toBeDefined();
  });

  test("produces valid PatternResult structure", async () => {
    // Simple 2x2 all-white image
    const pixels = [
      [[255, 255, 255], [255, 255, 255]],
      [[255, 255, 255], [255, 255, 255]],
    ];
    const buffer = await createTestImage(pixels);

    const result = await lineArtToPattern(buffer, { gridSize: 2 });

    expect(result).toHaveProperty("grid");
    expect(result).toHaveProperty("gridSize", 2);
    expect(result).toHaveProperty("stitchCount", 4);
    expect(result).toHaveProperty("dmcColors");
    expect(Array.isArray(result.dmcColors)).toBe(true);
    expect(result.dmcColors.length).toBeGreaterThan(0);

    // dmcColors should have required fields
    for (const c of result.dmcColors) {
      expect(c).toHaveProperty("code");
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("hex");
      expect(c).toHaveProperty("count");
      expect(c).toHaveProperty("symbol");
    }
  });

  test("dmcPalette includes cross-stitch symbols", async () => {
    const pixels = [
      [[0, 0, 0], [255, 0, 0]],
      [[0, 255, 0], [0, 0, 255]],
    ];
    const buffer = await createTestImage(pixels);

    const result = await lineArtToPattern(buffer, { gridSize: 2 });

    // Each DMC usage should have a symbol
    for (const c of result.dmcColors) {
      expect(c.symbol).toBeDefined();
      expect(typeof c.symbol).toBe("string");
      expect(c.symbol!.length).toBeGreaterThan(0);
    }
  });

  test("respects outline threshold", async () => {
    // All pixels are dark gray (total=120)
    const pixels = [
      [[40, 40, 40], [40, 40, 40]],
      [[40, 40, 40], [40, 40, 40]],
    ];
    const buffer = await createTestImage(pixels);

    // Default threshold 128: all should be outline
    const resultLow = await lineArtToPattern(buffer, { gridSize: 2, outlineThreshold: 128 });
    let backCount = 0;
    for (const row of resultLow.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
      }
    }
    expect(backCount).toBe(4);

    // Threshold 100: 120 > 100, so all pixels should be region (not outline)
    const resultHigh = await lineArtToPattern(buffer, { gridSize: 2, outlineThreshold: 100 });
    backCount = 0;
    for (const row of resultHigh.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
      }
    }
    expect(backCount).toBe(0);
  });

  test("clamps invalid grid sizes to default", async () => {
    const pixels = [[[0, 0, 0]]];
    const buffer = await createTestImage(pixels);

    const result = await lineArtToPattern(buffer, { gridSize: 0 });
    // Should clamp to DEFAULT_GRID_SIZE (100)
    expect(result.gridSize).toBe(100);
  });

  test("clamps grid sizes above 500 to default", async () => {
    const pixels = [[[0, 0, 0]]];
    const buffer = await createTestImage(pixels);

    const result = await lineArtToPattern(buffer, { gridSize: 999 });
    // Max is 500, so should clamp to DEFAULT_GRID_SIZE (100)
    expect(result.gridSize).toBe(100);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("lineArtPipeline edge cases", () => {
  test("handles 1x1 image", async () => {
    const pixels = [[[0, 0, 0]]];
    const buffer = await createTestImage(pixels);
    const result = await lineArtToPattern(buffer, { gridSize: 1 });
    expect(result.grid.length).toBe(1);
    expect(result.grid[0].length).toBe(1);
    expect(result.stitchCount).toBe(1);
  });

  test("handles minimum grid size (50)", async () => {
    // 50x50 all white
    const pixelRows = Array.from({ length: 50 }, () =>
      Array.from({ length: 50 }, () => [255, 255, 255])
    );
    const buffer = await createTestImage(pixelRows);
    const result = await lineArtToPattern(buffer, { gridSize: 50 });
    expect(result.gridSize).toBe(50);
    expect(result.stitchCount).toBe(2500);
  });

  test("handles image with no outline pixels", async () => {
    const pixels = [
      [[255, 0, 0], [0, 255, 0]],
      [[0, 0, 255], [255, 255, 255]],
    ];
    const buffer = await createTestImage(pixels);
    const result = await lineArtToPattern(buffer, { gridSize: 2 });

    // No outlines → all cross stitches
    let backCount = 0;
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
      }
    }
    expect(backCount).toBe(0);
  });

  test("handles all-black image", async () => {
    const pixels = [
      [[0, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0]],
    ];
    const buffer = await createTestImage(pixels);
    const result = await lineArtToPattern(buffer, { gridSize: 2 });

    // All outline
    let backCount = 0;
    for (const row of result.grid) {
      for (const cell of row) {
        if (cell.stitchType === "back") backCount++;
      }
    }
    expect(backCount).toBe(4);
  });
});
