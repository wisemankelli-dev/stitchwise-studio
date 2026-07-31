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
import { svgToStitchGrid } from "../../domain/stitch/pipeline";
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
        const targetSize = gridSize ?? DEFAULT_GRID_SIZE;

        // ── Pipeline Priority ──────────────────────────────────────────────
        // 1. GPT-4o SVG → Clean single-subject vector art (no repeating tiles)
        // 2. Stability AI → Diffusion model with strong negative prompting
        // 3. DALL-E → OpenAI image generation (last resort)
        //
        // GPT-4o SVG is preferred because it produces crisp, single-subject
        // vector art with flat color regions — ideal for stitch-grid conversion.
        // It avoids the repeating-tile artifacts of diffusion models entirely.

        let pipelineUsed: string = "unknown";
        let result: any = null;
        let previewUrl: string | undefined;

        // Step 1: Try GPT-4o SVG (primary pipeline)
        const svgString = await generateSVGWithGPT4o(prompt);
        if (svgString) {
          pipelineUsed = "gpt4o-svg";
          console.error(JSON.stringify({
            event: "text_to_pattern_pipeline",
            pipeline: pipelineUsed,
            prompt: prompt,
          }));
          result = await svgToStitchGrid(svgString, targetSize, prompt);
        }

        // Step 2: Fall back to Stability AI
        if (!result) {
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
            previewUrl = stabilityResult.url;
            pipelineUsed = "stability-ai";
            console.error(JSON.stringify({
              event: "text_to_pattern_pipeline",
              pipeline: pipelineUsed,
              fallback: true,
            }));
            result = await imageBufferToStitchGrid(
              stabilityResult.buffer,
              targetSize,
              maxColors ?? 24,
            );
          }
        }

        // Step 3: Fall back to DALL-E
        if (!result) {
          const dalleResult = await generateImageWithDallE(prompt);
          if (dalleResult?.buffer) {
            previewUrl = dalleResult.url;
            pipelineUsed = "dall-e";
            console.error(JSON.stringify({
              event: "text_to_pattern_pipeline",
              pipeline: pipelineUsed,
              fallback: true,
            }));
            result = await imageBufferToStitchGrid(
              dalleResult.buffer,
              targetSize,
              maxColors ?? 24,
            );
          }
        }

        if (!result) {
          res.status(500).json({
            error: "AI image generation failed. All pipelines (GPT-4o SVG, Stability AI, DALL-E) returned no image.",
          });
          return;
        }

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = result.dmcColors.map((c: any, i: number) => ({
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

  return router;
}
