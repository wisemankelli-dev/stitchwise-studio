/**
 * AI Embroidery Pattern Generation API Routes.
 *
 * Endpoints:
 *   POST /api/ai/embroidery/text-to-pattern  — Generate a pattern from a text prompt
 *   POST /api/ai/embroidery/image-to-pattern — Convert an uploaded image to a pattern
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { TextToPatternSchema, ImageToPatternSchema } from "../../domain/ai/embroideryAI";
import { generateImageFromText } from "../services/leonardoAIService";
import { imageUrlToStitchGrid, imageBufferToStitchGrid } from "../../domain/stitch/patternConverter";
import { authenticate } from "../middleware/auth";

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
    authenticate,
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

        // Step 1: Generate image from text using Leonardo AI
        const generation = await generateImageFromText(prompt, negativePrompt);

        if (!generation.url) {
          res.status(500).json({
            success: false,
            error: "AI generation returned no image URL",
          });
          return;
        }

        // Step 2: Download the generated image and convert to stitch grid
        const pattern = await imageUrlToStitchGrid(generation.url, gridSize);

        res.json({
          success: true,
          data: {
            ...pattern,
            previewUrl: generation.url,
            prompt,
          },
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
    authenticate,
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

        res.json({
          success: true,
          data: pattern,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "image_to_pattern_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}