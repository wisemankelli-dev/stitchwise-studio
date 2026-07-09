/**
 * AI Collage Generation API Routes.
 *
 * Endpoints:
 *   POST /api/ai/collage/text-to-collage  — Generate a collage layout from a text prompt
 *   POST /api/ai/collage/image-to-collage — Convert an uploaded image to collage layers
 */
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { TextToCollageSchema, ImageToCollageSchema } from "../../domain/ai/collageAI";
import { generateCollageImage, imageUrlToCollageLayers, imageBufferToCollageLayers, generateCollageLayoutFromPrompt } from "../services/leonardoCollageService";
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
 * Creates a router for AI Collage generation endpoints.
 */
export function createAICollageRouter(): Router {
  const router = Router();

  /**
   * POST /api/ai/collage/text-to-collage
   *
   * Generate a collage layout from a text description.
   * Uses Leonardo AI to generate an image, then converts it to fabric layers.
   * Falls back to smart mock generation when no API key is configured.
   *
   * Request body: { prompt: string, gridSize?: 16|24|32|48|64, negativePrompt?: string }
   * Response: { success: true, data: CollageGenerationResult }
   */
  router.post(
    "/ai/collage/text-to-collage",
    authenticate,
    async (req: Request, res: Response) => {
      try {
        const parsed = TextToCollageSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }
        const { prompt, gridSize, negativePrompt } = parsed.data;

        // Try Leonardo AI generation, fall back to mock
        const generation = await generateCollageImage(prompt, negativePrompt);
        if (generation.url && !generation.url.includes("placehold.co")) {
          // Real AI generation — convert image to collage layers
          const collage = await imageUrlToCollageLayers(generation.url, gridSize);
          res.json({
            success: true,
            data: {
              ...collage,
              previewUrl: generation.url,
              prompt,
            },
          });
        } else {
          // Mock mode — generate from prompt keywords
          const collage = generateCollageLayoutFromPrompt(prompt, gridSize);
          res.json({
            success: true,
            data: collage,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "text_to_collage_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  /**
   * POST /api/ai/collage/image-to-collage
   *
   * Convert an uploaded image (PNG, JPEG, WebP, GIF) to collage fabric layers.
   * Multipart form: file (image) + gridSize (optional)
   *
   * Response: { success: true, data: CollageGenerationResult }
   */
  router.post(
    "/ai/collage/image-to-collage",
    authenticate,
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        // Coerce string gridSize to number (form data sends strings)
        const body = {
          ...req.body,
          gridSize: req.body.gridSize ? Number(req.body.gridSize) : undefined,
        };
        const parsed = ImageToCollageSchema.safeParse(body);
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
        // Convert the uploaded image buffer to collage layers
        const collage = await imageBufferToCollageLayers(req.file.buffer, gridSize);
        res.json({
          success: true,
          data: collage,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "image_to_collage_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}