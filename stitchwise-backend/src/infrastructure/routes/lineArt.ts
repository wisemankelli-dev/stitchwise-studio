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
   * Uses Stability AI to generate an image, then runs it through
   * the k-means color quantization + DMC mapping pipeline for clean,
   * well-defined stitch regions.
   *
   * Request body: { prompt: string, gridSize?: number, maxColors?: number }
   * Response: PatternResult with cross-stitch cells and quantized DMC colors
   *
   * Prompt engineering appends: "flat vector art, solid flat colors only,
   *   no gradients, no shading, clean simple shapes, clip art style,
   *   white background, suitable for embroidery"
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

        // A single needlepoint artwork — never a repeating pattern.
        // One recognizable subject centered, filling the frame.
        const enhancedPrompt = [
          prompt,
          "a single needlepoint artwork, one complete composition",
          "not tiled, not repeating, not a pattern, not a fabric swatch",
          "hand-drawn by a professional needlepoint artist",
          "one clear subject centered and filling the entire frame",
          "clean well-defined shapes, balanced negative space",
          "thread-friendly colors, white background",
        ].join(", ");
        const negativePrompt = [
          "tiled, repeating, wallpaper, fabric swatch, pattern grid",
          "clip art, cheap vector graphics, AI-generated look",
          "messy composition, photorealistic, 3D rendering, overdetailed",
          "busy patterns, cluttered, abstract noise, modern digital art",
          "gradients, shading, shadows, black outlines, sketchy",
          "multiple copies, collage, mosaic, sampler, chart",
        ].join(", ");

        console.error(JSON.stringify({
          event: "text_to_pattern_kmeans",
          originalPrompt: prompt,
          finalPrompt: enhancedPrompt,
        }));

        // Step 1: Generate image via Stability AI
        const generation = await generateImageWithStability(enhancedPrompt, negativePrompt);

        if (!generation || !generation.buffer) {
          res.status(500).json({
            error: "AI image generation failed. No image returned from Stability AI.",
          });
          return;
        }

        // Step 2: Run the k-means color quantization → DMC mapping pipeline
        // This replaces the Sobel edge-detection approach with the same
        // clean quantized pipeline used by the image upload flow.
        const result = await imageBufferToStitchGrid(
          generation.buffer,
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
          previewUrl: generation.url,
          promptUsed: enhancedPrompt,
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
