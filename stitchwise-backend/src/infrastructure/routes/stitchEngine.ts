import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  GenerateStitchSchema,
  ConvertFileSchema,
  STITCH_FORMATS,
} from "../../domain/stitchEngine";
import {
  checkStitchServiceHealth,
  generateStitchFile,
  convertStitchFile,
  getStitchFormats,
  estimateThreadUsage,
} from "../services/stitchClient";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Creates a router for AI Stitch Engine integration endpoints.
 *
 * These routes proxy requests to the Python stitch microservice,
 * providing the Express backend as the single API gateway.
 */
export function createStitchRouter(): Router {
  const router = Router();

  /**
   * GET /api/stitch/health - Check if the stitch service is reachable.
   */
  router.get("/stitch/health", async (_req: Request, res: Response) => {
    try {
      const health = await checkStitchServiceHealth();
      res.json(health);
    } catch (err) {
      console.error({ event: "stitch_health_check_failed", error: String(err) });
      res.status(503).json({
        error: "Stitch service unavailable",
        detail: String(err),
      });
    }
  });

  /**
   * GET /api/stitch/formats - List supported embroidery formats.
   */
  router.get("/stitch/formats", async (_req: Request, res: Response) => {
    try {
      const formats = await getStitchFormats();
      res.json({ formats, default: "dst" });
    } catch (err) {
      console.error({ event: "stitch_formats_fetch_failed", error: String(err) });
      res.status(503).json({
        error: "Stitch service unavailable",
        detail: String(err),
      });
    }
  });

  /**
   * POST /api/stitch/generate - Generate an embroidery file from design paths.
   *
   * Request body: { paths: DesignPath[], format: "dst"|"pes"|..., stitchDensity: number }
   * Response: Binary embroidery file download.
   */
  router.post("/stitch/generate", async (req: Request, res: Response) => {
    try {
      const parsed = GenerateStitchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          details: parsed.error.issues,
        });
        return;
      }

      const result = await generateStitchFile({
        paths: parsed.data.paths.map((p) => ({
          segments: p.segments,
          color: p.color,
          stitchType: p.stitchType,
        })),
        format: parsed.data.format,
        stitchDensity: parsed.data.stitchDensity,
      });

      res.setHeader("Content-Type", result.mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.filename}"`,
      );
      res.send(result.fileBuffer);
    } catch (err) {
      console.error({ event: "stitch_generate_error", error: String(err) });
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * POST /api/stitch/estimate-thread - Estimate thread usage for a design.
   *
   * Request body: { paths: DesignPath[], stitchDensity, stitchType, ... }
   * Response: Top/bobbin thread meters, per-color DMC skein breakdown.
   */
  router.post("/stitch/estimate-thread", async (req: Request, res: Response) => {
    try {
      const result = await estimateThreadUsage({
        paths: req.body.paths,
        stitchDensity: req.body.stitchDensity,
        stitchType: req.body.stitchType,
        fabricThicknessMm: req.body.fabricThicknessMm,
        satinColumnWidth: req.body.satinColumnWidth,
        underlayType: req.body.underlayType,
      });
      res.json(result);
    } catch (err) {
      console.error({ event: "thread_estimate_error", error: String(err) });
      res.status(500).json({ error: String(err) });
    }
  });

  /**
   * POST /api/stitch/convert - Convert an uploaded embroidery file to another format.
   *
   * Form data: file (upload), format (target format)
   * Response: Converted embroidery file download.
   */
  router.post(
    "/stitch/convert",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const parsed = ConvertFileSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            details: parsed.error.issues,
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "No file provided" });
          return;
        }

        const result = await convertStitchFile(
          req.file.buffer,
          req.file.originalname,
          parsed.data.targetFormat,
        );

        res.setHeader("Content-Type", result.mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${result.filename}"`,
        );
        res.send(result.fileBuffer);
      } catch (err) {
        console.error({ event: "stitch_convert_error", error: String(err) });
        res.status(500).json({ error: String(err) });
      }
    },
  );

  return router;
}