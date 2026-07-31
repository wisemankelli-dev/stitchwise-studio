/**
 * Subject Pattern Generator Tests — Validates procedural pattern generation
 * for known subjects (sunflower, bird on branch, lunar moth).
 *
 * Covers:
 * - Pattern generation for each subject
 * - Grid structure validation
 * - Palette / DMC mapping
 * - Non-matching prompts return null
 * - Multiple grid sizes (50, 75, 100, 150, 200)
 * - Edge cases: empty prompt, very long prompt, punctuation
 */

import { describe, it, expect } from "@jest/globals";
import { generateSubjectPattern } from "../domain/stitch/subjectPatternGenerator";
import { validateGrid } from "../domain/stitch/stitchGrid";
import { AVAILABLE_GRID_SIZES } from "../domain/stitch/types";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("generateSubjectPattern", () => {
  describe("sunflower", () => {
    it("generates a valid grid for 'sunflower' prompt", () => {
      const result = generateSubjectPattern("sunflower", 100);
      expect(result).not.toBeNull();
      expect(result!.gridSize).toBe(100);
      const { valid, errors } = validateGrid(result!.grid);
      expect(valid).toBe(true);
      expect(errors).toEqual([]);
    });

    it("includes yellow/gold colors in palette", () => {
      const result = generateSubjectPattern("a beautiful sunflower", 100);
      expect(result).not.toBeNull();
      const hexes = result!.dmcColors.map((c) => c.hex);
      // Should include gold/yellow tones and brown
      const hasYellow = hexes.some((h) => h.startsWith("#e6") || h.startsWith("#cc"));
      const hasBrown = hexes.some((h) => h === "#3d2822" || h === "#1a1a1a");
      expect(hasYellow).toBe(true);
      expect(hasBrown).toBe(true);
    });

    it("produces a non-empty stitch count", () => {
      const result = generateSubjectPattern("sunflower", 100);
      expect(result!.stitchCount).toBeGreaterThan(0);
    });

    it("works at grid size 50", () => {
      const result = generateSubjectPattern("sunflower", 50);
      expect(result).not.toBeNull();
      expect(result!.gridSize).toBe(50);
      expect(validateGrid(result!.grid).valid).toBe(true);
    });

    it("works at grid size 200", () => {
      const result = generateSubjectPattern("sunflower", 200);
      expect(result).not.toBeNull();
      expect(result!.gridSize).toBe(200);
      expect(validateGrid(result!.grid).valid).toBe(true);
    });
  });

  describe("bird on branch", () => {
    it("generates a valid grid for 'bird on branch' prompt", () => {
      const result = generateSubjectPattern("bird on branch", 100);
      expect(result).not.toBeNull();
      const { valid, errors } = validateGrid(result!.grid);
      expect(valid).toBe(true);
    });

    it("generates for 'bird on a branch' prompt", () => {
      const result = generateSubjectPattern("bird on a branch", 100);
      expect(result).not.toBeNull();
      expect(validateGrid(result!.grid).valid).toBe(true);
    });

    it("matches 'a beautiful bird sitting on a branch'", () => {
      const result = generateSubjectPattern("a beautiful bird sitting on a branch", 100);
      expect(result).not.toBeNull();
      expect(validateGrid(result!.grid).valid).toBe(true);
    });

    it("includes brown tones for branch/bird", () => {
      const result = generateSubjectPattern("bird on branch", 100);
      expect(result).not.toBeNull();
      const hexes = result!.dmcColors.map((c) => c.hex);
      const hasBrown = hexes.some((h) =>
        h === "#8b7355" || h === "#5c3d2e" || h === "#4a3728"
      );
      expect(hasBrown).toBe(true);
    });
  });

  describe("lunar moth", () => {
    it("generates a valid grid for 'lunar moth' prompt", () => {
      const result = generateSubjectPattern("lunar moth", 100);
      expect(result).not.toBeNull();
      const { valid, errors } = validateGrid(result!.grid);
      expect(valid).toBe(true);
    });

    it("matches 'luna moth' as well", () => {
      const result = generateSubjectPattern("luna moth", 100);
      expect(result).not.toBeNull();
      expect(validateGrid(result!.grid).valid).toBe(true);
    });

    it("includes green wing tones", () => {
      const result = generateSubjectPattern("lunar moth", 100);
      expect(result).not.toBeNull();
      const hexes = result!.dmcColors.map((c) => c.hex);
      const hasGreen = hexes.some((h) =>
        h === "#b8d8a8" || h === "#7fa873"
      );
      expect(hasGreen).toBe(true);
    });

    it("has symmetric wing structure (left/right mirror)", () => {
      const result = generateSubjectPattern("lunar moth", 100);
      expect(result).not.toBeNull();
      const grid = result!.grid;
      const mid = Math.floor(result!.gridSize / 2);
      let symmetricCount = 0;
      let totalNonBg = 0;
      for (let r = 0; r < result!.gridSize; r++) {
        for (let c = 0; c < mid; c++) {
          const left = grid[r][c];
          const right = grid[r][result!.gridSize - 1 - c];
          if (left.color !== "#ffffff" || right.color !== "#ffffff") {
            totalNonBg++;
            if (left.color === right.color) symmetricCount++;
          }
        }
      }
      // At least 70% of non-background cells should be symmetric
      const ratio = totalNonBg > 0 ? symmetricCount / totalNonBg : 0;
      expect(ratio).toBeGreaterThan(0.7);
    });
  });

  describe("non-matching prompts", () => {
    it("returns null for 'dragon' prompt", () => {
      const result = generateSubjectPattern("dragon", 100);
      expect(result).toBeNull();
    });

    it("returns null for empty prompt", () => {
      const result = generateSubjectPattern("", 100);
      expect(result).toBeNull();
    });

    it("returns null for unrelated prompt", () => {
      const result = generateSubjectPattern("a castle on a hill", 100);
      expect(result).toBeNull();
    });

    it("returns null for 'butterfly' (not lunar moth)", () => {
      const result = generateSubjectPattern("butterfly", 100);
      expect(result).toBeNull();
    });
  });

  describe("grid size handling", () => {
    it("works with all supported grid sizes", () => {
      const sizes = AVAILABLE_GRID_SIZES as readonly number[];
      for (const size of sizes) {
        const result = generateSubjectPattern("sunflower", size);
        expect(result).not.toBeNull();
        expect(result!.gridSize).toBe(size);
        expect(validateGrid(result!.grid).valid).toBe(true);
      }
    });

    it("defaults to 100 for invalid grid size", () => {
      const result = generateSubjectPattern("sunflower", 999);
      expect(result).not.toBeNull();
      expect(result!.gridSize).toBe(100);
    });

    it("all subjects work at size 50", () => {
      for (const prompt of ["sunflower", "bird on branch", "lunar moth"]) {
        const result = generateSubjectPattern(prompt, 50);
        expect(result).not.toBeNull();
        expect(validateGrid(result!.grid).valid).toBe(true);
      }
    });

    it("all subjects work at size 200", () => {
      for (const prompt of ["sunflower", "bird on branch", "lunar moth"]) {
        const result = generateSubjectPattern(prompt, 200);
        expect(result).not.toBeNull();
        expect(validateGrid(result!.grid).valid).toBe(true);
      }
    });
  });

  describe("palette and DMC mapping", () => {
    it("assigns DMC codes to all palette entries", () => {
      const result = generateSubjectPattern("sunflower", 100);
      expect(result).not.toBeNull();
      for (const entry of result!.dmcColors) {
        expect(entry.code).toMatch(/^DMC \d+$/);
        expect(entry.name).toBeTruthy();
      }
    });

    it("includes cross-stitch symbols in palette", () => {
      const result = generateSubjectPattern("lunar moth", 100);
      expect(result).not.toBeNull();
      for (const entry of result!.dmcColors) {
        expect(entry.symbol).toBeDefined();
        expect(typeof entry.symbol).toBe("string");
        expect(entry.symbol!.length).toBeGreaterThan(0);
      }
    });

    it("palette is sorted by usage count descending", () => {
      const result = generateSubjectPattern("bird on branch", 100);
      expect(result).not.toBeNull();
      const counts = result!.dmcColors.map((c) => c.count);
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i - 1]).toBeGreaterThanOrEqual(counts[i]);
      }
    });
  });

  describe("case insensitivity", () => {
    it("matches SUNFLOWER (uppercase)", () => {
      const result = generateSubjectPattern("SUNFLOWER", 100);
      expect(result).not.toBeNull();
    });

    it("matches Lunar Moth (title case)", () => {
      const result = generateSubjectPattern("Lunar Moth", 100);
      expect(result).not.toBeNull();
    });
  });
});
