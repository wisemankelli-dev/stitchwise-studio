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
import { generateCollageImage, imageUrlToCollageLayers, imageBufferToCollageLayers, generateCollageLayoutFromPrompt, attachMockPiecesToCollage } from "../services/openaiCollageService";
import { generateCollagePatternPdf } from "../services/collagePdfExporter";
import { authenticate } from "../middleware/auth";
import { aiRateLimit, getAIUsage, isPremiumTier } from "../middleware/aiRateLimit";
import { createAIJob } from "../services/aiJobStore";

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

  router.get("/ai/usage", authenticate, (req: Request, res: Response) => {
    const user = (req as any).user as { userId: string; tier?: string };
    res.json(getAIUsage(user.userId, user.tier));
  });

  /**
   * POST /api/ai/collage/text-to-collage
   *
   * Generate a collage layout from a text description.
   * Uses OpenAI AI to generate an image, then converts it to fabric layers.
   * Falls back to smart mock generation when no API key is configured.
   *
   * Request body: { prompt: string, gridSize?: 16|24|32|48|64, negativePrompt?: string }
   * Response: { success: true, data: CollageGenerationResult }
   */
  router.post(
    "/ai/collage/text-to-collage",
    authenticate,
    aiRateLimit,
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
        const { prompt, gridSize, blockSize, negativePrompt, premiumModel } = parsed.data;
        const premium = premiumModel === true && isPremiumTier((req as any).user?.tier);
        // Grid matches the quilt block size — minimum 12×12
        const resolvedGridSize = Math.max(12, blockSize || 12);
        // Slow AI path: run the whole pipeline (OpenAI artwork generation →
        // organic quilt conversion, deterministic fallback included) in the
        // background. Respond 202 + jobId so the request never exceeds the
        // platform gateway's ~30s upstream timeout.
        const jobId = createAIJob(async () => {
          const t0 = Date.now();
          console.info(JSON.stringify({ event: "collage_job_start", prompt, t: new Date().toISOString() }));
          let generation;
          try {
            generation = await Promise.race([
              generateCollageImage(prompt, negativePrompt, premium),
              // Backstop only: the Gemini call itself is bounded (90s AbortSignal
              // per attempt, fail-fast on 4xx), and the premium pro model +
              // segmentation of rich art legitimately takes 2–4 minutes. 300s
              // gives the real pipeline room; mock fallback is a last resort.
              new Promise< never>((_, reject) =>
                setTimeout(() => reject(new Error("AI generation timed out")), 300_000),
              ),
            ]);
          } catch (err) {
            console.warn({ event: "collage_ai_fallback", error: String(err), elapsedMs: Date.now() - t0 });
            const collage = generateCollageLayoutFromPrompt(prompt, gridSize);
            // Mock fallback still produces scrapbook pieces (rendered mock art cutouts),
            // but it is flagged so the UI can be honest that this is a placeholder,
            // not the real artwork.
            const withPieces = await attachMockPiecesToCollage(collage);
            return { success: true, data: { ...withPieces, isFallback: true, prompt } };
          }
          if (generation?.url) {
            // Real AI generation — convert image to collage layers
            console.info(JSON.stringify({ event: "collage_image_ok", elapsedMs: Date.now() - t0 }));
            const collage = await imageUrlToCollageLayers(generation.url, resolvedGridSize);
            console.info(JSON.stringify({ event: "collage_job_done", elapsedMs: Date.now() - t0, pieces: Array.isArray(collage.pieces) ? collage.pieces.length : undefined }));
            return {
              success: true,
              data: {
                ...collage,
                previewUrl: generation.url,
                prompt,
                blockSize,
                artworkUrl: generation.url,
              },
            };
          }
          throw new Error("AI image generation returned no image");
        });
        res.status(202).json({ jobId });
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
    aiRateLimit,
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

  // POST /api/ai/collage/export-pdf — Export collage pattern as printable PDF
  router.post("/collage/export-pdf", async (req: Request, res: Response) => {
    try {
      const { name, blockSize, regions, canvasWidth, canvasHeight } = req.body;

      if (!regions || !Array.isArray(regions) || regions.length === 0) {
        res.status(400).json({ success: false, error: "No pattern regions provided" });
        return;
      }

      const pdfBuffer = await generateCollagePatternPdf({
        name: name || "Collage Pattern",
        blockSize: blockSize || 12,
        regions,
        canvasWidth: canvasWidth || 400,
        canvasHeight: canvasHeight || 400,
      });

      const safeName = (name || "collage_pattern").replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error({ event: "collage_pdf_export_error", error: message });
      res.status(500).json({ success: false, error: message });
    }
  });

  return router;
}