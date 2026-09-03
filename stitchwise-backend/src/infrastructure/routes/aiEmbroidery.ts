/**
 * AI Embroidery Pattern Generation API Routes.
 *
 * Endpoints:
 *   POST /api/ai/embroidery/text-to-pattern  — Generate a pattern from a text prompt
 *   POST /api/ai/embroidery/image-to-pattern — Convert an uploaded image to a pattern
 *   POST /api/ai/embroidery/resize-pattern   — Re-process an existing grid at a different size
 *   POST /api/ai/embroidery/shape-to-pattern  — Generate a pattern from a predefined shape
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  TextToPatternSchema,
  ImageToPatternSchema,
  ResizePatternSchema,
  AVAILABLE_GRID_SIZES,
  DEFAULT_GRID_SIZE,
  type PatternResult,
  type StitchCell,
} from "../../domain/ai/embroideryAI";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";
import { generateImageWithDallE } from "../services/openaiImageService";
import {
  imageUrlToStitchGrid,
  imageBufferToStitchGrid,
  resizeStitchGrid,
} from "../../domain/stitch/patternConverter";
import { generateShape, listShapes } from "../../domain/ai/shapeLibrary";
import { optionalAuth } from "../middleware/auth";
import {
  DEFAULT_FABRIC_COUNT,
  AVAILABLE_FABRIC_COUNTS,
  getMaxColors,
} from "../../domain/stitch/fabricCounts";
import { generateSubjectPattern } from "../../domain/stitch/subjectPatternGenerator";
import { aiRateLimit, isPremiumTier } from "../middleware/aiRateLimit";
import { createAIJob } from "../services/aiJobStore";

/** Subjects that can be rendered deterministically without an image-generation call. */
export const PROCEDURAL_SUBJECT_NAMES = new Set([
  "sunflower", "bird", "bird on branch", "branch bird", "lunar moth",
  "luna moth", "butterfly", "rose", "heart", "love", "star", "stars",
  "peony", "bouquet", "flower bouquet", "pink flower",
]);

/** Return true only for a bare supported subject, optionally preceded by an article. */
export function shouldUseProceduralPattern(prompt: string): boolean {
  const normalized = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const withoutArticle = normalized.replace(/^(?:a|an|the)\s+/, "");
  return PROCEDURAL_SUBJECT_NAMES.has(withoutArticle);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: PNG, JPEG, WebP, GIF"));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a StitchCell[][] grid to a flat string[][] of hex colors for the frontend.
 */
function flattenGrid(grid: StitchCell[][]): string[][] {
  return grid.map(row => row.map(cell => cell.color));
}

/**
 * Build the standard pattern response body shared across endpoints.
 */
function buildPatternResponse(pattern: PatternResult, extra: Record<string, unknown> = {}) {
  const flatGrid = flattenGrid(pattern.grid);
  const gridH = flatGrid.length;
  const gridW = flatGrid[0]?.length || 0;
  return {
    success: true,
    grid: flatGrid,
    stitchTypes: flatGrid.map(row => row.map(() => "cross")),
    width: gridW || pattern.gridSize,
    height: gridH || pattern.gridSize,
    dmcPalette: pattern.dmcColors.map((c, i) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      count: c.count,
      symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
    })),
    totalStitches: pattern.stitchCount,
    gridSizes: [...AVAILABLE_GRID_SIZES],
    ...extra,
  };
}

/** Clamp a raw stitch count to the nearest valid grid size. */
function clampToGridSize(raw: number): number {
  const sizes = AVAILABLE_GRID_SIZES as readonly number[];
  let closest = sizes[0];
  let minDiff = Math.abs(raw - closest);
  for (const s of sizes) {
    const diff = Math.abs(raw - s);
    if (diff < minDiff) { minDiff = diff; closest = s; }
  }
  return closest;
}

/**
 * Aspect-aware, vibrant prompt enrichment.
 *
 * Fixes (owner 09-03): "colorful floral stocking" came out 27% filled / 5
 * browns, and "sunset beach scene → ornament" came out a blob. Root causes
 * handled here:
 *  1. NO color-draining hints — "flat vector art, solid flat colors only, no
 *     gradients, no shading, white background" gutted vibrant asks. We append
 *     VIBRANT, color-rich, subject-fills-shape guidance instead.
 *  2. Product-shape fill — when a stocking/ornament/canvas shape is active,
 *     we tell the model to fill that silhouette with the subject so coverage
 *     stays dense (no large blank fabric).
 *  3. Padding (owner 09-03 #2): a SQUARE or LANDSCAPE canvas is a FRAME, not
 *     a cutout — the subject must stay fully inside with margins on every
 *     side (5–10%), never bleeding to the edge ("teddy bear cut off top and
 *     bottom"). PORTRAIT/tall canvases and explicit product shapes keep the
 *     edge-to-edge fill phrase (that's what fixed the 27%-filled stocking).
 *  4. Scene guard — "scene"/"beach"/"landscape"/"sunset" prompts get a
 *     "landscape scene only, no people, no text" guard so a sunset becomes a
 *     scene, not a person-blob.
 */

/** True when the canvas should be treated as a frame with margins (square or
 * landscape), as opposed to a product shape / tall canvas that fills. */
export function isSquareOrLandscape(
  canvasWidth?: number,
  canvasHeight?: number,
): boolean {
  if (!canvasWidth || !canvasHeight) return true; // default square canvas → frame
  return canvasWidth >= canvasHeight;               // 1:1 or wider
}
/**
 * True when this request is a PICTURE FRAME (needs margins) rather than a
 * product shape (stocking/ornament/pillow — meant to fill edge-to-edge).
 * A canvas is a frame ONLY for the explicit 'rect'/'square' shape on a
 * square/landscape canvas, or for NO shape on a square/landscape canvas.
 * Explicit product shapes are NEVER frames even when the canvas is square
 * (e.g. a 3″×3″ ornament preset is 42×42 → NOT a frame; it fills the bauble).
 * This is the SINGLE source of truth used by enrichAIPrompt, the converter
 * margin band, and the quality gate so they cannot drift apart (owner 09-03
 * #4: ornament was misclassified as a frame → contain margins shrunk the
 * subject at 42 cells → frontend circle clip → unrecognisable blob).
 */
export function isFrameCanvas(
  shape?: "stocking" | "ornament" | "pillow" | "square" | "rect",
  canvasWidth?: number,
  canvasHeight?: number,
): boolean {
  const isExplicitRect = shape === "square" || shape === "rect";
  return (isExplicitRect && isSquareOrLandscape(canvasWidth, canvasHeight)) ||
    (!shape && isSquareOrLandscape(canvasWidth, canvasHeight));
}

export function enrichAIPrompt(
  prompt: string,
  shape?: "stocking" | "ornament" | "pillow" | "square" | "rect",
  opts?: { canvasWidth?: number; canvasHeight?: number },
): { prompt: string; sceneGuardApplied: boolean; shapeHintApplied: boolean } {
  const enriched: string[] = [prompt];
  const lower = prompt.toLowerCase();
  let sceneGuardApplied = false;
  let shapeHintApplied = false;

  // Vibrant / color-rich guidance (replaces the old color-draining hints).
  enriched.push(
    "vibrant, saturated, colorful illustration",
    "bold rich colors in every area, no dull muddy tones",
  );

  // Product-shape fill — the art must cover the shape, not float on white.
  // Tall/narrow canvases (stocking etc.) also fill edge-to-edge. But a
  // SQUARE / LANDSCAPE canvas is a picture frame: keep the subject inside
  // with comfortable margins so nothing gets cropped (owner: teddy bear cut
  // off at top/bottom).
  const isExplicitRect = shape === "square" || shape === "rect";
  const isFrame = isFrameCanvas(shape, opts?.canvasWidth, opts?.canvasHeight);

  if (shape === "stocking") {
    enriched.push("tall vertical stocking shape completely filled with the subject, edge to edge, no blank space");
    shapeHintApplied = true;
  } else if (shape === "ornament") {
    enriched.push("perfectly fill a circular ornament bauble with the subject, edge to edge, no empty corners");
    shapeHintApplied = true;
  } else if (shape === "pillow") {
    enriched.push("perfectly fill a rounded square pillow with the subject, edge to edge, no empty corners");
    shapeHintApplied = true;
  } else if (isFrame) {
    // Square/landscape canvas → frame with padding, never crop the subject.
    enriched.push(
      "subject fills the frame with comfortable padding and margins on all sides, the entire subject stays fully inside the canvas, nothing touches the edges, leave 5-10% margin around the subject, head not cropped at top, feet and hands not cropped at bottom",
    );
    shapeHintApplied = true;
  } else if (shape === "square" || shape === "rect") {
    // Explicit square/rect shape with a TALL canvas → keep old fill behavior.
    enriched.push("subject fills the whole rectangular frame, edge to edge, no empty margins");
    shapeHintApplied = true;
  } else {
    enriched.push("subject fills most of the frame");
  }

  // Scene guard — a beach/sunset/landscape is a SCENE, not a person portrait.
  if (/\b(scene|beach|landscape|sunset|sunrise|seascape|mountain|forest|garden|street|city)\b/.test(lower)) {
    enriched.push("landscape scene only, no people, no faces, no text, no watermark");
    sceneGuardApplied = true;
  }

  return { prompt: enriched.join(", "), sceneGuardApplied, shapeHintApplied };
}

/** Map canvas dims to the closest Gemini-supported aspect ratio. */
export function aspectFromCanvas(canvasWidth?: number, canvasHeight?: number): "1:1" | "2:3" | "3:4" | "9:16" | "16:9" {
  if (!canvasWidth || !canvasHeight) return "1:1";
  const ratio = canvasWidth / canvasHeight;
  if (ratio < 0.6) return "9:16";       // very tall (stocking)
  if (ratio < 0.8) return "2:3";        // tall
  if (ratio < 1.3) return "1:1";        // roughly square
  if (ratio < 1.8) return "3:4";        // wide-ish
  return "16:9";                         // very wide
}

/**
 * True when the subject of a SQUARE/LANDSCAPE (frame) canvas touches any
 * canvas edge — the classic "cut off on the page" symptom (owner 09-03:
 * teddy bear had 0px top/bottom margin). Only meaningful for frame canvases:
 * product shapes (stocking/ornament/pillow) are SUPPOSED to fill edge-to-edge.
 *
 * Returns the touched edge(s) or null when the subject has margin everywhere.
 */
export function subjectTouchesEdge(
  grid: StitchCell[][],
  dmcColors: { hex: string; count: number }[],
): "top" | "bottom" | "left" | "right" | null {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  if (rows < 3 || cols < 3) return null; // too small to judge
  const bgHex = [...dmcColors].sort((a, b) => b.count - a.count)[0]?.hex?.toLowerCase() || "";
  const isBackground = (hex: string) => {
    const h = (hex || "").toLowerCase();
    if (!h) return false;
    if (h === bgHex) return true;
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return r > 245 && g > 245 && b > 245;
  };
  const nonBg = (r: number, c: number) => {
    const cell = grid[r]?.[c];
    return !!cell?.color && !isBackground(cell.color);
  };
  // Check vertical edges (left/right) first, excluding corners so a fill
  // that reaches a corner is still classified by its dominant edge.
  for (let r = 1; r < rows - 1; r++) if (nonBg(r, 0)) return "left";
  for (let r = 1; r < rows - 1; r++) if (nonBg(r, cols - 1)) return "right";
  for (let c = 1; c < cols - 1; c++) if (nonBg(0, c)) return "top";
  for (let c = 1; c < cols - 1; c++) if (nonBg(rows - 1, c)) return "bottom";
  // Corner-only touches (rare): fall back to any edge.
  if (nonBg(0, 0) || nonBg(0, cols - 1) || nonBg(rows - 1, 0) || nonBg(rows - 1, cols - 1)) return "top";
  return null;
}

/**
 * Quality gate for AI→pattern conversion (owner 09-03: mud/sparse grids were
 * silently saved). Validates coverage (fill%) and color diversity after
 * conversion. Returns a warning string when the conversion did NOT come out
 * clean so the frontend can show it instead of silently saving a blob.
 */
export function qualityGate(
  grid: StitchCell[][],
  dmcColors: { hex: string; count: number }[],
  prompt: string,
  opts?: { frame?: boolean; canvasWidth?: number; canvasHeight?: number },
): string | null {
  const total = grid.length * (grid[0]?.length || 0);
  if (total === 0) return "AI image did not convert to any stitches — try a more specific prompt";
  // Count filled cells: a cell is "filled" when it has a color that is NOT the
  // dominant background (light/white fabric reads as blank).
  const bgHex = [...dmcColors].sort((a, b) => b.count - a.count)[0]?.hex?.toLowerCase() || "";
  const isBackground = (hex: string) => {
    const h = (hex || "").toLowerCase();
    if (!h) return false;
    if (h === bgHex) return true;
    // Near-white / near-fabric tones count as background (DMC B5200 / 520 / white).
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return r > 245 && g > 245 && b > 245;
  };
  let filled = 0;
  for (const row of grid) for (const cell of row) if (cell?.color && !isBackground(cell.color)) filled++;
  const fillPct = (filled / total) * 100;
  const nonBgColors = [...new Set(grid.flat().map(c => c?.color).filter(c => c && !isBackground(c)))].length;
  const warnings: string[] = [];
  if (fillPct < 30) {
    warnings.push(`only ${Math.round(fillPct)}% of the canvas is filled — the AI image did not cover the shape; try a more specific prompt`);
  }
  if (nonBgColors < 5) {
    warnings.push(`only ${nonBgColors} distinct colors came through — the image may have converted muddy; try naming 2–3 key colors`);
  }
  // Frame-canvas margin check — this is the "cut off on the page" symptom
  // (owner 09-03: teddy bear at 0px top/bottom). Only when opts.frame is
  // true so product shapes (stocking/ornament/pillow, meant to fill) don't warn.
  if (opts?.frame) {
    const touched = subjectTouchesEdge(grid, dmcColors);
    if (touched) {
      warnings.push(`the subject touches the ${touched} edge of the canvas — it may look cut off in the pattern; try including a little margin around the subject`);
    }
  }
  return warnings.length ? warnings.join(" · ") : null;
}

/**
 * Creates a router for AI Embroidery pattern generation endpoints.
 */
export function createAIEmbroideryRouter(): Router {
  const router = Router();

  /**
   * POST /api/ai/embroidery/text-to-pattern
   *
   * Generate an embroidery pattern from a text description.
   * Uses OpenAI DALL-E to generate an image, then converts it to a stitch grid.
   *
   * Request body: { prompt: string, gridSize?: 50|75|100|150|200, negativePrompt?: string }
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes, ... }
   */
  router.post(
    "/ai/embroidery/text-to-pattern",
    optionalAuth,
    aiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const parsed = TextToPatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { prompt, gridSize: rawGridSize, negativePrompt, fabricCount, desiredInches, premiumModel, canvasWidth, canvasHeight, aspectRatio: aspectRatioOpt, shape } = parsed.data;
        const premium = premiumModel === true && isPremiumTier((req as any).user?.tier);

        // Resolve fabric-aware grid size and color limit
        const fc = fabricCount || DEFAULT_FABRIC_COUNT;
        const maxColors = getMaxColors(fc);
        let gridSize = rawGridSize;
        if (desiredInches && desiredInches > 0) {
          const rawStitches = Math.round(desiredInches * fc);
          gridSize = clampToGridSize(rawStitches) as typeof rawGridSize;
        }
        const fabricInches = (gridSize || DEFAULT_GRID_SIZE) / fc;

        // Aspect-aware generation: prefer the caller's canvas dims. When the
        // canvas is tall (stocking 154×238) we generate TALL art instead of a
        // square that gets framed into a narrow canvas (27% fill bug).
        const aspect = aspectRatioOpt ?? aspectFromCanvas(canvasWidth, canvasHeight);
        const genW = canvasWidth ?? gridSize ?? DEFAULT_GRID_SIZE;
        const genH = canvasHeight ?? gridSize ?? DEFAULT_GRID_SIZE;

        // ── Priority 0: Procedural subject pattern (no AI) ──────────────────
        // Only bare known subject names use the procedural fast path. Any
        // qualifier (for example, "yellow" in "a yellow sunflower") must
        // reach OpenAI for an image preview.
        const proceduralPattern = shouldUseProceduralPattern(prompt)
          ? generateSubjectPattern(prompt, gridSize || DEFAULT_GRID_SIZE)
          : null;
        if (proceduralPattern) {
          console.error(JSON.stringify({
            event: "procedural_pattern_generated",
            prompt: prompt,
            gridSize: proceduralPattern.gridSize,
          }));

          const flatGrid = flattenGrid(proceduralPattern.grid);
          res.json({
            success: true,
            grid: flatGrid,
            stitchTypes: flatGrid.map(row => row.map(() => "cross")),
            width: proceduralPattern.gridSize,
            height: proceduralPattern.gridSize,
            dmcPalette: proceduralPattern.dmcColors.map((c, i) => ({
              code: c.code,
              name: c.name,
              hex: c.hex,
              count: c.count,
              symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
            })),
            totalStitches: proceduralPattern.stitchCount,
            gridSizes: [...AVAILABLE_GRID_SIZES],
            promptUsed: prompt,
            processingTimeMs: 0,
            fabric: { count: fc, inches: +fabricInches.toFixed(2) },
            pipeline: "procedural",
          });
          return;
        }

        // Check if the prompt matches a known shape — if so, use the Shape Library directly.
        const shapeKeywords: Record<string, RegExp[]> = {
          rabbit: [/rabbit/i, /bunny/i, /hare/i],
          cat: [/cat/i, /kitten/i, /kitty/i],
          dog: [/dog/i, /puppy/i, /pup/i],
          bird: [/bird/i, /cardinal/i, /robin/i, /sparrow/i, /bluejay/i, /chick/i, /goose/i, /geese/i, /duck/i, /swan/i, /owl/i, /eagle/i, /hawk/i, /parrot/i, /penguin/i, /flamingo/i, /peacock/i],
          butterfly: [/butterfly/i, /moth/i],
          heart: [/heart/i, /love/i, /valentine/i],
          flower: [/flower/i, /floral/i, /rose/i, /blossom/i, /tulip/i, /daisy/i, /sunflower/i, /bloom/i, /lotus/i, /orchid/i, /lily/i, /lavender/i, /poppy/i, /iris/i],
          star: [/star/i, /starburst/i, /shining/i, /twinkle/i, /sparkle/i],
          geometric: [/geometric/i, /mandala/i, /symmetry/i, /pattern/i, /tile/i, /spiral/i, /kaleidoscope/i],
          fish: [/fish/i, /goldfish/i, /koi/i, /betta/i, /tropical/i, /seahorse/i],
          boat: [/boat/i, /ship/i, /sailboat/i, /yacht/i, /canoe/i, /kayak/i, /rowboat/i, /schooner/i],
          house: [/house/i, /home/i, /cottage/i, /cabin/i, /barn/i, /castle/i, /church/i, /tower/i],
          tree: [/tree/i, /pine/i, /oak/i, /forest/i, /leaf/i, /palm/i, /christmas tree/i, /evergreen/i, /maple/i],
          dragon: [/dragon/i, /drake/i, /wyvern/i],
          shell: [/shell/i, /conch/i, /seashell/i, /snail/i, /scallop/i, /nautilus/i],
          can: [/can/i, /coke/i, /soda/i, /cola/i, /bottle/i, /tin/i, /beer/i, /aluminum/i],
          car: [/car/i, /truck/i, /auto/i, /vehicle/i, /race/i],
          bear: [/bear/i, /teddy/i, /teddybear/i, /cub/i, /panda/i, /grizzly/i],
        };

        let matchedShape: string | null = null;
        for (const [shape, patterns] of Object.entries(shapeKeywords)) {
          if (patterns.some(p => p.test(prompt))) {
            matchedShape = shape;
            break;
          }
        }

        let pattern: PatternResult | null = null;

        let previewUrl: string | undefined;
        

        if (matchedShape) {
          // Only use Shape Library when the prompt is JUST the shape name
          // (possibly with articles). "monarch butterfly" should go to AI,
          // because "monarch" is a descriptor, not a shape keyword.
          const words = prompt.toLowerCase().split(/\s+/).filter(w => !['a','an','the','my'].includes(w));
          const allWordsAreShapeKeywords = words.every(w => shapeKeywords[matchedShape!]?.some(p => p.test(w)));
          if (allWordsAreShapeKeywords) {
            const gs = gridSize || DEFAULT_GRID_SIZE;
            pattern = generateShape(matchedShape, gs);
          }
        }
        if (!pattern) {
          // Slow AI path (Gemini routinely takes 30-60s). Return 202 + jobId
          // immediately and run the pipeline in the background so the platform
          // gateway's ~30s upstream timeout is never hit.
          const jobId = createAIJob(async () => {
            const userId = (req as any).user?.userId;
            // Enrich the prompt: vibrant + shape-fill + scene guard, NO
            // color-draining hints (owner 09-03: "flat colors/no gradients/
            // white background" gutted colorful asks into 5 browns).
            // Square/landscape canvases become a PADDED FRAME so the subject
            // never bleeds to the edge (owner 09-03 #2: teddy bear cut off).
            // Explicit product shapes (shoes/ornament/pillow) are NEVER frames
            // even on square canvases — they fill edge-to-edge (owner 09-03 #4:
            // the 42×42 ornament was wrongly framed → blob after circle clip).
            const isFrameCanvasResult = isFrameCanvas(shape, genW, genH);
            const { prompt: finalPrompt, sceneGuardApplied, shapeHintApplied } = enrichAIPrompt(
              prompt,
              shape,
              { canvasWidth: genW, canvasHeight: genH },
            );
            console.error(JSON.stringify({
              event: "ai_prompt_sent",
              originalPrompt: prompt,
              finalPrompt,
              enrichment: { sceneGuardApplied, shapeHintApplied, shape, aspect, frame: isFrameCanvasResult },
            }));

            // Gemini (sole provider) — aspect-aware art (tall for stocking).
            const dalleResult = await generateImageWithDallE(finalPrompt, undefined, userId, premium, aspect);
            if (!dalleResult?.buffer) {
              throw new Error("AI generation returned no image");
            }
            const preview = `data:image/png;base64,${dalleResult.buffer.toString("base64")}`;
            // Color cap: floor higher than before so vibrant scenes keep
            // enough colors (owner: sunset scene collapsed to 4 muddy colors
            // at cap 6). Raise the floor to 16 so painterly shading collapses
            // into identity colors instead of gray-beige mud.
            const aiColorCap = Math.max(16, Math.round(maxColors * 0.9));
            // Convert at the CANVAS aspect/size, not always square 200.
            // Frame canvases (square/landscape) get the deterministic margin
            // band so the subject always sits inside a visible border — the
            // model may ignore the margin prompt, so we enforce it in the grid.
            const grid = await imageBufferToStitchGrid(
              dalleResult.buffer,
              gridSize,
              Math.min(maxColors, aiColorCap),
              { width: genW, height: genH },
              { margin: isFrameCanvasResult },
            );
            // Quality gate — warn (don't silently save) when the conversion
            // came out sparse/muddy, OR (on frame canvases) the subject
            // bleeds to an edge.
            const qualityWarning = qualityGate(grid.grid, grid.dmcColors, prompt, {
              frame: isFrameCanvasResult,
              canvasWidth: genW,
              canvasHeight: genH,
            });
            return buildPatternResponse(grid, {
              promptUsed: finalPrompt,
              processingTimeMs: 0,
              fabric: { count: fc, inches: +fabricInches.toFixed(2) },
              previewUrl: preview,
              ...(qualityWarning ? { qualityWarning } : {}),
            });
          });
          res.status(202).json({ jobId });
          return;
        }

        res.json(buildPatternResponse(pattern, {
          promptUsed: prompt,
          processingTimeMs: 0,
          fabric: { count: fc, inches: +fabricInches.toFixed(2) },
          previewUrl,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "text_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/image-to-pattern
   *
   * Convert an uploaded image (PNG, JPEG, WebP, GIF) to an embroidery pattern.
   * Returns the clean stitch grid plus the original image as a base64 data URL
   * so the frontend can display both side by side.
   *
   * Multipart form: file (image) + gridSize (optional)
   *
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes, originalImageData }
   */
  router.post(
    "/ai/embroidery/image-to-pattern",
    optionalAuth,
    aiRateLimit,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const parsed = ImageToPatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({
            success: false,
            error: "No image file provided. Upload a file with field name 'file'",
          });
          return;
        }

        const { gridSize, maxColors } = parsed.data;

        // Convert the uploaded image buffer to stitch grid
        const pattern = await imageBufferToStitchGrid(req.file.buffer, gridSize, maxColors);

        // Convert the original uploaded image to a base64 data URL
        const mimeType = req.file.mimetype || "image/png";
        const originalImageData = `data:${mimeType};base64,${req.file.buffer.toString("base64")}`;

        res.json(buildPatternResponse(pattern, {
          promptUsed: `Image: ${req.file!.originalname}`,
          originalImageData,
          processingTimeMs: 0,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "image_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/resize-pattern
   *
   * Re-process an existing grid at a different size.
   * Takes the current stitch grid and a target grid size, then re-samples
   * using nearest-neighbor scaling. This lets the user switch sizes without
   * re-uploading the source image or re-running the AI.
   *
   * Request body: { grid: string[][], gridSize: 50|75|100|150|200 }
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes }
   */
  router.post(
    "/ai/embroidery/resize-pattern",
    (req: Request, res: Response) => {
      try {
        const parsed = ResizePatternSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { grid, gridSize, maxColors } = parsed.data;

        // Convert the flat string[][] grid back to StitchCell[][]
        const stitchGrid: StitchCell[][] = grid.map(row =>
          row.map(color => ({ color }))
        );

        resizeStitchGrid(stitchGrid, gridSize, maxColors).then(pattern => {
          res.json(buildPatternResponse(pattern, { processingTimeMs: 0 }));
        }).catch(err => {
          const message = err instanceof Error ? err.message : String(err);
          console.error({ event: "resize_pattern_error", error: message });
          res.status(500).json({ success: false, error: message });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "resize_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/embroidery/shape-to-pattern
   *
   * Generate a pattern from a predefined shape (no AI needed).
   * Shapes are drawn directly on the grid at the target resolution.
   *
   * Request body: { shape: string, gridSize?: 50|75|100|150|200 }
   * Available shapes: rabbit, cat, dog, bird, butterfly, heart, flower, star, geometric
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes }
   */
  router.post(
    "/ai/embroidery/shape-to-pattern",
    (req: Request, res: Response) => {
      const { shape, gridSize } = req.body;
      const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
      const gs = Number(gridSize) >= 8 && Number(gridSize) <= 200 ? Number(gridSize) : DEFAULT_GRID_SIZE;

      try {
        const pattern = generateShape(shape || "", gs);
        res.json(buildPatternResponse(pattern, { shape, processingTimeMs: 0 }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "shape_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}