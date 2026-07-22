/**
 * Tests for fabric count types, color limits, and dimension calculator.
 */
import {
  FABRIC_COUNTS,
  AVAILABLE_FABRIC_COUNTS,
  DEFAULT_FABRIC_COUNT,
  isValidFabricCount,
  getFabricCountInfo,
  getMaxColors,
  isPaletteWithinLimit,
  getCompatibleFabricCounts,
  calculateDimensions,
  gridSizeFromDimensions,
  calculateFabricPiece,
  DEFAULT_FABRIC_MARGIN,
} from "../domain/stitch/fabricCounts";

// ─── Constants ───────────────────────────────────────────────────────────

describe("fabric count constants", () => {
  it("has 5 supported fabric counts", () => {
    expect(Object.keys(FABRIC_COUNTS)).toHaveLength(5);
  });

  it("AVAILABLE_FABRIC_COUNTS is sorted ascending", () => {
    for (let i = 1; i < AVAILABLE_FABRIC_COUNTS.length; i++) {
      expect(AVAILABLE_FABRIC_COUNTS[i]).toBeGreaterThan(AVAILABLE_FABRIC_COUNTS[i - 1]);
    }
  });

  it("DEFAULT_FABRIC_COUNT is 14", () => {
    expect(DEFAULT_FABRIC_COUNT).toBe(14);
  });

  it("all fabric counts have valid metadata", () => {
    const validCategories = ["beginner", "standard", "detail"];
    for (const [countStr, info] of Object.entries(FABRIC_COUNTS)) {
      const count = Number(countStr);
      expect(info.stitchesPerInch).toBe(count);
      expect(info.name).toContain(String(count));
      expect(info.maxColors).toBeGreaterThan(0);
      expect(validCategories).toContain(info.category);
    }
  });

  it("higher fabric counts have higher maxColors", () => {
    const counts = AVAILABLE_FABRIC_COUNTS;
    for (let i = 1; i < counts.length; i++) {
      expect(FABRIC_COUNTS[counts[i]].maxColors)
        .toBeGreaterThan(FABRIC_COUNTS[counts[i - 1]].maxColors);
    }
  });

  it("higher fabric counts have finer categories", () => {
    const order = ["beginner", "standard", "detail", "fine", "extra-fine"];
    const counts = AVAILABLE_FABRIC_COUNTS;
    for (let i = 1; i < counts.length; i++) {
      const prevIdx = order.indexOf(FABRIC_COUNTS[counts[i - 1]].category);
      const currIdx = order.indexOf(FABRIC_COUNTS[counts[i]].category);
      expect(currIdx).toBeGreaterThanOrEqual(prevIdx);
    }
  });
});

// ─── Validation ──────────────────────────────────────────────────────────

describe("isValidFabricCount", () => {
  it("returns true for supported counts", () => {
    expect(isValidFabricCount(14)).toBe(true);
    expect(isValidFabricCount(18)).toBe(true);
    expect(isValidFabricCount(11)).toBe(true);
    expect(isValidFabricCount(20)).toBe(true);
  });

  it("returns false for unsupported counts", () => {
    expect(isValidFabricCount(10)).toBe(false);
    expect(isValidFabricCount(15)).toBe(false);
    expect(isValidFabricCount(0)).toBe(false);
    expect(isValidFabricCount(22)).toBe(false);
  });
});

describe("getFabricCountInfo", () => {
  it("returns info for 14-count Aida", () => {
    const info = getFabricCountInfo(14);
    expect(info).not.toBeNull();
    expect(info!.name).toBe("14-count Aida");
    expect(info!.stitchesPerInch).toBe(14);
    expect(info!.maxColors).toBe(15);
    expect(info!.category).toBe("standard");
  });

  it("returns null for unsupported count", () => {
    expect(getFabricCountInfo(15)).toBeNull();
  });
});

// ─── Color Limits ────────────────────────────────────────────────────────

describe("getMaxColors", () => {
  it("returns exact maxColors for supported counts", () => {
  expect(getMaxColors(11)).toBe(10);
  expect(getMaxColors(14)).toBe(15);
  expect(getMaxColors(18)).toBe(24);
  expect(getMaxColors(20)).toBe(30);
  });

  it("returns safe default for unsupported counts", () => {
  expect(getMaxColors(10)).toBe(30);
  expect(getMaxColors(40)).toBe(30);
  });

  it("higher fabric count = higher max colors", () => {
    expect(getMaxColors(18)).toBeGreaterThan(getMaxColors(14));
    expect(getMaxColors(20)).toBeGreaterThan(getMaxColors(18));
  });
});

describe("isPaletteWithinLimit", () => {
  it("returns true when colors within limit", () => {
    expect(isPaletteWithinLimit(10, 14)).toBe(true);  // 10 <= 15
    expect(isPaletteWithinLimit(15, 14)).toBe(true);  // 15 <= 15 (boundary)
  });

  it("returns false when colors exceed limit", () => {
    expect(isPaletteWithinLimit(16, 14)).toBe(false); // 16 > 15
    expect(isPaletteWithinLimit(15, 11)).toBe(false); // 15 > 10
  });

  it("uses fallback for unsupported counts", () => {
    // Fallback max is 30 for unsupported counts
    expect(isPaletteWithinLimit(25, 10)).toBe(true);
    expect(isPaletteWithinLimit(35, 10)).toBe(false);
  });
});

describe("getCompatibleFabricCounts", () => {
  it("returns all counts for small color palettes", () => {
    const counts = getCompatibleFabricCounts(8);
    // 8 colors — all 5 counts support this
    expect(counts.length).toBe(5);
    expect(counts[0]).toBe(11);
  });

  it("returns fewer counts for large color palettes", () => {
    const small = getCompatibleFabricCounts(5);
    const large = getCompatibleFabricCounts(25);
    expect(large.length).toBeLessThan(small.length);
  });

  it("returns only high counts for larger palettes", () => {
    const counts = getCompatibleFabricCounts(24);
    // Only 18-count (24) and 20-count (30) support 24
    expect(counts).toEqual([18, 20]);
  });

  it("returns empty array when no fabric count supports the palette", () => {
    const counts = getCompatibleFabricCounts(50);
    expect(counts).toEqual([]);
  });

  it("returns sorted ascending", () => {
    const counts = getCompatibleFabricCounts(50);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    }
  });
});

// ─── Dimension Calculator ────────────────────────────────────────────────

describe("calculateDimensions", () => {
  it("calculates dimensions for 14-count Aida", () => {
    const dims = calculateDimensions(140, 196, 14);
    expect(dims.widthInches).toBe(10);
    expect(dims.heightInches).toBe(14);
    expect(dims.totalStitches).toBe(140 * 196);
    expect(dims.fabricCount).toBe(14);
  });

  it("converts to centimeters", () => {
    const dims = calculateDimensions(140, 140, 14);
    // 10 inches = 25.4 cm
    expect(dims.widthCm).toBe(25.4);
    expect(dims.heightCm).toBe(25.4);
  });

  it("handles fractional inches", () => {
    const dims = calculateDimensions(100, 100, 18);
    // 100 / 18 = 5.555... → rounded to 5.56
    expect(dims.widthInches).toBe(5.56);
    expect(dims.heightInches).toBe(5.56);
  });

  it("handles single-stitch pattern", () => {
    const dims = calculateDimensions(1, 1, 14);
    expect(dims.widthInches).toBeCloseTo(0.07, 1);
    expect(dims.heightInches).toBeCloseTo(0.07, 1);
    expect(dims.totalStitches).toBe(1);
  });

  it("uses different fabric counts correctly", () => {
    const dims11 = calculateDimensions(110, 110, 11);
    expect(dims11.widthInches).toBe(10);

    const dims22 = calculateDimensions(110, 110, 22);
    expect(dims22.widthInches).toBe(5);
  });

  it("handles large grid on detail fabric", () => {
    const dims = calculateDimensions(500, 500, 20);
    expect(dims.widthInches).toBe(25);
    expect(dims.totalStitches).toBe(250000);
  });

  it("rounds to 2 decimal places for inches", () => {
    const dims = calculateDimensions(100, 100, 14);
    // 100/14 = 7.142857... → 7.14
    expect(dims.widthInches).toBe(7.14);
  });

  it("rounds to 1 decimal place for cm", () => {
    const dims = calculateDimensions(100, 100, 14);
    // 7.14 * 2.54 = 18.1356 → 18.1
    expect(dims.widthCm).toBe(18.1);
  });
});

// ─── Reverse Calculator ──────────────────────────────────────────────────

describe("gridSizeFromDimensions", () => {
  it("calculates grid size for 5×7 inch pattern on 14-count", () => {
    const grid = gridSizeFromDimensions(5, 7, 14);
    expect(grid.width).toBe(70);   // 5 × 14
    expect(grid.height).toBe(98);  // 7 × 14
  });

  it("floors fractional results", () => {
    const grid = gridSizeFromDimensions(5.5, 3.2, 14);
    expect(grid.width).toBe(77);   // floor(5.5 × 14) = 77
    expect(grid.height).toBe(44);  // floor(3.2 × 14) = 44
  });

  it("handles 20-count fabric", () => {
    const grid = gridSizeFromDimensions(3, 3, 20);
    expect(grid.width).toBe(60);   // 3 × 20
    expect(grid.height).toBe(60);
  });

  it("handles zero dimensions", () => {
    const grid = gridSizeFromDimensions(0, 0, 14);
    expect(grid.width).toBe(0);
    expect(grid.height).toBe(0);
  });
});

// ─── Round-Trip ──────────────────────────────────────────────────────────

describe("dimension round-trip", () => {
  it("calculateDimensions → gridSizeFromDimensions is consistent", () => {
    const width = 140;
    const height = 196;
    const fabricCount = 14;

    const dims = calculateDimensions(width, height, fabricCount);
    const grid = gridSizeFromDimensions(
      dims.widthInches,
      dims.heightInches,
      fabricCount,
    );

    // Should recover original dimensions (accounting for rounding)
    expect(grid.width).toBe(width);
    expect(grid.height).toBe(height);
  });
});

// ─── Fabric Piece Calculator ──────────────────────────────────────────────

describe("calculateFabricPiece", () => {
  it("calculates fabric piece for a 100-stitch pattern on 14ct", () => {
    const result = calculateFabricPiece(100, 14);
    // 100 / 14 = 7.14"
    expect(result.patternInches).toBe(7.14);
    // 7.14 + 2*3 = 13.14"
    expect(result.fabricInches).toBe(13.14);
    // ceil(13.14 * 14) = ceil(183.96) = 184
    expect(result.fabricStitches).toBe(184);
    expect(result.marginInches).toBe(3);
  });

  it("uses default margin of 3 inches", () => {
    expect(DEFAULT_FABRIC_MARGIN).toBe(3);
    const result = calculateFabricPiece(140, 14);
    // 140/14 = 10" + 6 = 16"
    expect(result.fabricInches).toBe(16);
    expect(result.marginInches).toBe(3);
  });

  it("uses custom margin", () => {
    const result = calculateFabricPiece(140, 14, 2);
    // 10" + 4 = 14"
    expect(result.fabricInches).toBe(14);
    expect(result.marginInches).toBe(2);
  });

  it("returns zero margin result", () => {
    const result = calculateFabricPiece(140, 14, 0);
    expect(result.fabricInches).toBe(result.patternInches);
    expect(result.patternInches).toBe(10);
  });

  it("handles 300-stitch pillow project on 14ct", () => {
    // 300 / 14 = 21.43"
    const result = calculateFabricPiece(300, 14);
    expect(result.patternInches).toBe(21.43);
    // 21.43 + 6 = 27.43" — fits a pillow project
    expect(result.fabricInches).toBe(27.43);
    // ceil(27.43 * 14) = ceil(384.02) = 385
    expect(result.fabricStitches).toBe(385);
  });

  it("handles 350-stitch project on 11ct", () => {
    // 350 / 11 = 31.82"
    const result = calculateFabricPiece(350, 11);
    expect(result.patternInches).toBe(31.82);
    // 31.82 + 6 = 37.82"
    expect(result.fabricInches).toBe(37.82);
  });

  it("handles edge case: tiny 50-stitch pattern", () => {
    const result = calculateFabricPiece(50, 20);
    // 50 / 20 = 2.5"
    expect(result.patternInches).toBe(2.5);
    // 2.5 + 6 = 8.5"
    expect(result.fabricInches).toBe(8.5);
  });

  it("fabricStitches is always >= gridSize", () => {
    for (const fc of [11, 14, 16, 18, 20]) {
      for (const gs of [50, 100, 200, 300]) {
        const result = calculateFabricPiece(gs, fc);
        expect(result.fabricStitches).toBeGreaterThanOrEqual(gs);
      }
    }
  });

  it("fabricInches > patternInches when margin > 0", () => {
    const result = calculateFabricPiece(150, 14, 2.5);
    expect(result.fabricInches).toBeGreaterThan(result.patternInches);
  });

  it("larger margins increase fabricInches proportionally", () => {
    const r1 = calculateFabricPiece(150, 14, 1);
    const r2 = calculateFabricPiece(150, 14, 4);
    // margin increase of 3" per side = 6" total difference
    expect(r2.fabricInches - r1.fabricInches).toBeCloseTo(6, 1);
  });

  it("fabricInches matches expected for the pillow example", () => {
    // "I want a 20″ pillow on 14ct" → 280 stitches → grid ~300 → fabric piece ~26″×26″
    // 300 / 14 = 21.43" pattern + 6" margin = 27.43" — close, but the task says ~26"
    // Let's verify with margin=2: 21.43 + 4 = 25.43"
    const r2 = calculateFabricPiece(300, 14, 2);
    expect(r2.fabricInches).toBe(25.43);
    // With margin=2.5: 21.43 + 5 = 26.43" — close enough to ~26"
    const r25 = calculateFabricPiece(300, 14, 2.5);
    expect(r25.fabricInches).toBe(26.43);
  });
});
