/**
 * Pattern Persistence Routes — Authenticated CRUD for saving, loading,
 * listing, and deleting embroidery patterns.
 *
 * POST   /api/patterns         — save a new pattern
 * GET    /api/patterns         — list user's patterns
 * GET    /api/patterns/:id     — load a single pattern
 * DELETE /api/patterns/:id     — delete a pattern
 */

import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { materializePendingPurchases } from "../../domain/patternGrants";
import { serializeGrid, serializePalette, deserializeGrid, deserializePalette } from "../../domain/stitch/patternDataModel";
import { CROSS_STITCH_SYMBOLS } from "../../domain/stitch/types";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const SaveSchema = z.object({
  name: z.string().min(1).max(200),
  grid: z.array(z.array(z.object({
    color: z.string(),
    dmcCode: z.string().optional(),
    dmcName: z.string().optional(),
  }))).min(1),
  palette: z.array(z.object({
    code: z.string(),
    name: z.string(),
    hex: z.string(),
    count: z.number().int().min(0),
  })).optional().default([]),
  gridSize: z.number().int().min(16).max(500),
  stitchCount: z.number().int().min(0),
  prompt: z.string().optional(),
  sourceImage: z.string().optional(),
  previewUrl: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export function createPatternPersistenceRouter(prisma: PrismaClient): Router {
  const router = Router();

  // All routes require authentication
  router.use(authenticate);

  // ── POST / — Save a new pattern ─────────────────────────────────────
  router.post("/", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const body = SaveSchema.parse(req.body);

      const gridData = serializeGrid(body.grid);
      const dmcPalette = serializePalette(body.palette);

      const record = await prisma.embroideryPattern.create({
        data: {
          name: body.name,
          userId: user.userId,
          gridData,
          gridSize: body.gridSize,
          dmcPalette,
          stitchCount: body.stitchCount,
          prompt: body.prompt ?? null,
          sourceImage: body.sourceImage ?? null,
          previewUrl: body.previewUrl ?? null,
        },
      });

      res.status(201).json({
        id: record.id,
        name: record.name,
        gridSize: record.gridSize,
        stitchCount: record.stitchCount,
        createdAt: record.createdAt,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Validation failed", details: err.errors });
        return;
      }
      console.error({ event: "pattern_save_error", error: String(err) });
      res.status(500).json({ error: "Failed to save pattern" });
    }
  });

  // ── GET / — List user's patterns ────────────────────────────────────
  router.get("/", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      // Grant any purchased Pattern Library patterns to this account
      // (covers buyers who were already logged in when they purchased).
      await materializePendingPurchases(prisma, user.email, user.userId);
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

      const [patterns, total] = await Promise.all([
        prisma.embroideryPattern.findMany({
          where: { userId: user.userId },
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: limit,
          select: {
            id: true,
            name: true,
            gridSize: true,
            stitchCount: true,
            previewUrl: true,
            prompt: true,
            visibility: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.embroideryPattern.count({ where: { userId: user.userId } }),
      ]);

      res.json({ patterns, total, offset, limit });
    } catch (err) {
      console.error({ event: "pattern_list_error", error: String(err) });
      res.status(500).json({ error: "Failed to list patterns" });
    }
  });

  // ── GET /:id — Load a single pattern ────────────────────────────────
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const record = await prisma.embroideryPattern.findUnique({ where: { id } });

      if (!record) {
        res.status(404).json({ error: "Pattern not found" });
        return;
      }

      // Ownership check — users can only load their own patterns
      if (record.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const grid = deserializeGrid(record.gridData);
      const palette = record.dmcPalette
        ? deserializePalette(record.dmcPalette).map((entry, i) => ({
            ...entry,
            symbol: (entry as any).symbol ?? CROSS_STITCH_SYMBOLS[i % CROSS_STITCH_SYMBOLS.length],
          }))
        : [];

      res.json({
        id: record.id,
        name: record.name,
        gridSize: record.gridSize,
        stitchCount: record.stitchCount,
        prompt: record.prompt,
        sourceImage: record.sourceImage,
        previewUrl: record.previewUrl,
        visibility: record.visibility,
        createdAt: record.createdAt,
        grid,
        palette,
      });
    } catch (err) {
      console.error({ event: "pattern_load_error", error: String(err) });
      res.status(500).json({ error: "Failed to load pattern" });
    }
  });

  // ── DELETE /:id — Delete a pattern ──────────────────────────────────
  router.delete("/:id", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      const record = await prisma.embroideryPattern.findUnique({ where: { id } });

      if (!record) {
        res.status(404).json({ error: "Pattern not found" });
        return;
      }

      // Ownership check
      if (record.userId !== user.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await prisma.embroideryPattern.delete({ where: { id } });

      res.json({ success: true, deleted: id });
    } catch (err) {
      console.error({ event: "pattern_delete_error", error: String(err) });
      res.status(500).json({ error: "Failed to delete pattern" });
    }
  });

  return router;
}
