/**
 * Pattern Editor Routes — REST API for real-time grid editing.
 *
 * POST /api/patterns/:id/paint       — paint cells
 * POST /api/patterns/:id/erase       — erase cells
 * POST /api/patterns/:id/mirror      — mirror grid (uses stitchGrid utilities)
 * POST /api/patterns/:id/clone-region — clone a rectangle region
 * POST /api/patterns/:id/eyedropper  — sample color at a position
 * POST /api/patterns/:id/text        — stamp text with pixel font
 */

import { Router, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { paintCells, eraseCells, cloneRegion, eyedropper, stampText } from "../../domain/stitch/editorOperations";
import { flipGridHorizontal, flipGridVertical } from "../../domain/stitch/stitchGrid";
import { deserializeGrid, serializeGrid, serializePalette } from "../../domain/stitch/patternDataModel";
import type { StitchGrid } from "../../domain/stitch/types";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PaintSchema = z.object({
  cells: z.array(z.object({
    row: z.number().int().min(0),
    col: z.number().int().min(0),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    dmcCode: z.string().optional(),
    dmcName: z.string().optional(),
  })),
});

const EraseSchema = z.object({
  cells: z.array(z.object({
    row: z.number().int().min(0),
    col: z.number().int().min(0),
  })),
});

const MirrorSchema = z.object({
  axis: z.enum(["horizontal", "vertical"]),
});

const CloneRegionSchema = z.object({
  sourceRow: z.number().int().min(0),
  sourceCol: z.number().int().min(0),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  targetRow: z.number().int().min(0),
  targetCol: z.number().int().min(0),
});

const EyedropperSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
});

const TextSchema = z.object({
  text: z.string().min(1).max(50),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  dmcCode: z.string().optional(),
  dmcName: z.string().optional(),
});

// ─── Router ──────────────────────────────────────────────────────────────────

export function createPatternEditorRouter(prisma: PrismaClient): Router {
  const router = Router();

  /** Load grid from DB, returning parsed StitchGrid or 404 */
  async function loadGrid(id: string): Promise<{ grid: StitchGrid; record: { id: string; stitchCount: number; gridSize: number } }> {
    const record = await prisma.embroideryPattern.findUnique({ where: { id } });
    if (!record) throw { status: 404, message: "Pattern not found" };
    const grid = deserializeGrid(record.gridData);
    return { grid, record };
  }

  /** Save grid back to DB and return updated response */
  async function saveGrid(id: string, grid: StitchGrid) {
    const record = await prisma.embroideryPattern.update({
      where: { id },
      data: {
        gridData: serializeGrid(grid),
        stitchCount: grid.length * (grid[0]?.length ?? 0),
      },
    });
    return {
      grid,
      width: grid[0]?.length ?? 0,
      height: grid.length,
      dmcPalette: record.dmcPalette ? JSON.parse(record.dmcPalette) : [],
      totalStitches: record.stitchCount,
    };
  }

  // POST /:id/paint
  router.post("/:id/paint", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = PaintSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const result = paintCells(grid, body.cells);
      await prisma.embroideryPattern.update({
        where: { id },
        data: {
          gridData: serializeGrid(result.grid),
          dmcPalette: serializePalette(result.palette),
          stitchCount: result.grid.length * (result.grid[0]?.length ?? 0),
        },
      });
      res.json({ success: true, grid: result.grid, width: result.grid[0]?.length ?? 0, height: result.grid.length, dmcPalette: result.palette });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Paint failed" });
    }
  });

  // POST /:id/erase
  router.post("/:id/erase", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = EraseSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const result = eraseCells(grid, body.cells);
      await prisma.embroideryPattern.update({
        where: { id },
        data: {
          gridData: serializeGrid(result.grid),
          dmcPalette: serializePalette(result.palette),
          stitchCount: result.grid.length * (result.grid[0]?.length ?? 0),
        },
      });
      res.json({ success: true, grid: result.grid, width: result.grid[0]?.length ?? 0, height: result.grid.length, dmcPalette: result.palette });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Erase failed" });
    }
  });

  // POST /:id/mirror
  router.post("/:id/mirror", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = MirrorSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const mirrored = body.axis === "horizontal" ? flipGridHorizontal(grid) : flipGridVertical(grid);
      await prisma.embroideryPattern.update({
        where: { id },
        data: {
          gridData: serializeGrid(mirrored),
          stitchCount: mirrored.length * (mirrored[0]?.length ?? 0),
        },
      });
      res.json({ success: true, grid: mirrored, width: mirrored[0]?.length ?? 0, height: mirrored.length });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Mirror failed" });
    }
  });

  // POST /:id/clone-region
  router.post("/:id/clone-region", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = CloneRegionSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const result = cloneRegion(grid, body);
      await prisma.embroideryPattern.update({
        where: { id },
        data: {
          gridData: serializeGrid(result.grid),
          dmcPalette: serializePalette(result.palette),
          stitchCount: result.grid.length * (result.grid[0]?.length ?? 0),
        },
      });
      res.json({ success: true, grid: result.grid, width: result.grid[0]?.length ?? 0, height: result.grid.length, dmcPalette: result.palette });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Clone region failed" });
    }
  });

  // POST /:id/eyedropper
  router.post("/:id/eyedropper", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = EyedropperSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const cell = eyedropper(grid, body.row, body.col);
      if (!cell) return res.status(404).json({ success: false, error: "Cell out of bounds" });
      res.json({ success: true, ...cell });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Eyedropper failed" });
    }
  });

  // POST /:id/text
  router.post("/:id/text", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const body = TextSchema.parse(req.body);
      const { grid } = await loadGrid(id);
      const result = stampText(grid, body.text, body.row, body.col, body.color, body.dmcCode, body.dmcName);
      await prisma.embroideryPattern.update({
        where: { id },
        data: {
          gridData: serializeGrid(result.grid),
          dmcPalette: serializePalette(result.palette),
          stitchCount: result.grid.length * (result.grid[0]?.length ?? 0),
        },
      });
      res.json({ success: true, grid: result.grid, width: result.grid[0]?.length ?? 0, height: result.grid.length, dmcPalette: result.palette });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, error: err.errors });
      res.status(err.status ?? 500).json({ success: false, error: err.message ?? "Text stamp failed" });
    }
  });

  return router;
}
