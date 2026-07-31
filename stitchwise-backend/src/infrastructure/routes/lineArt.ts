/**
 * Line Art Pattern Generator — API endpoint for converting coloring-book-style
 * line art images into embroidery patterns with stitch type assignments.
 *
 * POST /api/ai/line-art-to-pattern
 *   Accepts multipart file upload or image URL.
 *   Query params: gridSize (50-200), edgeThreshold (20-120)
 *   Returns: PatternResult with stitchType assignments per cell
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import axios from "axios";
import { z } from "zod";
import { lineArtToStitchGrid } from "../../domain/stitch/lineArtConverter";
import { imageBufferToStitchGrid } from "../../domain/stitch/patternConverter";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "../../domain/stitch/types";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";
import { generateImageWithStability } from "../services/stabilityAIService";
import { generateSVGWithGPT4o, generateImageWithDallE } from "../services/openaiImageService";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export function createLineArtRouter(): Router {
  const router = Router();

  router.post(
    "/ai/line-art-to-pattern",
    upload.single("image"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        let imageBuffer: Buffer;

        // Accept either a file upload or an image URL in the body
        if (req.file) {
          imageBuffer = req.file.buffer;
        } else if (req.body?.imageUrl) {
          const response = await axios.get(req.body.imageUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          imageBuffer = Buffer.from(response.data);
        } else {
          res.status(400).json({
            error: "Either 'image' file upload or 'imageUrl' in JSON body is required.",
          });
          return;
        }

        // Parse optional parameters
        const gridSize = parseInt(req.body?.gridSize ?? String(DEFAULT_GRID_SIZE), 10);
        const validSizes = AVAILABLE_GRID_SIZES as readonly number[];
        const size = validSizes.includes(gridSize) ? gridSize : DEFAULT_GRID_SIZE;

        const edgeThreshold = parseInt(req.body?.edgeThreshold ?? "50", 10);
        const threshold = Math.max(10, Math.min(150, isNaN(edgeThreshold) ? 50 : edgeThreshold));

        const outlineDmc = req.body?.outlineDmcCode || "310";

        // Run the line art pipeline
        const result = await lineArtToStitchGrid(
          imageBuffer,
          size,
          threshold,
          outlineDmc,
        );

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = result.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        res.json({
          ...result,
          dmcColors: dmcColorsWithSymbols,
        });
      } catch (err: any) {
        console.error("Line art conversion error:", err);
        res.status(500).json({
          error: err.message || "Line art conversion failed",
        });
      }
    },
  );

  /**
   * POST /api/ai/text-to-line-art-pattern
   *
   * Generate an embroidery pattern from a text prompt.
   *
   * Pipeline priority:
   *   1. GPT-4o SVG → Clean single-subject vector line art (NO repeating tiles)
   *   2. Stability AI → Diffusion fallback with strong negative prompting
   *   3. DALL-E → OpenAI image generation (last resort)
   *
   * Each pipeline output is run through k-means color quantization + DMC mapping.
   *
   * Request body: { prompt: string, gridSize?: number, maxColors?: number }
   * Response: PatternResult with cross-stitch cells, quantized DMC colors,
   *   previewUrl, and pipeline identifier
   */
  router.post(
    "/ai/text-to-line-art-pattern",
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Validate input
        const schema = z.object({
          prompt: z.string().min(1).max(500),
          gridSize: z.number().int().optional(),
          maxColors: z.number().int().min(5).max(30).optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { prompt, gridSize, maxColors } = parsed.data;

        // ── Pipeline Priority ──────────────────────────────────────────────
        // 1. GPT-4o SVG → Clean single-subject line art (no repeating tiles)
        // 2. Stability AI → Diffusion model with strong negative prompting
        // 3. DALL-E → OpenAI image generation (last resort)
        //
        // GPT-4o SVG is preferred because it produces crisp, single-subject
        // vector line art that avoids the repeating-tile artifacts of diffusion
        // models and converts cleanly to stitch grids.

        let imageBuffer: Buffer | null = null;
        let previewUrl: string | undefined;
        let pipelineUsed: string = "unknown";

        // Step 1: Try GPT-4o SVG (primary — avoids diffusion tile artifacts)
        imageBuffer = await generateSVGWithGPT4o(prompt);
        if (imageBuffer) {
          pipelineUsed = "gpt4o-svg";
          console.error(JSON.stringify({
            event: "text_to_pattern_pipeline",
            pipeline: pipelineUsed,
            prompt: prompt,
          }));
        }

        // Step 2: Fall back to Stability AI
        if (!imageBuffer) {
          const stabilityPrompt = [
            prompt,
            "traditional counted cross-stitch pattern, hand-drawn needlepoint design",
            "elegant composition with clear focal point",
            "clean well-defined shapes, balanced negative space",
            "thread-friendly colors, timeless classic needlepoint aesthetic",
            "white background, suitable for embroidery conversion",
          ].join(", ");
          const negativePrompt = [
            "clip art, cheap vector graphics, AI-generated look",
            "messy composition, photorealistic, 3D rendering, overdetailed",
            "busy patterns, cluttered, abstract noise, modern digital art",
            "gradients, shading, shadows, repeating tiles, tiled pattern",
          ].join(", ");

          const stabilityResult = await generateImageWithStability(stabilityPrompt, negativePrompt);
          if (stabilityResult?.buffer) {
            imageBuffer = stabilityResult.buffer;
            previewUrl = stabilityResult.url;
            pipelineUsed = "stability-ai";
            console.error(JSON.stringify({
              event: "text_to_pattern_pipeline",
              pipeline: pipelineUsed,
              fallback: true,
            }));
          }
        }

        // Step 3: Fall back to DALL-E
        if (!imageBuffer) {
          const dalleResult = await generateImageWithDallE(prompt);
          if (dalleResult?.buffer) {
            imageBuffer = dalleResult.buffer;
            previewUrl = dalleResult.url;
            pipelineUsed = "dall-e";
            console.error(JSON.stringify({
              event: "text_to_pattern_pipeline",
              pipeline: pipelineUsed,
              fallback: true,
            }));
          }
        }

        if (!imageBuffer) {
          res.status(500).json({
            error: "AI image generation failed. All pipelines (GPT-4o SVG, Stability AI, DALL-E) returned no image.",
          });
          return;
        }

        // Run the k-means color quantization → DMC mapping pipeline
        const result = await imageBufferToStitchGrid(
          imageBuffer,
          gridSize ?? DEFAULT_GRID_SIZE,
          maxColors ?? 24,
        );

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = result.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        res.json({
          ...result,
          dmcColors: dmcColorsWithSymbols,
          previewUrl,
          promptUsed: prompt,
          pipeline: pipelineUsed,
        });
      } catch (err: any) {
        console.error("Text-to-pattern error:", err);
        res.status(500).json({
          error: err.message || "Text-to-pattern generation failed",
        });
      }
    },
  );

  /**
   * POST /api/ai/generate-art
   *
   * Generate an artistic illustration from a text prompt.
   * Returns ONLY the image — no grid conversion yet.
   * The caller shows the art to the user; if they approve, they call
   * /api/ai/transpose-to-pattern to convert it to a stitch grid.
   *
   * Pipeline: Stability AI primary → DALL-E fallback
   *
   * Request body: { prompt: string }
   * Response: { imageDataUrl, pipeline }
   */
  router.post(
    "/ai/generate-art",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const schema = z.object({
          prompt: z.string().min(1).max(500),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { prompt } = parsed.data;

        console.error(JSON.stringify({
          event: "generate_art_start",
          prompt: prompt,
        }));

        // Art prompt — keep it simple and let the user's words dominate.
        // The subject should fill most of the image, with minimal background.
        const artPrompt = [
          prompt,
          "fills the entire image, close-up view, large centered subject",
          "flat illustration, solid colors, no gradients, white background",
        ].join(", ");

        const negativePrompt = [
          "photorealistic, 3D, realistic photo, shadows, gradients",
          "embroidery, cross-stitch, needlepoint, pixel art, grid pattern",
          "repeating tiles, tiled pattern, seamless pattern, wallpaper",
          "clip art, cheap vector graphics, childs drawing, simplistic",
          "cartoon, abstract noise",
          "vintage, muted colors, sepia, watercolor, sketchy",
          "blue, purple, violet, pink, any blue tones, any purple tones",
          "blue sky, clouds, landscape, scenery, background environment",
          "text, watermark, signature, letters, numbers",
        ].join(", ");

        let imageDataUrl: string | null = null;
        let pipelineUsed: string = "unknown";

        // Step 1: Stability AI
        const stabilityResult = await generateImageWithStability(artPrompt, negativePrompt);
        if (stabilityResult?.url) {
          imageDataUrl = stabilityResult.url; // already a data: URL
          pipelineUsed = "stability-ai";
        }

        // Step 2: Fall back to DALL-E
        if (!imageDataUrl) {
          const dalleResult = await generateImageWithDallE(artPrompt);
          if (dalleResult?.url) {
            imageDataUrl = dalleResult.url;
            pipelineUsed = "dall-e";
          }
        }

        if (!imageDataUrl) {
          res.status(500).json({
            error: "AI art generation failed. All pipelines returned no image.",
          });
          return;
        }

        console.error(JSON.stringify({
          event: "generate_art_success",
          pipeline: pipelineUsed,
          prompt: prompt,
        }));

        res.json({
          imageDataUrl,
          pipeline: pipelineUsed,
        });
      } catch (err: any) {
        console.error("generate-art error:", err);
        res.status(500).json({
          error: err.message || "Art generation failed",
        });
      }
    },
  );

  /**
   * POST /api/ai/transpose-to-pattern
   *
   * Convert a generated art image into a stitch grid pattern.
   * Call this AFTER the user has approved the art from /api/ai/generate-art.
   *
   * Request body: { imageDataUrl: string, gridSize?: number, maxColors?: number }
   * Response: PatternResult with cross-stitch cells, quantized DMC colors
   */
  router.post(
    "/ai/transpose-to-pattern",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const schema = z.object({
          imageDataUrl: z.string().min(1, "imageDataUrl is required"),
          gridSize: z.number().int().optional(),
          maxColors: z.number().int().min(5).max(30).optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { imageDataUrl, gridSize } = parsed.data;
        const targetSize = gridSize ?? DEFAULT_GRID_SIZE;

        console.error(JSON.stringify({
          event: "transpose_to_pattern_start",
          gridSize: targetSize,
        }));

        // Decode the data URL to a Buffer
        const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) {
          res.status(400).json({ error: "Invalid imageDataUrl format" });
          return;
        }
        const imageBuffer = Buffer.from(base64Match[1], "base64");

        // Convert image → stitch grid
        const result = await imageBufferToStitchGrid(imageBuffer, targetSize);

        const dmcColorsWithSymbols = result.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        console.error(JSON.stringify({
          event: "transpose_to_pattern_success",
          paletteSize: result.dmcColors.length,
          stitchCount: result.stitchCount,
        }));

        res.json({
          ...result,
          dmcColors: dmcColorsWithSymbols,
        });
      } catch (err: any) {
        console.error("transpose-to-pattern error:", err);
        res.status(500).json({
          error: err.message || "Pattern transposition failed",
        });
      }
    },
  );

  return router;
}
