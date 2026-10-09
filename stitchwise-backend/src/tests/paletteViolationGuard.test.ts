/**
 * paletteViolationGuard — deterministic hue-family tests.
 *
 * Owner-conclusive (10-09 gap #41 retest #3 — "blue stocking- snowflake
 * design", id ab01992a, 154×238): the final grid was 23% GREEN/RED/BROWN in
 * hues the stored prompt ("blue background with white snowflakes.  White top
 * and white toe") never named — the model painted a Christmas scene. The
 * failing fixture below is the owner's REAL dmcPalette (counts verbatim from
 * live-dev-20261009T133229Z-post-snowflakeXmas2.db).
 */
import { describe, it, expect } from "@jest/globals";
import {
  hexFamily,
  namedPromptColorFamilies,
  paletteViolationWarning,
} from "../domain/stitch/paletteViolationGuard";

const OWNER_PROMPT = "blue background with white snowflakes.  White top and white toe";
/**
 * Owner's REAL final-grid palette (dmcPalette counts from the live DB row):
 * white 3549 + blues 9437 named ✓, but green/red/orange/brown = 3100 st
 * (23%) invented — scatter prompts have no natural snowflake-adjacent hues.
 */
const OWNER_REAL_PALETTE = [
  { hex: "#ffffff", count: 3549 },
  { hex: "#2e609d", count: 8197 },
  { hex: "#276632", count: 1223 },
  { hex: "#bf5816", count: 833 },
  { hex: "#6c95c4", count: 664 },
  { hex: "#c9262d", count: 616 },
  { hex: "#254267", count: 576 },
  { hex: "#70503c", count: 428 },
];

describe("hexFamily", () => {
  it("classifies achromatic tones deterministically", () => {
    expect(hexFamily("#ffffff")).toBe("white");
    expect(hexFamily("#000000")).toBe("black");
    expect(hexFamily("#808080")).toBe("gray");
    expect(hexFamily("#f8f8f8")).toBe("white"); // fabric cream
  });
  it("classifies the owner's real grid colors onto their hue families", () => {
    expect(hexFamily("#2e609d")).toBe("blue");
    expect(hexFamily("#6c95c4")).toBe("blue");
    expect(hexFamily("#254267")).toBe("blue");
    expect(hexFamily("#276632")).toBe("green");
    expect(hexFamily("#c9262d")).toBe("red");
    expect(hexFamily("#bf5816")).toBe("orange"); // brown/orange family
    expect(hexFamily("#70503c")).toBe("brown");
  });
});

describe("namedPromptColorFamilies", () => {
  it("extracts blue + white from the owner's stored prompt", () => {
    const { families, words } = namedPromptColorFamilies(OWNER_PROMPT);
    expect(families.has("blue")).toBe(true);
    expect(families.has("white")).toBe(true);
    expect([...words].sort()).toEqual(["blue", "white"]); // deterministic word set
  });
  it("returns empty when the prompt names no colors", () => {
    const { families, words } = namedPromptColorFamilies("snowflakes all over");
    expect(families.size).toBe(0);
    expect(words).toEqual([]);
  });
});

describe("paletteViolationWarning", () => {
  it("WARNS on the owner's REAL grid: 23% green/red/orange/brown not in prompt (10-09 retest #3)", () => {
    const warning = paletteViolationWarning(OWNER_REAL_PALETTE, OWNER_PROMPT);
    expect(warning).not.toBeNull();
    expect(warning).toContain("didn't ask for");
    expect(warning).toContain("please regenerate");
    expect(warning).toContain("white"); // lists the prompt's colors
    expect(warning).toContain("blue");
  });
  it("stays SILENT for a genuine white-on-blue snowflake grid (white+blues only)", () => {
    const clean = [
      { hex: "#ffffff", count: 900 },
      { hex: "#2e609d", count: 4200 },
      { hex: "#6c95c4", count: 380 },
    ];
    expect(paletteViolationWarning(clean, OWNER_PROMPT)).toBeNull();
  });
  it("stays SILENT when the prompt names no colors", () => {
    expect(paletteViolationWarning(OWNER_REAL_PALETTE, "snowflakes all over")).toBeNull();
  });
  it("stays SILENT for sub-2% antialiasing remnants (a 1.9% green trace)", () => {
    const trace = [
      { hex: "#2e609d", count: 8197 },
      { hex: "#6c95c4", count: 1000 },
      { hex: "#254267", count: 500 },
      { hex: "#276632", count: 28 }, // 28/1528 ≈ 1.8% of non-bg fill
    ];
    expect(paletteViolationWarning(trace, OWNER_PROMPT)).toBeNull();
  });
  it("fails closed for a >2% junk family: single green 100-cell blob in mostly-blue fill", () => {
    const junk = [
      { hex: "#2e609d", count: 8197 },
      { hex: "#6c95c4", count: 1000 },
      { hex: "#276632", count: 200 }, // 200/1200 = 16.7% → warn
    ];
    const warning = paletteViolationWarning(junk, OWNER_PROMPT);
    expect(warning).toContain("didn't ask for");
  });
  it("stays SILENT for animals/non-scatter prompts even with an off-prompt hue (byte-identical path)", () => {
    // "green teddy" grid with a red scarf (natural) must not warn — the guard
    // is scatter-only; single-subject natural colors are legitimate.
    const animalPalette = [
      { hex: "#8a6f4d", count: 3000 },
      { hex: "#276632", count: 400 },
      { hex: "#c9262d", count: 150 },
    ];
    expect(paletteViolationWarning(animalPalette, "a teddy bear with a green hat")).toBeNull();
    // Sunflower natural colors (yellow + brown + green) must not warn either.
    const flowerPalette = [
      { hex: "#e6c229", count: 2000 },
      { hex: "#8c6a2f", count: 300 },
      { hex: "#2f7d32", count: 250 },
    ];
    expect(paletteViolationWarning(flowerPalette, "a yellow sunflower")).toBeNull();
  });
});