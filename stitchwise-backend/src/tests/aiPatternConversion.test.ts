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
  padUnderSpecifiedPrompt,
  isUnderSpecifiedPrompt,
} from "../infrastructure/routes/aiEmbroidery";
import { imageBufferToStitchGrid } from "../domain/stitch/patternConverter";
import type { StitchCell } from "../domain/stitch/types";

// ─── enrichAIPrompt ─────────────────────────────────────────────────────
describe("enrichAIPrompt", () => {
  it("adds vibrant guidance and NO color-draining hints", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("colorful floral stocking", "stocking");
    expect(prompt).toContain("vibrant, saturated, colorful illustration");
    // Mask-fill phrasing (owner 09-11 "stocking inside a stocking"): the
    // subject's body IS the stocking silhouette, not a scene in a stocking.
    expect(prompt).toContain("the subject itself must take the exact shape of a tall Christmas stocking");
    expect(prompt).toContain("subject's own body IS the stocking silhouette");
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

  it("stocking 154x238: SUBJECT IS the stocking silhouette, no stocking-object scene (owner 09-11 'stocking inside a stocking')", () => {
    const { prompt, shapeHintApplied } = enrichAIPrompt("teddy + stocking template", "stocking", {
      canvasWidth: 154,
      canvasHeight: 238,
    });
    expect(shapeHintApplied).toBe(true);
    // The subject's own body takes the stocking shape — no separate stocking
    // object drawn around it, no scene inside it.
    expect(prompt).toContain("the subject itself must take the exact shape of a tall Christmas stocking");
    expect(prompt).toContain("subject's own body IS the stocking silhouette");
    expect(prompt).toContain("no separate stocking object wrapped around the subject");
    expect(prompt).toContain("no scene inside");
    expect(prompt).toContain("edge to edge");
    expect(prompt).not.toContain("padding and margins");
    // The old wording is GONE (it produced the nested "stocking inside a stocking").
    expect(prompt).not.toContain("stocking shape completely filled with the subject");
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
  // ─── Short / under-specified prompt padding (owner 09-14) ────────────────
  it("pads a BARE 'teddy bear' prompt so Gemini has detail to draw (owner 09-14 'ugly clip art')", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", "ornament", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    // The auto-pad gives the model concrete subject detail to work from.
    expect(prompt).toContain("soft brown fur");
    expect(prompt).toContain("polished children's-book illustration style");
    // ...WITHOUT dropping any of the shape/style directives (padding is
    // prepended to the same comma-joined enriched prompt).
    expect(prompt).toContain("circular ornament bauble");
    expect(prompt).toContain("bold flat cartoon-sticker style");
    expect(prompt).toContain("vibrant, saturated, colorful illustration");
  });
  it("leaves descriptive prompts VERBATIM (no padding, no degradation)", () => {
    const { prompt } = enrichAIPrompt("teddy bear with a brown sweater", "ornament", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(prompt.startsWith("teddy bear with a brown sweater")).toBe(true);
    expect(prompt).not.toContain("polished children's-book illustration style");
  });
  it("pads short prompts on ANY size grid, not just small grids", () => {
    const big = enrichAIPrompt("teddy bear", "stocking", {
      canvasWidth: 154,
      canvasHeight: 238,
    });
    expect(big.smallGrid).toBe(false);
    expect(big.prompt).toContain("polished children's-book illustration style");
  });
  it("does NOT pad scene prompts and never double-pads (idempotent)", () => {
    const scene = enrichAIPrompt("sunset beach scene", "ornament");
    expect(scene.prompt).not.toContain("polished children's-book illustration style");
    const first = enrichAIPrompt("teddy bear", "ornament", { canvasWidth: 42, canvasHeight: 42 }).prompt;
    const second = enrichAIPrompt(first, "ornament", { canvasWidth: 42, canvasHeight: 42 }).prompt;
    // Exactly ONE pad, even when the enriched (already-padded) prompt is fed back in.
    expect(second.split("polished children's-book illustration style").length - 1).toBe(1);
  });
  it("heuristic: bare subjects are under-specified; described/scene ones are not", () => {
    expect(isUnderSpecifiedPrompt("teddy bear")).toBe(true);
    expect(isUnderSpecifiedPrompt("a teddy bear")).toBe(true); // article-stripped
    expect(isUnderSpecifiedPrompt("teddy bear with a brown sweater")).toBe(false); // ≥6 words + color
    expect(isUnderSpecifiedPrompt("red truck")).toBe(false); // color token
    expect(isUnderSpecifiedPrompt("cute cat")).toBe(false); // style token
    expect(isUnderSpecifiedPrompt("sunset beach scene")).toBe(false); // scene
    expect(isUnderSpecifiedPrompt("a yellow sunflower")).toBe(false); // descriptor present
  });
  it("padUnderSpecifiedPrompt is idempotent at the helper level", () => {
    const once = padUnderSpecifiedPrompt("teddy bear");
    const twice = padUnderSpecifiedPrompt(once);
    expect(twice).toBe(once);
    expect(padUnderSpecifiedPrompt("teddy bear with a brown sweater")).toBe("teddy bear with a brown sweater");
  });
  it("owner decision 09-14: bare subjects (incl. procedural 'sunflower') count as under-specified → routed to AI, not clip art", () => {
    // The route gate sends a prompt to the fast (clip-art) paths ONLY when it
    // is NOT under-specified; bare names are therefore always AI + auto-pad.
    expect(isUnderSpecifiedPrompt("sunflower")).toBe(true); // procedural name → AI now
    expect(isUnderSpecifiedPrompt("teddy bear")).toBe(true); // shape-library name → AI now
    expect(isUnderSpecifiedPrompt("rose")).toBe(true);
    // Described prompts never take the fast paths either (&& short-circuits).
    expect(!isUnderSpecifiedPrompt("a yellow sunflower") && shouldUseProceduralPattern("a yellow sunflower")).toBe(false);
    expect(!isUnderSpecifiedPrompt("cute cat") && shouldUseProceduralPattern("cute cat")).toBe(false);
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
    // Tiny-grid simplified style (bold flat art, NOT photorealistic shading)
    // plus the feature/outline rebalance (owner 09-11 "collapsed to a block").
    expect(prompt).toContain("bold flat cartoon-sticker style");
    expect(prompt).toContain("minimal shading");
    expect(prompt).toContain("THICK dark outline");
    expect(prompt).toContain("simple readable features");
    expect(prompt).toContain("fill most of the circle");
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
    expect(prompt).toContain("clipped to a ROUNDED SQUARE silhouette");
    // Subject FILLS the mask: its own body is the pillow shape, no pillow
    // object drawn around it (owner 09-11 same rule as stocking).
    expect(prompt).toContain("the subject itself must fill that silhouette");
    expect(prompt).toContain("no separate pillow object drawn around the subject");
    expect(prompt).toContain("outer corners of the canvas stay empty");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
  });

  it("stocking 154x238: mask-fill phrasing + no tiny-grid style", () => {
    const { prompt, smallGrid } = enrichAIPrompt("colorful floral stocking", "stocking", {
      canvasWidth: 154,
      canvasHeight: 238,
    });
    expect(smallGrid).toBe(false);
    expect(prompt).toContain("edge to edge");
    expect(prompt).toContain("subject's own body IS the stocking silhouette");
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

  // ─── Round-head symmetry (owner 09-21 "bag charm update 2", 28×28) ──────
  it("small-grid ANIMAL prompt demands a perfectly symmetric round head (owner 09-21 lopsided head)", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", undefined, {
      canvasWidth: 28,
      canvasHeight: 28,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("perfectly symmetric head");
    expect(prompt).toContain("perfectly round crown centered on the canvas");
    expect(prompt).toContain("mirror-image left and right sides");
    expect(prompt).toContain("two identical round ears sticking up at the top corners");
    expect(prompt).toContain("no tilted or lopsided head");
    // ...while keeping every pre-existing directive (flat style, outline,
    // face-cue list, padding, features).
    expect(prompt).toContain("bold flat cartoon-sticker style");
    expect(prompt).toContain("THICK dark outline");
    expect(prompt).toContain("large dark button eyes, a dark nose, a muzzle, round ears, distinct head and body");
    expect(prompt).toContain("padding and margins on all sides");
  });
  it("small-grid ANIMAL on a 42x42 ornament also gets the round-head directive", () => {
    const { prompt, smallGrid } = enrichAIPrompt("kitten", "ornament", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("perfectly symmetric head");
    expect(prompt).toContain("mirror-image left and right sides");
    expect(prompt).toContain("clipped to a CIRCLE");
    expect(prompt).toContain("bold flat cartoon-sticker style");
  });
  it("small-grid NON-ANIMAL prompt does NOT get the round-head directive (flowers/snowflakes stay as-is)", () => {
    const { prompt, smallGrid } = enrichAIPrompt("pansy flower", "pillow", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).not.toContain("perfectly symmetric head");
    expect(prompt).not.toContain("mirror-image left and right sides");
    expect(prompt).not.toContain("two identical round ears");
    expect(prompt).not.toContain("lopsided head");
    // Pillow clip + flat style still arrive (shape + small-grid guidance are
    // orthogonal to the animal-only roundness directive).
    expect(prompt).toContain("clipped to a ROUNDED SQUARE silhouette");
    expect(prompt).toContain("bold flat cartoon-sticker style");
  });
  it("small-grid NON-ANIMAL 42x42 snowflake gets flat style but no head wording", () => {
    const { prompt, smallGrid } = enrichAIPrompt("white snowflake", undefined, {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).not.toContain("perfectly symmetric head");
    expect(prompt).not.toContain("two identical round ears");
    expect(prompt).not.toContain("lopsided head");
  });
  it("LARGE-grid animal prompt (70x70) does NOT get the small-grid round-head directive", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", undefined, {
      canvasWidth: 70,
      canvasHeight: 70,
    });
    expect(smallGrid).toBe(false);
    expect(prompt).not.toContain("perfectly symmetric head");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
  });
  // ─── Color coherence (owner 09-21 "bag charm update 4", 28×28) ──────────
  it("small-grid ANIMAL prompt demands one solid flat body color (owner 09-21 gray-green body / salmon muzzle)", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", undefined, {
      canvasWidth: 28,
      canvasHeight: 28,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("the ENTIRE animal is one solid flat color");
    expect(prompt).toContain("all the same exact base color");
    expect(prompt).toContain("small lighter cream or tan muzzle and belly patch only");
    expect(prompt).toContain("NO green, gray, blue, pink or salmon tones");
    expect(prompt).toContain("no color gradients on the body");
    // ...while keeping the round-head + flat-sticker + outline directives.
    expect(prompt).toContain("perfectly symmetric head");
    expect(prompt).toContain("two identical round ears sticking up at the top corners");
    expect(prompt).toContain("bold flat cartoon-sticker style");
    expect(prompt).toContain("THICK dark outline");
    expect(prompt).toContain("padding and margins on all sides");
  });
  it("small-grid ANIMAL on a 42x42 ornament also gets the color directive", () => {
    const { prompt, smallGrid } = enrichAIPrompt("kitten", "ornament", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).toContain("the ENTIRE animal is one solid flat color");
    expect(prompt).toContain("perfectly symmetric head");
    expect(prompt).toContain("clipped to a CIRCLE");
  });
  it("small-grid NON-ANIMAL prompt does NOT get the color directive (byte-identical)", () => {
    const { prompt, smallGrid } = enrichAIPrompt("pansy flower", "pillow", {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).not.toContain("the ENTIRE animal is one solid flat color");
    expect(prompt).not.toContain("NO green, gray, blue, pink or salmon tones");
    expect(prompt).not.toContain("no color gradients on the body");
  });
  it("small-grid NON-ANIMAL 42x42 snowflake gets no color directive either", () => {
    const { prompt, smallGrid } = enrichAIPrompt("white snowflake", undefined, {
      canvasWidth: 42,
      canvasHeight: 42,
    });
    expect(smallGrid).toBe(true);
    expect(prompt).not.toContain("the ENTIRE animal is one solid flat color");
    expect(prompt).not.toContain("no color gradients on the body");
  });
  it("LARGE-grid animal prompt (70x70) does NOT get the color directive (no small-grid directives at all)", () => {
    const { prompt, smallGrid } = enrichAIPrompt("teddy bear", undefined, {
      canvasWidth: 70,
      canvasHeight: 70,
    });
    expect(smallGrid).toBe(false);
    expect(prompt).not.toContain("the ENTIRE animal is one solid flat color");
    expect(prompt).not.toContain("perfectly symmetric head");
    expect(prompt).not.toContain("bold flat cartoon-sticker style");
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
// ─── qualityGate small-grid outline check (owner 09-11 "solid block") ──────
describe("qualityGate small-grid outline/features check", () => {
  // A realistic flat "block": large tan fill (62%) + 4 more colors (so the
  // pre-existing fill/color warnings stay quiet) and — with withDark=true —
  // a dark outline ring around the fill. This mirrors the owner's save:
  // "teddy bear ornament2" = solid tan rect, 6 colors, 3 dark cells (0.7%).
  function blockGrid(n: number, withDark: boolean): { grid: StitchCell[][]; dmc: { hex: string; count: number }[] } {
    const g: StitchCell[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ color: "#ffffff" })),
    );
    // 60% of rows fully filled, split into 5 horizontal color bands (keeps the
    // pre-existing fill/color warnings quiet so only the outline check decides).
    const r0 = Math.floor(n * 0.2);
    const r1 = Math.floor(n * 0.8);
    const bandColors = ["#c8b090", "#a08060", "#d94343", "#f0b0c0", "#c8b090"];
    const bands = Math.max(1, Math.floor((r1 - r0) / bandColors.length));
    for (let r = r0; r < r1; r++) {
      const color = bandColors[Math.min(bandColors.length - 1, Math.floor((r - r0) / bands))];
      for (let c = 0; c < n; c++) g[r][c].color = color;
    }
    // A 5th non-bg accent color so the (pre-existing) <5-colors warning stays
    // quiet and only the outline check decides the outcome.
    for (let r = r0; r < r1; r += 5) {
      for (let c = 1; c <= 3; c++) g[r][c].color = "#d4a373";
    }
    if (withDark) {
      // Outline ring: first+last filled row, first+last col of the fill rows.
      for (let c = 0; c < n; c++) {
        g[r0][c].color = "#404040";
        g[r1 - 1][c].color = "#404040";
      }
      for (let r = r0; r < r1; r++) {
        g[r][0].color = "#404040";
        g[r][n - 1].color = "#404040";
      }
    }
    return {
      grid: g,
      dmc: [
        { hex: "#ffffff", count: 700 },
        { hex: "#c8b090", count: 400 },
        { hex: "#a08060", count: 200 },
        { hex: "#e8dcc8", count: 150 },
        { hex: "#f0b0c0", count: 120 },
        { hex: "#404040", count: withDark ? n * 4 : 0 },
      ],
    };
  }

  it("warns on a featureless flat block (dark < 1% of fill) on a small canvas", () => {
    const { grid, dmc } = blockGrid(42, false);
    const warning = qualityGate(grid, dmc, "teddy bear", { canvasWidth: 42, canvasHeight: 42 });
    expect(warning).toMatch(/no dark outline or features/);
  });

  it("does NOT raise the outline warning when a dark outline ring is present", () => {
    const { grid, dmc } = blockGrid(42, true);
    const warning = qualityGate(grid, dmc, "teddy bear", { canvasWidth: 42, canvasHeight: 42 });
    expect(warning).toBeNull();
  });

  it("does not apply the outline check to large canvases", () => {
    const { grid, dmc } = blockGrid(100, false);
    const warning = qualityGate(grid, dmc, "teddy bear", { canvasWidth: 100, canvasHeight: 100 });
    expect(warning).toBeNull();
  });
});

// ─── imageBufferToStitchGrid dark-outline preservation (owner 09-11) ───────
describe("imageBufferToStitchGrid (small-grid dark-outline preservation)", () => {
  // Flat sticker-style teddy: tan body + ears, cream muzzle, WHITE inner, and
  // a DARK 1-cell-equivalent outline (26px @1024 → ≈1.07 cells @42). This is
  // the exact design the #167 flat-style prompt should produce; without the
  // outline pass the lanczos downsample thins it into a grey-tan and the
  // design collapses to one tan block (measured: 0 dark cells).
  const TEDDY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#ffffff"/>
  <g stroke="#404040" stroke-width="26" stroke-linejoin="round">
    <circle cx="380" cy="330" r="95" fill="#c8b090"/>
    <circle cx="644" cy="330" r="95" fill="#c8b090"/>
    <ellipse cx="512" cy="470" rx="240" ry="210" fill="#c8b090"/>
    <ellipse cx="512" cy="760" rx="225" ry="205" fill="#c8b090"/>
    <ellipse cx="512" cy="530" rx="95" ry="70" fill="#e8dcc8"/>
    <circle cx="380" cy="330" r="45" fill="#ffffff"/>
    <circle cx="644" cy="330" r="45" fill="#ffffff"/>
    <circle cx="405" cy="495" r="22" fill="#404040"/>
    <circle cx="619" cy="495" r="22" fill="#404040"/>
    <ellipse cx="512" cy="560" rx="26" ry="18" fill="#404040"/>
  </g>
</svg>`;

  function countDarkCells(grid: StitchCell[][]): number {
    let dark = 0;
    for (const row of grid) {
      for (const cell of row) {
        const h = (cell.color || "").replace("#", "");
        if (h.length !== 6) continue;
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        if (Math.max(r, g, b) < 110) dark++;
      }
    }
    return dark;
  }

  it("preserves the dark outline at 42x42 when outlinePreserve is on (was 0)", async () => {
    const png = await sharp(Buffer.from(TEDDY_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { outlinePreserve: true });
    const dark = countDarkCells(result.grid);
    expect(dark).toBeGreaterThanOrEqual(30); // thin ring around ears+head+body survives
    // The dark DMC entry exists with a nonzero count.
    const darkEntry = result.dmcColors.find(d => d.hex.toLowerCase() === "#404040" || (d.hex.toLowerCase() !== "#c8b090" && d.hex.toLowerCase() !== "#e8dcc8" && d.hex.toLowerCase() !== "#ffffff" && d.count > 5));
    expect(darkEntry).toBeDefined();
    expect(darkEntry!.count).toBeGreaterThan(0);
    // The dominant tan fill is still present (not overpainted).
    const tan = result.dmcColors.find(d => d.count > 100);
    expect(tan).toBeDefined();
  });

  it("collapses to a solid block WITHOUT outlinePreserve (documents the bug)", async () => {
    const png = await sharp(Buffer.from(TEDDY_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 });
    expect(countDarkCells(result.grid)).toBe(0);
  });

  it("never adds a dark palette entry when the source has no dark pixels", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#ffffff"/><circle cx="512" cy="512" r="330" fill="#e11d48"/></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { outlinePreserve: true });
    const darkEntry = result.dmcColors.find(d => d.count > 0 && /^#?[0-4][0-9a-f]{2}$/i.test(d.hex.replace("#", "")) && parseInt(d.hex.slice(1, 3), 16) < 80);
    expect(darkEntry).toBeUndefined();
    expect(result.dmcColors.some(d => d.count > 0 && d.hex === "#404040")).toBe(false);
  });

  it("skips the overlay on the margin path (frame) so it cannot misalign", async () => {
    const png = await sharp(Buffer.from(TEDDY_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { margin: true, outlinePreserve: true });
    expect(result.grid.length).toBe(42);
    expect(result.grid[0].length).toBe(42);
  });

  // ─── Ornament retest 09-11 17:57 ("ears lost + hallucinated dark cap") ─────
  // The owner's 3″ ornament ("teddy oranament 3") came back with the subject
  // PINCHED to the top of the circle: the auto-trim (marginPx === 0 path)
  // shaved the model's intentional top margin, and the outline-preservation
  // overlay then fused the ear/crown darks into a solid dark cap (repro on the
  // real Gemini source: 1024² → trim 734×796 → grid r0 becomes a solid
  // ~10-cell dark dome; subject touches all 4 edges). The source itself has
  // blank rows 0-5 and TWO separate ear bumps. Fix: small AI product grids
  // (outlinePreserve + ≤60 cells) skip the auto-trim — margins and ears stay.
  // ORN3_SVG mirrors that source geometry: ≥300px blank at the top, two
  // outlined ear circles, outlined head/body, face.
  const ORN3_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#ffffff"/>
  <g stroke="#404040" stroke-width="26" stroke-linejoin="round">
    <circle cx="300" cy="430" r="95" fill="#c8b090"/>
    <circle cx="724" cy="430" r="95" fill="#c8b090"/>
    <ellipse cx="512" cy="560" rx="270" ry="235" fill="#c8b090"/>
    <ellipse cx="512" cy="800" rx="240" ry="190" fill="#c8b090"/>
    <ellipse cx="512" cy="625" rx="95" ry="70" fill="#e8dcc8"/>
    <circle cx="420" cy="555" r="22" fill="#404040"/>
    <circle cx="604" cy="555" r="22" fill="#404040"/>
    <ellipse cx="512" cy="620" rx="24" ry="16" fill="#404040"/>
  </g>
</svg>`;
  function isDarkCell(cell: StitchCell | undefined): boolean {
    const h = (cell?.color || "").replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return Math.max(r, g, b) < 110;
  }
  function isSubjectCell(cell: StitchCell | undefined): boolean {
    const h = (cell?.color || "").replace("#", "");
    if (h.length !== 6) return false;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Light-fabric halo rule: near-white + low saturation counts as background.
    return !(max >= 190 && (max - min) / max <= 0.2);
  }
  function darkComponentsInRows(grid: StitchCell[][], rowMax: number): number[] {
    const n = grid.length;
    const seen = new Set<string>();
    const comps: number[] = [];
    const dfs = (r: number, c: number): number => {
      if (r < 0 || r >= n || c < 0 || c >= n || seen.has(r + "," + c) || !isDarkCell(grid[r]?.[c])) return 0;
      seen.add(r + "," + c);
      let size = 1;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) size += dfs(r + dr, c + dc);
      return size;
    };
    for (let r = 0; r < Math.min(rowMax, n); r++) {
      for (let c = 0; c < n; c++) {
        if (isDarkCell(grid[r]?.[c]) && !seen.has(r + "," + c)) comps.push(dfs(r, c));
      }
    }
    return comps;
  }
  function topRowsFreeOfSubject(grid: StitchCell[][], rows: number): boolean {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: grid[r].length }, (_, c) => !isSubjectCell(grid[r]?.[c])).every(Boolean)
    ).every(Boolean);
  }
  it("keeps the top margin and two separate ear bumps on small AI grids (orn3 09-11 17:57 regression)", async () => {
    const png = await sharp(Buffer.from(ORN3_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { outlinePreserve: true });
    // NO hallucinated top cap: the source's blank top rows stay blank.
    expect(topRowsFreeOfSubject(result.grid, 5)).toBe(true);
    // Rows 0..5 must contain NO dark cells (previously a solid fused dome).
    const topDark = darkComponentsInRows(result.grid, 6);
    expect(topDark.reduce((a, b) => a + b, 0)).toBe(0);
    // The ears survive as TWO separate dark components in the top half.
    const earComps = darkComponentsInRows(result.grid, 22);
    expect(earComps.filter(s => s >= 2).length).toBeGreaterThanOrEqual(2);
    // The design still reads as a subject (not a sparse ghost).
    expect(countDarkCells(result.grid)).toBeGreaterThanOrEqual(30);
  });
  it("upload path (no outlinePreserve) keeps the auto-trim zoom for small grids", async () => {
    const png = await sharp(Buffer.from(ORN3_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 });
    // Without the small-AI exemption the trim still shaves the margin, so the
    // subject reaches the canvas top — recognizability zoom unchanged.
    expect(topRowsFreeOfSubject(result.grid, 4)).toBe(false);
  });
  it("larger product grids (70x70) keep the trim — small-AI exemption is size-gated", async () => {
    const png = await sharp(Buffer.from(ORN3_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 70, 16, { width: 70, height: 70 }, { outlinePreserve: true });
    // 70 > 60 → trim still applies (previous #167/#168 behavior preserved).
    expect(topRowsFreeOfSubject(result.grid, 4)).toBe(false);
    expect(result.grid.length).toBe(70);
  });

  // ─── Deterministic rim margin (owner 09-11 18:05 "cut off, not recognisable") ──
  // Step 6: small AI product grids must keep the subject INSIDE the ornament
  // circle with a visible top margin EVEN IF the model draws edge-to-edge
  // (a full-bleed subject would land against the circle apex at the canvas top).
  // FULLBLEED_SVG pushes the same bear to the very top edge (ears clipped by the
  // canvas), so the converted 42×42 grid would otherwise touch row 0.
  const FULLBLEED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#ffffff"/>
  <g stroke="#404040" stroke-width="26" stroke-linejoin="round">
    <circle cx="380" cy="95" r="95" fill="#c8b090"/>
    <circle cx="644" cy="95" r="95" fill="#c8b090"/>
    <ellipse cx="512" cy="250" rx="270" ry="235" fill="#c8b090"/>
    <ellipse cx="512" cy="690" rx="240" ry="200" fill="#c8b090"/>
    <ellipse cx="512" cy="330" rx="95" ry="70" fill="#e8dcc8"/>
    <circle cx="420" cy="255" r="22" fill="#404040"/>
    <circle cx="604" cy="255" r="22" fill="#404040"/>
    <ellipse cx="512" cy="320" rx="24" ry="16" fill="#404040"/>
  </g>
</svg>`;
  function subjectTopRow(grid: StitchCell[][]): number {
    const n = grid.length;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (isSubjectCell(grid[r]?.[c])) return r;
      }
    }
    return n; // empty
  }
  function subjectBottomRow(grid: StitchCell[][]): number {
    const n = grid.length;
    for (let r = n - 1; r >= 0; r--) {
      for (let c = 0; c < n; c++) {
        if (isSubjectCell(grid[r]?.[c])) return r;
      }
    }
    return -1;
  }
  it("full-bleed small product source is inset INSIDE the rim deterministically (Step 6)", async () => {
    const png = await sharp(Buffer.from(FULLBLEED_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { outlinePreserve: true });
    // Subject no longer touches the top: deterministic band (≈3 cells at 42).
    const top = subjectTopRow(result.grid);
    const bottom = subjectBottomRow(result.grid);
    expect(top).toBeGreaterThanOrEqual(3);
    expect(bottom).toBeLessThanOrEqual(42 - 1 - 3);
    // No dark cells hallucinated above the band.
    const topDark = darkComponentsInRows(result.grid, 3);
    expect(topDark.reduce((a, b) => a + b, 0)).toBe(0);
    // The subject still survives (shrunken, not erased).
    expect(bottom - top).toBeGreaterThan(8);
    expect(countDarkCells(result.grid)).toBeGreaterThanOrEqual(10);
  });
  it("Step 6 is size-gated: 70x70 full-bleed product source stays edge-to-edge", async () => {
    const png = await sharp(Buffer.from(FULLBLEED_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 70, 16, { width: 70, height: 70 }, { outlinePreserve: true });
    expect(subjectTopRow(result.grid)).toBeLessThan(3);
  });
  it("step 6 no-ops when the subject already has a margin (orn3 source)", async () => {
    const png = await sharp(Buffer.from(ORN3_SVG)).png().toBuffer();
    const result = await imageBufferToStitchGrid(png, 42, 16, { width: 42, height: 42 }, { outlinePreserve: true });
    // The margined fixture keeps its natural insertion: top rows blank, no cap.
    expect(topRowsFreeOfSubject(result.grid, 5)).toBe(true);
    expect(subjectTopRow(result.grid)).toBeGreaterThanOrEqual(6);
  });
});

// ─── Subject→descriptor lexicon (owner 09-14 expansion: blue bird, house, fish, …) ───
describe("padUnderSpecifiedPrompt lexicon", () => {
  it("lexicon: bare/named craft subjects get their rich descriptor", () => {
    const cases: Array<[string, string]> = [
      ["teddy bear", "soft brown fur"], ["bird", "bright orange beak"],
      ["blue bird", "soft blue feathers"], ["red bird", "vivid red feathers"],
      ["house", "cozy storybook house"], ["fish", "smooth shiny scales"],
      ["cat", "round green eyes"], ["dog", "floppy ears"],
      ["butterfly", "delicate symmetrical patterns"], ["flower", "layered colorful petals"],
      ["heart", "plump rounded heart"], ["star", "bright golden star"],
      ["bunny", "long soft ears"], ["rabbit", "long soft ears"],
      ["snowman", "carrot nose"], ["tree", "round green foliage"],
      ["mushroom", "rounded red cap"], ["penguin", "white belly"],
      ["owl", "round golden eyes"], ["frog", "webbed feet"],
      ["duck", "orange bill"], ["bee", "fuzzy striped bee"],
      ["ladybug", "black spots"], ["fox", "bushy tail"], ["horse", "flowing mane"],
    ];
    for (const [prompt, marker] of cases) {
      const padded = padUnderSpecifiedPrompt(prompt);
      expect(padded.startsWith(prompt)).toBe(true);
      expect(padded).toContain(marker);
      expect(padded).toContain("polished children's-book illustration style");
    }
  });
  it("lexicon: wrong-case + color+noun merge; unknown short prompts get generic fallback; descriptive stays verbatim", () => {
    expect(padUnderSpecifiedPrompt("Blue Bird")).toContain("soft blue feathers");
    expect(padUnderSpecifiedPrompt("BLUE BIRD")).toContain("soft blue feathers");
    expect(padUnderSpecifiedPrompt("pink bird")).toContain("soft pink feathers");
    expect(padUnderSpecifiedPrompt("purple cat")).toContain("round purple eyes");
    expect(padUnderSpecifiedPrompt("a yellow sunflower")).toContain("bright yellow petals");
    expect(padUnderSpecifiedPrompt("kangaroo")).toContain("soft detailed textures, rich colors, clear simple shapes");
    expect(padUnderSpecifiedPrompt("teddy bear with a brown sweater")).toBe("teddy bear with a brown sweater");
    expect(padUnderSpecifiedPrompt("cute cat")).toBe("cute cat");
    expect(padUnderSpecifiedPrompt("red truck")).toBe("red truck");
    expect(padUnderSpecifiedPrompt("sunset beach scene")).toBe("sunset beach scene");
  });
});
