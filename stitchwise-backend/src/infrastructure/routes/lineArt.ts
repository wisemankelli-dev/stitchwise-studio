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
import { generateSvgFromPrompt } from "../services/openaiSvgService";

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
   * POST /api/ai/text-to-svg-pattern
   *
   * Generate an embroidery pattern from a text prompt using GPT-4o SVG.
   *
   * This is the dedicated GPT-4o SVG pipeline — NO diffusion models.
   * GPT-4o generates structured SVG vector art with flat solid-colored regions
   * and clean shapes, then svgToStitchGrid() rasterizes and quantizes.
   *
   * Unlike text-to-line-art-pattern (which falls back to Stability/DALL-E),
   * this endpoint produces ONLY single-subject vector artwork — no risk of
   * repeating-tile artifacts.
   *
   * Request body: { prompt: string, gridSize?: number, maxColors?: number }
   * Response: PatternResult with cross-stitch cells, quantized DMC colors
   */
  router.post(
    "/ai/text-to-svg-pattern",
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

        const { prompt, gridSize } = parsed.data;
        const targetSize = gridSize ?? DEFAULT_GRID_SIZE;

        console.error(JSON.stringify({
          event: "text_to_svg_pattern_start",
          prompt: prompt,
          gridSize: targetSize,
        }));

        // Step 1: Generate SVG via GPT-4o
        const svgString = await generateSvgFromPrompt(prompt);
        if (!svgString) {
          res.status(500).json({
            error: "GPT-4o SVG generation failed. Check OPENAI_API_KEY and try again.",
          });
          return;
        }

        // Step 2: Convert SVG → stitch grid via the pipeline
        const result = await svgToStitchGrid(svgString, targetSize, prompt);

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = result.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        console.error(JSON.stringify({
          event: "text_to_svg_pattern_success",
          paletteSize: result.dmcColors.length,
          stitchCount: result.stitchCount,
        }));

        res.json({
          ...result,
          dmcColors: dmcColorsWithSymbols,
          promptUsed: prompt,
          pipeline: "gpt4o-svg",
        });
      } catch (err: any) {
        console.error("Text-to-SVG-pattern error:", err);
        res.status(500).json({
          error: err.message || "Text-to-SVG-pattern generation failed",
        });
      }
    },
  );

  return router;
}
