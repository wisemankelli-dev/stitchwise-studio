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
 *  6. imageBufferToStitchGrid SUBJECT-AWARE margin band (owner 09-11 "teddy
 *     bear STILL cut off") — the band must preserve the WHOLE subject (scale +
 *     recentre about the canvas centre) instead of blindly erasing the outer
 *     ring (which amputated 16% of the teddy: 7142 → 6025 cells).
 */
import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  enrichAIPrompt,
  aspectFromCanvas,
  qualityGate,
  shouldUseProceduralPattern,
  subjectTouchesEdge,
  isSquareOrLandscape,
  isFrameCanvas,
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

  // ─── Ornament "busy design" fix (owner 09-11) ────────────────────────────
  it("ornament on a tiny 42x42 grid: circle-clip phrasing + flat-sticker style, no square full-bleed fill", () => {
    const { prompt, shapeHintApplied, smallGrid } = enrichAIPrompt("teddy bear with a blue sweater", "ornament", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(shapeHintApplied).toBe(true);
    expect(smallGrid).toBe(true);
    // Circle-CLIP geometry: the client masks the grid to a circle, so the art
    // must live INSIDE the inscribed circle with empty square corners.
    expect(prompt).toContain("circular ornament bauble");
    expect(prompt).toContain("clipped to a CIRCLE");
    expect(prompt).toContain("four corners of the square stay empty");
    // Tiny-grid simplified style (bold flat art, NOT photorealistic shading).
    expect(prompt).toContain("bold flat cartoon-sticker style");
    expect(prompt).toContain("minimal shading");
    // The old "edge to edge, no empty corners" wording is GONE — it made
    // Gemini draw square full-bleed compositions that the circle mask cuts.
    expect(prompt).not.toMatch(/edge to edge, no empty corners/i);
    // Vibrancy survives the simplification — no old color-draining hints.
    expect(prompt).toContain("vibrant, saturated, colorful illustration");
    expect(prompt).not.toMatch(/flat vector art|solid flat colors only|no gradients|no shading|white background/i);
  });

  it("ornament on a large 70x70 grid: circle-clip phrasing stays, tiny-grid style does NOT apply", () => {
    const { prompt, shapeHintApplied, smallGrid } = enrichAIPrompt("snowman", "ornament", {
      canvasWidth: 70,
      canvasHeight: 70,
    });
    expect(shapeHintApplied).toBe(true);
    expect(smallGrid).toBe(false);
    expect(prompt).toContain("clipped to a CIRCLE");
    expect(prompt).toContain("four corners of the square stay empty");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
  });

  it("pillow 84x84: rounded-silhouette clip phrasing, no tiny-grid style", () => {
    const { prompt, shapeHintApplied, smallGrid } = enrichAIPrompt("pansy flower", "pillow", {
      canvasWidth: 84,
      canvasHeight: 84,
    });
    expect(shapeHintApplied).toBe(true);
    expect(smallGrid).toBe(false);
    expect(prompt).toContain("rounded square pillow");
    expect(prompt).toContain("clipped to a ROUNDED SQUARE silhouette");
    expect(prompt).toContain("outer corners of the canvas stay empty");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
  });

  it("stocking 154x238: edge-to-edge fill phrasing unchanged, no tiny-grid style", () => {
    const { prompt, smallGrid } = enrichAIPrompt("colorful floral stocking", "stocking", {
      canvasWidth: 154,
      canvasHeight: 238,
    });
    expect(smallGrid).toBe(false);
    expect(prompt).toContain("edge to edge");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
  });

  it("tiny bag charm 28x28 (no shape): frame padding PLUS flat-sticker style", () => {
    const { prompt, smallGrid } = enrichAIPrompt("kitten face", undefined, {
      canvasWidth: 28,
      canvasHeight: 28,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("padding and margins on all sides");
    expect(prompt).toContain("bold flat cartoon-sticker style");
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

// ─── isFrameCanvas (single source of truth: prompt + converter + gate) ──
describe("isFrameCanvas", () => {
  it("no shape + square 100×100 → frame (teddy case)", () => {
    expect(isFrameCanvas(undefined, 100, 100)).toBe(true);
  });
  it("no shape + tall 154×238 → NOT frame", () => {
    expect(isFrameCanvas(undefined, 154, 238)).toBe(false);
  });
  it("ornament 42×42 → NOT frame (fills the bauble edge-to-edge; owner 09-03 blob)", () => {
    expect(isFrameCanvas("ornament", 42, 42)).toBe(false);
  });
  it("stocking 154×238 → NOT frame", () => {
    expect(isFrameCanvas("stocking", 154, 238)).toBe(false);
  });
  it("pillow 100×100 → NOT frame", () => {
    expect(isFrameCanvas("pillow", 100, 100)).toBe(false);
  });
  it("explicit rect 100×100 → frame", () => {
    expect(isFrameCanvas("rect", 100, 100)).toBe(true);
  });
  it("explicit square 100×100 → frame", () => {
    expect(isFrameCanvas("square", 100, 100)).toBe(true);
  });
  it("explicit rect on a TALL canvas → NOT frame (edge-fill, backward-compat)", () => {
    expect(isFrameCanvas("rect", 100, 200)).toBe(false);
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

  it("does NOT fire the edge warning on cream/near-white background at the edge (owner 09-11 foreground definition)", () => {
    // #f2e8d5 is cream: max 242 >= 190, spread (242-213)/242 ≈ 0.12 <= 0.2 →
    // background under the halo rule the converter uses (merged into DMC White
    // 520). A frame whose EDGE cells are cream (not pure white) with a
    // saturated subject inside must NOT be reported as "subject cut off".
    const N = 10;
    const g: StitchCell[][] = Array.from({ length: N }, () =>
      Array.from({ length: N }, () => ({ color: "#f2e8d5" })),
    );
    const colors = ["#cc3333", "#3366cc", "#33cc66", "#cc9933", "#9933cc", "#66cccc"];
    for (let r = 2; r < N - 2; r++) for (let c = 2; c < N - 2; c++) g[r][c].color = colors[(r + c) % colors.length];
    const dmc = [
      { hex: "#f2e8d5", count: 60 },
      ...colors.map((hex, i) => ({ hex, count: 40 - i * 5 })),
    ];
    const warning = qualityGate(g, dmc, "teddy bear", { frame: true });
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
  it("ignores cream/near-white edge cells (halo = background, owner 09-11)", () => {
    // A frame whose top EDGE is cream (#f2e8d5 — max 242, spread 0.12) instead
    // of pure white must NOT be classified as a subject touching the edge. The
    // OLD gate counted any non-pure-white cell as subject -> false "cut off".
    const { grid, dmc } = frame();
    for (let c = 0; c < 10; c++) grid[0][c].color = "#f2e8d5";
    expect(subjectTouchesEdge(grid, dmc)).toBeNull();
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

  it("FORCES a blank margin band on frame canvases even when the source is full-bleed (teddy-bear STILL cut off regression)", async () => {
    // 300×300 SOLID RED — no white margin at all, exactly the "model ignored
    // the margin prompt" case the lead repro'd (100×100 grid, rows 0–99,
    // cols 0–99 all non-white, 0px margin). The deterministic band must still
    // appear: outer ~6 cells (max(2, round(6% of 100)) = 6) become background.
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 100, 24, { width: 100, height: 100 }, { margin: true });
    const n = result.grid.length;
    const isWhiteBg = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return r > 245 && g > 245 && b > 245;
    };
    // The whole outer band (6 cells on all four sides) must be background.
    for (let i = 0; i < 6; i++) {
      for (let c = 0; c < n; c++) {
        expect(isWhiteBg(result.grid[i][c].color)).toBe(true);        // top rows 0..5
        expect(isWhiteBg(result.grid[n - 1 - i][c].color)).toBe(true); // bottom rows 93..98
      }
      for (let r = 0; r < n; r++) {
        expect(isWhiteBg(result.grid[r][i].color)).toBe(true);          // left cols 0..5
        expect(isWhiteBg(result.grid[r][n - 1 - i].color)).toBe(true);  // right cols 93..98
      }
    }
    // The main subject is still present in the interior (not wiped out).
    const mid = Math.floor(n / 2);
    expect(isWhiteBg(result.grid[mid][mid].color)).toBe(false);
  });

  it("does NOT add a margin band to TALL/product canvases (stocking stays edge-to-edge)", async () => {
    // Tall 154×238 stocking target, solid red source — edge-to-edge fill must
    // be preserved: outer cells are NOT forced to background when margin:false
    // (and a tall canvas never gets a band even if margin:true).
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 200, 24, { width: 154, height: 238 }, { margin: true });
    expect(result.grid.length).toBe(238);
    expect(result.grid[0].length).toBe(154);
    // Top-left and bottom-right corners stay colored (red), NOT forced white.
    const isWhiteBg = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return r > 245 && g > 245 && b > 245;
    };
    expect(isWhiteBg(result.grid[0][0].color)).toBe(false);
    expect(isWhiteBg(result.grid[237][153].color)).toBe(false);
  });
  it("does NOT add a margin band to 42×42 ornament dims (shape 'ornament', margin:false — the ornament blob path)", async () => {
    // 42×42 Ornament preset is SQUARE but is NOT a frame (product shape fills
    // edge-to-edge). The route now sends { margin: isFrameCanvasResult } =
    // false for the ornament, so the converter must NOT band — corners stay
    // colored so the subject fills the bauble instead of shrinking into a
    // tiny box that the frontend circle-clip turns into a blob.
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 100, 24, { width: 42, height: 42 }, { margin: false });
    expect(result.grid.length).toBe(42);
    expect(result.grid[0].length).toBe(42);
    const isWhiteBg = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return r > 245 && g > 245 && b > 245;
    };
    // All four corners stay colored (red) — no band, edge-to-edge fill.
    expect(isWhiteBg(result.grid[0][0].color)).toBe(false);
    expect(isWhiteBg(result.grid[0][41].color)).toBe(false);
    expect(isWhiteBg(result.grid[41][0].color)).toBe(false);
    expect(isWhiteBg(result.grid[41][41].color)).toBe(false);
  });
});

// ─── subject-aware margin band (owner 09-11 "teddy STILL cut off") ───────
describe("imageBufferToStitchGrid (subject-aware margin band)", () => {
  // Foreground = a cell whose color is NOT the light-fabric/background DMC
  // entry. The pipeline merges light + low-saturation colors (max>=190 &&
  // (max-min)/max<=0.2) into DMC White 520 — using a naive "non-white" test
  // would count the near-white background halo as subject and hide the cut
  // (exactly what the 09-03 verification missed). Mirror that halo rule here.
  const isLightFabricHex = (hex: string): boolean => {
    const h = (hex || "").toLowerCase();
    if (!h || h.length < 7) return false;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    if (r > 245 && g > 245 && b > 245) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max >= 190 && (max - min) / max <= 0.2;
  };
  const fgBbox = (grid: StitchCell[][]) => {
    const rows = grid.length, cols = grid[0]?.length || 0;
    let top = rows, bottom = -1, left = cols, right = -1, count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell?.color && !isLightFabricHex(cell.color)) {
          count++;
          if (r < top) top = r;
          if (r > bottom) bottom = r;
          if (c < left) left = c;
          if (c > right) right = c;
        }
      }
    }
    return {
      top, bottom, left, right, count,
      margins: { top, bottom: rows - 1 - bottom, left, right: cols - 1 - right },
      bbox: { w: right - left + 1, h: bottom - top + 1 },
    };
  };

  it("keeps the WHOLE teddy inside the 6-cell band instead of amputating it (owner 09-11 fixture)", async () => {
    // Real Gemini output behind the owner's "teddy bear with a blue sweater"
    // save (2026-09-11). It is JPEG bytes despite the .png name — sharp
    // auto-detects by content. The source genuinely has margins (bbox margins
    // L11.6/R9.7/T8.1/B5.3% at 1024×1024); the 09-03 blind band erased the
    // parts that reached the 6-cell ring (subject count 7142 → 6025, -16%).
    const fixture = readFileSync(join(__dirname, "fixtures", "teddy_source_1024.png"));
    const result = await imageBufferToStitchGrid(fixture, 100, 24, { width: 100, height: 100 }, { margin: true });
    expect(result.grid.length).toBe(100);
    expect(result.grid[0].length).toBe(100);
    const fg = fgBbox(result.grid);
    // The subject must sit fully inside the band with >= 6 cells on every
    // side (marginPx = max(2, round(0.06 * 100)) = 6).
    expect(fg.margins.top).toBeGreaterThanOrEqual(6);
    expect(fg.margins.bottom).toBeGreaterThanOrEqual(6);
    expect(fg.margins.left).toBeGreaterThanOrEqual(6);
    expect(fg.margins.right).toBeGreaterThanOrEqual(6);
    // The subject is preserved at its TRUE size (measured 77×84 of 100).
    // A re-trim regression would zoom the bear full-bleed and cut it to the
    // 88×88 band (foreground margins exactly 6/6/6/6, bbox 88×88) — this
    // bbox tolerance is the regression guard that fails on the old behavior.
    expect(fg.bbox.w).toBeLessThanOrEqual(85);
    expect(fg.bbox.h).toBeLessThanOrEqual(85);
    // Nothing of the subject erased: measured 4337 subject cells remain
    // (>= 95% of the ~4337 pre-band count in this subject-aware pipeline —
    // the band no longer overlaps any subject pixel), well above the
    // quality-gate 30% fill floor, and the canvas center is still the bear.
    expect(fg.count).toBeGreaterThanOrEqual(4000);
    const mid = Math.floor(result.grid.length / 2);
    expect(isLightFabricHex(result.grid[mid][mid].color)).toBe(false);
  });

  it("regression guard: the unbanded trimmed baseline still reaches the canvas edge (a blind band would cut it)", async () => {
    // Same fixture WITHOUT the margin path: the auto-crop trim zooms the bear
    // to full-bleed (foreground margins 0 on every side) — which is exactly
    // why the pre-fix blind band could not be applied without erasing part of
    // the subject (7142 → 6025, -16%). This asserts the symptom the fix must
    // keep solving, and it fails (margins < 6) if someone reintroduces trim
    // on the margin path without the subject-aware scale.
    const fixture = readFileSync(join(__dirname, "fixtures", "teddy_source_1024.png"));
    const baseline = await imageBufferToStitchGrid(fixture, 100, 24, { width: 100, height: 100 }, { margin: false });
    const fg = fgBbox(baseline.grid);
    const minMargin = Math.min(fg.margins.top, fg.margins.bottom, fg.margins.left, fg.margins.right);
    expect(minMargin).toBeLessThan(6);
  });

  it("square-rect frame (100×100 rect): full-bleed subject is scaled about the centre — margins >= 6, subject retained", async () => {
    // isFrameCanvas("rect", 100, 100) === true → the route sends margin:true.
    // A full-bleed subject must be scaled down (nearest-neighbour, about the
    // canvas centre) so the WHOLE subject fits inside [6,93]² — the band ring
    // is background, the subject keeps margins >= 6 on every side, and the
    // centre is still colored (subject not erased to nothing).
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 220, g: 40, b: 40 } } }).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 100, 24, { width: 100, height: 100 }, { margin: true });
    expect(result.grid.length).toBe(100);
    expect(result.grid[0].length).toBe(100);
    const fg = fgBbox(result.grid);
    expect(fg.margins.top).toBeGreaterThanOrEqual(6);
    expect(fg.margins.bottom).toBeGreaterThanOrEqual(6);
    expect(fg.margins.left).toBeGreaterThanOrEqual(6);
    expect(fg.margins.right).toBeGreaterThanOrEqual(6);
    // Whole subject present (88×88 interior after the 0.88 scale), centre red.
    expect(fg.count).toBeGreaterThan(4000);
    const mid = Math.floor(result.grid.length / 2);
    expect(isLightFabricHex(result.grid[mid][mid].color)).toBe(false);
  });
});