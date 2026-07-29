/**
 * Line Art Pattern Generation — API Routes.
 *
 * Endpoint:
 *   POST /api/ai/line-art-to-pattern — Convert coloring-book line art to stitch grid
 *
 * Input:  multipart file upload (PNG, JPEG, WebP) or imageUrl in JSON body
 *         with optional gridSize, outlineThreshold, backgroundThreshold,
 *         and outlineDmcCode query/body params.
 *
 * Output: PatternResult with stitch types (back for outlines, cross for regions).
 *
 * AI prompt guidance (for Leonardo/Stability when generating source images):
 *   "simple line art, coloring book style, black outlines only, white background,
 *    no shading, no gradients"
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import axios from "axios";
import type { PatternResult } from "../../domain/stitch/types";
import { CROSS_STITCH_SYMBOLS, AVAILABLE_GRID_SIZES, DEFAULT_GRID_SIZE } from "../../domain/stitch/types";
import { lineArtToPattern } from "../services/lineArtPipeline";
import { optionalAuth } from "../middleware/auth";

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

// ─── Validation Schema ─────────────────────────────────────────────────────────

const LineArtOptionsSchema = z.object({
  gridSize: z
    .number()
    .int()
    .optional()
    .refine(
      (val) => val === undefined || (AVAILABLE_GRID_SIZES as readonly number[]).includes(val),
      { message: `gridSize must be one of ${AVAILABLE_GRID_SIZES.join(", ")}` },
    ),
  outlineThreshold: z.number().int().min(10).max(150).optional(),
  backgroundThreshold: z.number().int().min(200).max(255).optional(),
  outlineDmcCode: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function flattenGrid(grid: PatternResult["grid"]): string[][] {
  return grid.map(row => row.map(cell => cell.color));
}

function buildResponse(pattern: PatternResult, extra: Record<string, unknown> = {}) {
  const flatGrid = flattenGrid(pattern.grid);
  const stitchTypes: string[][] = pattern.grid.map(row =>
    row.map(cell => cell.stitchType || "cross"),
  );
  return {
    success: true,
    grid: flatGrid,
    stitchTypes,
    width: pattern.gridSize,
    height: pattern.gridSize,
    dmcPalette: pattern.dmcColors.map((c, i) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      count: c.count,
      symbol: c.symbol || CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
    })),
    totalStitches: pattern.stitchCount,
    gridSizes: [...AVAILABLE_GRID_SIZES],
    ...extra,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────────

export function createLineArtRouter(): Router {
  const router = Router();

  /**
   * POST /api/ai/line-art-to-pattern
   *
   * Convert line art (coloring-book style) to an embroidery stitch grid.
   * Accepts either a multipart file upload (field: "image") or a JSON body
   * with an "imageUrl" field pointing to a remote image.
   *
   * Query/body params:
   *   - gridSize: 50 | 75 | 100 | 150 | 200 (default 100)
   *   - outlineThreshold: 10-150 (default 128) — lower = more edges detected
   *   - backgroundThreshold: 200-255 (default 240) — higher = stricter white detection
   *   - outlineDmcCode: DMC code for outline backstitch (default "DMC 310")
   *
   * Response:
   *   { success, grid[][], stitchTypes[][], width, height, dmcPalette[], totalStitches, gridSizes[] }
   */
  router.post(
    "/ai/line-art-to-pattern",
    optionalAuth,
    upload.single("image"),
    async (req: Request, res: Response) => {
      try {
        // Parse options from body or query
        const parsed = LineArtOptionsSchema.safeParse({
          ...req.body,
          ...req.query,
        });
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        const opts = parsed.data;
        let imageBuffer: Buffer;

        // Source: uploaded file or remote URL
        if (req.file) {
          imageBuffer = req.file.buffer;
        } else if (opts.imageUrl) {
          try {
            const response = await axios.get(opts.imageUrl, {
              responseType: "arraybuffer",
              timeout: 30000,
            });
            imageBuffer = Buffer.from(response.data);
          } catch (err) {
            res.status(400).json({
              success: false,
              error: `Failed to download image from URL: ${(err as Error).message}`,
            });
            return;
          }
        } else {
          res.status(400).json({
            success: false,
            error: "No image provided. Upload a file with field name 'image' or provide 'imageUrl' in body.",
          });
          return;
        }

        // Run the pipeline
        const pattern = await lineArtToPattern(imageBuffer, {
          gridSize: opts.gridSize,
          outlineThreshold: opts.outlineThreshold,
          backgroundThreshold: opts.backgroundThreshold,
          outlineDmcCode: opts.outlineDmcCode,
        });

        res.json(buildResponse(pattern, {
          processingTimeMs: 0,
          pipeline: "line-art",
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error({ event: "line_art_pipeline_error", error: message });
        res.status(500).json({ success: false, error: message });
      }
    },
  );

  return router;
}
