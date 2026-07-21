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
import { generateImageFromText } from "../services/leonardoAIService";
import {
  imageUrlToStitchGrid,
  imageBufferToStitchGrid,
  resizeStitchGrid,
} from "../../domain/stitch/patternConverter";
import { generatePatternFromPrompt } from "../../domain/ai/patternGenerator";
import { generateShape, listShapes } from "../../domain/ai/shapeLibrary";
import { optionalAuth } from "../middleware/auth";

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
  return {
    success: true,
    grid: flatGrid,
    stitchTypes: flatGrid.map(row => row.map(() => "cross")),
    width: pattern.gridSize,
    height: pattern.gridSize,
    dmcPalette: pattern.dmcColors.map(c => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      count: c.count,
    })),
    totalStitches: pattern.stitchCount,
    gridSizes: [...AVAILABLE_GRID_SIZES],
    ...extra,
  };
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
   * Uses Stability AI to generate an image, then converts it to a stitch grid.
   *
   * Request body: { prompt: string, gridSize?: 50|75|100|150|200, negativePrompt?: string }
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches, gridSizes, ... }
   */
  router.post(
    "/ai/embroidery/text-to-pattern",
    optionalAuth,
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

        const { prompt, gridSize, negativePrompt } = parsed.data;

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

        let pattern: PatternResult;

        if (matchedShape) {
          // Use Shape Library directly — instant, pixel-perfect, no AI needed
          const gs = gridSize || DEFAULT_GRID_SIZE;
          pattern = generateShape(matchedShape, gs);
        } else {
          // No shape match — use AI image generation
          const styleHints = "simple flat vector illustration, bright bold colors, clip art style, solid color blocks with no gradients, no shading, clean simple shapes, colorful design, easy to trace, minimal detail, high contrast, bold outlines, suitable for embroidery";
          const enhancedPrompt = `${prompt}, ${styleHints}`;

          // Step 1: Generate image from text using Stability AI
          const generation = await generateImageFromText(enhancedPrompt, negativePrompt);

          if (!generation.url) {
            res.status(500).json({
              success: false,
              error: "AI generation returned no image URL",
            });
            return;
          }

          if (generation.isMock) {
            // Use direct stitch grid generation (avoids downscale blur)
            const gs = gridSize || DEFAULT_GRID_SIZE;
            pattern = generatePatternFromPrompt(prompt, gs);
          } else {
            // Step 2: Download the real AI-generated image and convert to stitch grid
            pattern = await imageUrlToStitchGrid(generation.url, gridSize);
          }
        }

        res.json(buildPatternResponse(pattern, { promptUsed: prompt, processingTimeMs: 0 }));
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
      const gs = validSizes.includes(Number(gridSize)) ? Number(gridSize) : DEFAULT_GRID_SIZE;

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