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
  subjectTouchesEdge,
  isSquareOrLandscape,
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

  it("uses PADDING phrasing on a square canvas (100x100, no shape)", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("teddy bear with a blue sweater", undefined, {
      canvasWidth: 100,
      canvasHeight: 100,
    });
    expect(shapeHintApplied).toBe(true);
    expect(prompt).toContain("padding and margins on all sides");
    expect(prompt).toContain("nothing touches the edges");
    expect(prompt).toContain("head not cropped at top");
    expect(prompt).toContain("feet and hands not cropped at bottom");
    // The old edge-to-edge fill phrase must NOT be applied to square frames.
    expect(prompt).not.toMatch(/edge to edge|edge-to-edge|no empty margins|no blank space/i);
  });

  it("uses PADDING phrasing on a landscape canvas with an explicit rect shape", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("sunset over the ocean", "rect", {
      canvasWidth: 160,
      canvasHeight: 90,
    });
    expect(shapeHintApplied).toBe(true);
    expect(prompt).toContain("padding and margins on all sides");
    expect(prompt).not.toMatch(/edge to edge|edge-to-edge/i);
  });

  it("keeps FILL phrasing for a tall stocking canvas (154x238, stocking)", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("colorful floral stocking", "stocking", {
      canvasWidth: 154,
      canvasHeight: 238,
    });
    expect(shapeHintApplied).toBe(true);
    expect(prompt).toContain("tall vertical stocking shape completely filled");
    expect(prompt).toContain("edge to edge");
    expect(prompt).not.toContain("padding and margins");
  });

  it("keeps FILL phrasing for an explicit square/rect on a TALL canvas", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("mountain scene", "rect", {
      canvasWidth: 100,
      canvasHeight: 200,
    });
    expect(shapeHintApplied).toBe(true);
    expect(prompt).toContain("subject fills the whole rectangular frame, edge to edge, no empty margins");
    expect(prompt).not.toContain("padding and margins");
  });

  it("defaults to PADDING for a square canvas when no dims are given", () => {
    const { prompt } = enrichAIPrompt("cute cat");
    expect(prompt).toContain("padding and margins on all sides");
  });
});

// ─── isSquareOrLandscape ────────────────────────────────────────────────
describe("isSquareOrLandscape", () => {
  it("treats a square canvas as a frame", () => {
    expect(isSquareOrLandscape(100, 100)).toBe(true);
  });
  it("treats a landscape canvas as a frame", () => {
    expect(isSquareOrLandscape(160, 90)).toBe(true);
  });
  it("treats a tall canvas as NOT a frame", () => {
    expect(isSquareOrLandscape(154, 238)).toBe(false);
  });
  it("defaults to frame when dims are absent", () => {
    expect(isSquareOrLandscape()).toBe(true);
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

  it("warns when a FRAME-canvas subject touches the top edge (cut-off symptom)", () => {
    const N = 10;
    const g: StitchCell[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ color: "#ffffff" })),
    );
    // Fill the whole top row => subject touches the top edge.
    for (let c = 0; c < N; c++) g[0][c].color = "#cc3333";
    const dmc = [
      { hex: "#ffffff", count: 90 },
      { hex: "#cc3333", count: 10 },
    ];
    const warning = qualityGate(g, dmc, "teddy bear", { frame: true });
    expect(warning).toMatch(/touches the top edge/);
  });

  it("does NOT warn about edges for a product shape (stocking fills edge-to-edge)", () => {
    const N = 10;
    const g: StitchCell[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ color: "#cc3333" })),
    );
    // Give it multiple colors so the only possible complaint would be edges.
    const colors = ["#cc3333", "#3366cc", "#33cc66", "#cc9933", "#9933cc", "#66cccc"];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) g[r][c].color = colors[(r + c) % colors.length];
    const dmc = colors.map((hex, i) => ({ hex, count: 90 - i * 10 }));
    const warning = qualityGate(g, dmc, "colorful floral stocking", { frame: false });
    // Edge check must NOT fire for product shapes; only fill/color warnings may.
    if (warning) expect(warning).not.toMatch(/touches the .* edge/);
  });
});

// ─── subjectTouchesEdge ─────────────────────────────────────────────────
describe("subjectTouchesEdge", () => {
  function frame(topFill = false, bottomFill = false, leftFill = false, rightFill = false): { grid: StitchCell[][]; dmc: { hex: string; count: number }[] } {
    const N = 10;
    const g: StitchCell[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ color: "#ffffff" })),
    );
    const red = "#cc3333";
    if (topFill) for (let c = 0; c < N; c++) g[0][c].color = red;
    if (bottomFill) for (let c = 0; c < N; c++) g[N - 1][c].color = red;
    if (leftFill) for (let r = 0; r < N; r++) g[r][0].color = red;
    if (rightFill) for (let r = 0; r < N; r++) g[r][N - 1].color = red;
    return {
      grid: g,
      dmc: [
        { hex: "#ffffff", count: 90 },
        { hex: "#cc3333", count: 10 },
      ],
    };
  }

  it("returns null when the subject has margin on all sides", () => {
    const { grid, dmc } = frame();
    expect(subjectTouchesEdge(grid, dmc)).toBeNull();
  });
  it("detects a top-edge touch", () => {
    const { grid, dmc } = frame(true);
    expect(subjectTouchesEdge(grid, dmc)).toBe("top");
  });
  it("detects a bottom-edge touch", () => {
    const { grid, dmc } = frame(false, true);
    expect(subjectTouchesEdge(grid, dmc)).toBe("bottom");
  });
  it("detects a left-edge touch (corner blank so only the left edge fires)", () => {
    const { grid, dmc } = frame();
    // Fill column 0 for rows 1..N-1 (leave (0,0) blank).
    const N = grid.length;
    for (let r = 1; r < N; r++) grid[r][0].color = "#cc3333";
    expect(subjectTouchesEdge(grid, dmc)).toBe("left");
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