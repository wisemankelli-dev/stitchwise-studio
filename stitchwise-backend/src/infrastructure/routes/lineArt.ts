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
import { lineArtToStitchGrid } from "../../domain/stitch/lineArtConverter";
import { AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "../../domain/stitch/types";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";

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

  return router;
}
