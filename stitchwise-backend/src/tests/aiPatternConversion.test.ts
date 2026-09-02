/**
 * AI → Pattern Conversion Fix Tests (owner 09-03).
 *
 * Covers the backend side of the AI→pattern conversion bug:
 *  1. enrichAIPrompt — vibrant + shape-fill + scene guard, NO color-draining
 *     hints ("flat vector art / solid flat colors / white background").
 *  2. aspectFromCanvas — tall canvas (stocking 154×238) → 2:3, square → 1:1.
 *  3. shouldUseProceduralPattern — "a yellow sunflower" must reach OpenAI
 *     (descriptor), bare "sunflower" stays procedural.
 *  4. qualityGate — sparse/muddy grids warn; dense grids pass.
 *  5. imageBufferToStitchGrid non-square target — returns grid at canvas dims
 *     (aspect-aware) so the frontend framing keeps dense coverage.
 */
import { describe, it, expect } from "@jest/globals";
import sharp from "sharp";
import {
  enrichAIPrompt,
  aspectFromCanvas,
  qualityGate,
  shouldUseProceduralPattern,
} from "../infrastructure/routes/aiEmbroidery";
import { imageBufferToStitchGrid } from "../domain/stitch/patternConverter";
import type { StitchCell } from "../domain/stitch/types";

// ─── enrichAIPrompt ─────────────────────────────────────────────────────
describe("enrichAIPrompt", () => {
  it("adds vibrant guidance and NO color-draining hints", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("colorful floral stocking", "stocking");
    expect(prompt).toContain("vibrant, saturated, colorful illustration");
    expect(prompt).toContain("tall vertical stocking shape completely filled");
    expect(shapeHintApplied).toBe(true);
    // The old color-draining hints must be GONE.
    expect(prompt).not.toMatch(/flat vector art|solid flat colors only|no gradients|no shading|white background/i);
  });

  it("adds a scene guard for landscape prompts (no people)", () => {
    const { prompt, sceneGuardApplied } = enrichAIPrompt("sunset beach scene", "ornament");
    expect(sceneGuardApplied).toBe(true);
    expect(prompt).toContain("landscape scene only, no people, no faces, no text, no watermark");
    expect(prompt).toContain("circular ornament bauble");
  });

  it("does not over-trigger a scene guard on plain subjects", () => {
    const { sceneGuardApplied } = enrichAIPrompt("a yellow sunflower");
    expect(sceneGuardApplied).toBe(false);
  });
});

// ─── aspectFromCanvas ───────────────────────────────────────────────────
describe("aspectFromCanvas", () => {
  it("maps a tall stocking canvas to 2:3", () => {
    expect(aspectFromCanvas(154, 238)).toBe("2:3");
  });
  it("maps a square canvas to 1:1", () => {
    expect(aspectFromCanvas(70, 70)).toBe("1:1");
  });
  it("defaults to 1:1 when dimensions are absent", () => {
    expect(aspectFromCanvas()).toBe("1:1");
  });
});

// ─── shouldUseProceduralPattern ─────────────────────────────────────────
describe("shouldUseProceduralPattern", () => {
  it("lets 'a yellow sunflower' reach OpenAI (descriptor, not procedural)", () => {
    expect(shouldUseProceduralPattern("a yellow sunflower")).toBe(false);
  });
  it("keeps a bare 'sunflower' on the procedural fast path", () => {
    expect(shouldUseProceduralPattern("sunflower")).toBe(true);
  });
});

// ─── qualityGate ────────────────────────────────────────────────────────
describe("qualityGate", () => {
  function gridOf(fillPct: number, colors: number): { grid: StitchCell[][]; dmc: { hex: string; count: number }[] } {
    const N = 10;
    const g: StitchCell[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ color: "#ffffff" })),
    );
    const palette = Array.from({ length: colors }, (_, i) => `#${(i + 2) * 25}${(i + 3) * 25}${(i + 4) * 25}`.padStart(7, "#").slice(0, 7));
    const filled = Math.round(N * N * fillPct / 100);
    for (let i = 0; i < filled; i++) {
      const r = Math.floor(i / N), c = i % N;
      g[r][c].color = palette[i % palette.length];
    }
    // Center the non-background cells (qualityGate reads the grid's own palette for bg).
    return { grid: g, dmc: palette.map((hex, i) => ({ hex, count: 100 - i * 10 })) };
  }

  it("warns on a sparse muddy conversion", () => {
    const { grid, dmc } = gridOf(15, 3);
    const warning = qualityGate(grid, dmc, "test");
    expect(warning).toMatch(/filled/);
    expect(warning).toMatch(/distinct colors/);
  });

  it("returns null for a dense, colorful conversion", () => {
    const { grid, dmc } = gridOf(85, 9);
    // Ensure the dominant color is NOT treated as the majority in a way that empties it.
    const warning = qualityGate(grid, dmc, "test");
    expect(warning).toBeNull();
  });
});

// ─── non-square aspect-aware conversion ─────────────────────────────────
describe("imageBufferToStitchGrid (aspect-aware)", () => {
  // Skip if sharp isn't available in the test env, but normally it is.
  it("produces a grid at the requested canvas dims (154×238 stocking)", async () => {
    const png = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).composite([
      { input: Buffer.from(await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer()), left: 100, top: 100 },
    ]).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 200, 24, { width: 154, height: 238 });
    expect(result.grid.length).toBe(238);
    expect(result.grid[0].length).toBe(154);
    expect(result.stitchCount).toBe(154 * 238);
  });

  it("falls back to square when no target is given (backward compatible)", async () => {
    const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 200, g: 100, b: 50 } } }).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 100, 24);
    expect(result.grid.length).toBe(100);
    expect(result.grid[0].length).toBe(100);
  });
});