/**
 * Text-to-Image Pattern API Endpoint
 *
 * POST /api/ai/text-to-image-pattern
 *
 * Generates an embroidery pattern from a text prompt using AI image generation.
 * Provider chain: Leonardo (primary) → DALL-E (secondary) → Stability (last resort).
 * Leonardo is cheapest ($0.005/img) and only bills successes — no credit burn.
 *
 * The pipeline is model-agnostic: the AI generates artwork; the pattern engine
 * converts it deterministically to a stitch grid.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";
import { generatePatternFromImage } from "../../domain/stitch/pipeline";
import { generateImageWithDallE } from "../services/openaiImageService";
import { generateImageWithStability } from "../services/stabilityAIService";
import { generateImageFromText } from "../services/leonardoAIService";

export function createTextToImageRouter(): Router {
  const router = Router();

  router.post(
    "/ai/text-to-image-pattern",
    async (req: Request, res: Response): Promise<void> => {
      try {
        // Validate input
        const schema = z.object({
          prompt: z.string().min(1).max(500),
          gridSize: z.number().int().optional(),
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

        // Style hints for embroidery-suitable artwork
        const styleHints = "flat vector art, solid flat colors only, no gradients, no shading, no photorealistic details, clean simple shapes, clip art style, white background, suitable for cross-stitch embroidery pattern, needlepoint aesthetic";

        // Provider chain: Leonardo → DALL-E → Stability
        const generateImage = async (p: string) => {
          // Step 1: Leonardo AI (primary — cheapest, bills only successes)
          const leonardoResult = await generateImageFromText(p);
          if (leonardoResult?.url) {
            // Download the Leonardo image as a buffer
            const axios = (await import("axios")).default;
            const dlResponse = await axios.get(leonardoResult.url, {
              responseType: "arraybuffer",
              timeout: 30_000,
            });
            return { url: leonardoResult.url, buffer: Buffer.from(dlResponse.data) };
          }

          // Step 2: DALL-E (secondary — reliable, $0.04/img)
          const dalleResult = await generateImageWithDallE(p, styleHints);
          if (dalleResult) return dalleResult;

          // Step 3: Stability AI (last resort — bills even on failures)
          const enhancedPrompt = `${p}, ${styleHints}`;
          const stabilityResult = await generateImageWithStability(enhancedPrompt);
          if (stabilityResult) return stabilityResult;

          return null;
        };

        const pattern = await generatePatternFromImage(
          prompt,
          gridSize,
          generateImage,
        );

        // Assign cross-stitch symbols to palette entries
        const dmcColorsWithSymbols = pattern.dmcColors.map((c, i) => ({
          ...c,
          symbol: CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
        }));

        res.json({
          success: true,
          grid: pattern.grid.map(row => row.map(cell => cell.color)),
          stitchTypes: pattern.grid.map(row => row.map(() => "cross")),
          width: pattern.gridSize,
          height: pattern.gridSize,
          dmcPalette: dmcColorsWithSymbols,
          totalStitches: pattern.stitchCount,
          gridSizes: [50, 75, 100, 150, 200],
          promptUsed: prompt,
          previewUrl: pattern.previewUrl,
        });
      } catch (err: any) {
        console.error("Text-to-image pattern error:", err);
        res.status(500).json({
          error: err.message || "Text-to-image pattern generation failed",
        });
      }
    },
  );

  return router;
}
