/**
 * AI Embroidery Pattern Generation API Routes.
 *
 * Endpoints:
 *   POST /api/ai/embroidery/text-to-pattern  — Generate a pattern from a text prompt
 *   POST /api/ai/embroidery/image-to-pattern — Convert an uploaded image to a pattern
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { TextToPatternSchema, ImageToPatternSchema, type PatternResult } from "../../domain/ai/embroideryAI";
import { generateImageFromText } from "../services/leonardoAIService";
import { imageUrlToStitchGrid, imageBufferToStitchGrid } from "../../domain/stitch/patternConverter";
import { generatePatternFromPrompt } from "../../domain/ai/patternGenerator";
import { generateShape, listShapes } from "../../domain/ai/shapeLibrary";
import { authenticate, optionalAuth } from "../middleware/auth";

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

/**
 * Creates a router for AI Embroidery pattern generation endpoints.
 */
export function createAIEmbroideryRouter(): Router {
  const router = Router();

  /**
   * POST /api/ai/embroidery/text-to-pattern
   *
   * Generate an embroidery pattern from a text description.
   * Uses Leonardo AI to generate an image, then converts it to a stitch grid.
   *
   * Request body: { prompt: string, gridSize?: 16|24|32|48|64, negativePrompt?: string }
   * Response: { success: true, data: PatternResult }
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

        // Check if the prompt mentions specific colors — if so, skip the Shape Library
        // so the user's color choices are respected (the AI will generate exactly what
        // they asked for with the improved clip-art prompt and nearest-neighbor pipeline).
        const colorWords =
          /blue|red|green|yellow|orange|purple|pink|brown|black|white|gray|grey|gold|silver|teal|navy|maroon|magenta|violet|turquoise|aqua|coral|tan|beige|cream|ivory|bronze|rust|olive|mint|lavender|peach|salmon|indigo|charcoal|crimson|amber|emerald|jade|blush/i;

        // Check if the prompt matches a known shape — if so, use the Shape Library directly
        // (but only if no specific colors were mentioned, so user color preferences win).
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
        };

        // Check if the user specified specific colors — if so, skip shape library
        // so their color choices flow through to the AI pipeline
        const hasSpecificColors = colorWords.test(prompt);

        let matchedShape: string | null = null;
        if (!hasSpecificColors) {
          for (const [shape, patterns] of Object.entries(shapeKeywords)) {
            if (patterns.some(p => p.test(prompt))) {
              matchedShape = shape;
              break;
            }
          }
        }

        let pattern: PatternResult;

        if (matchedShape) {
          // Use Shape Library directly — instant, pixel-perfect, no AI needed
          const gs = gridSize || 32;
          pattern = generateShape(matchedShape, gs);
        } else {
          // No shape match — use AI image generation
          // Enhance prompt for embroidery-friendly output.
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
            const gs = gridSize || 32;
            pattern = generatePatternFromPrompt(prompt, gs);
          } else {
            // Step 2: Download the real AI-generated image and convert to stitch grid
            pattern = await imageUrlToStitchGrid(generation.url, gridSize);
          }
        }

        // Map StitchCell[][] to string[][] (hex colors) for frontend compatibility
        const flatGrid: string[][] = pattern.grid.map(row =>
          row.map(cell => cell.color)
        );

        res.json({
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
          promptUsed: prompt,
          processingTimeMs: 0,
        });
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
   * Multipart form: file (image) + gridSize (optional)
   *
   * Response: { success: true, data: PatternResult }
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

        const { gridSize } = parsed.data;

        // Convert the uploaded image buffer to stitch grid
        const pattern = await imageBufferToStitchGrid(req.file.buffer, gridSize);

        // Map StitchCell[][] to string[][] (hex colors) for frontend compatibility
        const flatGrid: string[][] = pattern.grid.map(row =>
          row.map(cell => cell.color)
        );

        res.json({
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
          promptUsed: `Image: ${req.file!.originalname}`,
          processingTimeMs: 0,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "image_to_pattern_error", error: message });
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
   * Request body: { shape: string, gridSize?: 16|24|32|48|64 }
   * Available shapes: rabbit, cat, dog, bird, butterfly, heart, flower, star, geometric
   * Response: { success: true, grid, stitchTypes, width, height, dmcPalette, totalStitches }
   */
  router.post(
    "/ai/embroidery/shape-to-pattern",
    (req: Request, res: Response) => {
      const { shape, gridSize } = req.body;
      const gs = [16, 24, 32, 48, 64].includes(gridSize) ? gridSize : 32;

      try {
        const pattern = generateShape(shape || "", gs);
        const flatGrid: string[][] = pattern.grid.map(row =>
          row.map(cell => cell.color)
        );

        res.json({
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
          shape,
          processingTimeMs: 0,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "shape_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}