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
   * Generate a line art embroidery pattern from a text prompt.
   * Uses Stability AI to first generate the line art image, then runs
   * it through the Sobel edge detection + stitch mapping pipeline.
   *
   * Request body: { prompt: string, gridSize?: number, edgeThreshold?: number, outlineDmcCode?: string }
   * Response: PatternResult with mixed backstitch (outlines) and cross-stitch (regions) cells
   *
   * Prompt engineering appends: "simple line art, coloring book style, black outlines only,
   *   white background, no shading, no gradients, flat vector art"
   */
  router.post(
    "/ai/text-to-line-art-pattern",
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Validate input
        const schema = z.object({
          prompt: z.string().min(1).max(500),
          gridSize: z.number().int().optional(),
          edgeThreshold: z.number().int().min(10).max(150).optional(),
          outlineDmcCode: z.string().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const { prompt, gridSize, edgeThreshold, outlineDmcCode } = parsed.data;

        // Line art prompt engineering — heavily emphasize pure black & white
        const lineArtPrompt = `${prompt}, black and white line art only, pure black outlines on pure white background, coloring book page, no gray, no color, no shading, no gradients, clean vector style, embroidery pattern template`;
        const negativePrompt = "photorealistic, shading, gradients, color fills, complex backgrounds, 3D, rendered";

        console.error(JSON.stringify({
          event: "text_to_line_art_request",
          originalPrompt: prompt,
          finalPrompt: lineArtPrompt,
        }));

        // Step 1: Generate line art image via Stability AI
        const generation = await generateImageWithStability(lineArtPrompt, negativePrompt);

        if (!generation || !generation.buffer) {
          res.status(500).json({
            error: "AI image generation failed. No image returned from Stability AI.",
          });
          return;
        }

        // Step 2: Run the line art → stitch grid pipeline
        const result = await lineArtToStitchGrid(
          generation.buffer,
          gridSize ?? DEFAULT_GRID_SIZE,
          edgeThreshold ?? 50,
          outlineDmcCode ?? "310",
        );

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = result.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        // Count stitch types for diagnostics
        let backCount = 0;
        let crossCount = 0;
        for (const row of result.grid) {
          for (const cell of row) {
            if (cell.stitchType === "back") backCount++;
            else crossCount++;
          }
        }

        res.json({
          ...result,
          dmcColors: dmcColorsWithSymbols,
          stats: {
            backstitchCells: backCount,
            crossStitchCells: crossCount,
          },
          previewUrl: generation.url,
          promptUsed: lineArtPrompt,
        });
      } catch (err: any) {
        console.error("Text-to-line-art error:", err);
        res.status(500).json({
          error: err.message || "Text-to-line-art pattern generation failed",
        });
      }
    },
  );

  return router;
}
