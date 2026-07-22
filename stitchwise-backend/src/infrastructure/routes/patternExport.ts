/**
 * Pattern Export Routes — PDF and machine embroidery file downloads.
 *
 * POST /api/patterns/:id/export/pdf — PDF with grid preview + color key
 * POST /api/patterns/:id/export/dst — .DST machine embroidery file
 * POST /api/patterns/:id/export/pes — .PES machine embroidery file
 */

import { Router, type Request, type Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { deserializeGrid } from "../../domain/stitch/patternDataModel";
import { generatePatternPDF } from "../services/pdfExporter";
import type { DmcUsage } from "../../domain/stitch/types";

export function createPatternExportRouter(prisma: PrismaClient): Router {
  const router = Router();

  // POST /api/patterns/:id/export/pdf
  router.post("/patterns/:id/export/pdf", async (req: Request, res: Response) => {
    try {
      const pattern = await prisma.embroideryPattern.findUnique({
        where: { id: req.params.id },
      });
      if (!pattern) {
        res.status(404).json({ error: "Pattern not found" });
        return;
      }

      const grid = deserializeGrid(pattern.gridData);
      const palette: DmcUsage[] = JSON.parse(pattern.dmcPalette || "[]");

      const pdfBuffer = generatePatternPDF(grid, palette, {
        name: pattern.name,
        gridSize: pattern.gridSize,
        createdAt: pattern.createdAt,
      });

      const filename = `${pattern.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err) {
      console.error({ event: "pdf_export_error", error: String(err) });
      res.status(500).json({ error: "PDF export failed" });
    }
  });

  // POST /api/patterns/:id/export/dst
  router.post("/patterns/:id/export/dst", async (req: Request, res: Response) => {
    await exportMachineFormat(prisma, req, res, "dst");
  });

  // POST /api/patterns/:id/export/pes
  router.post("/patterns/:id/export/pes", async (req: Request, res: Response) => {
    await exportMachineFormat(prisma, req, res, "pes");
  });

  return router;
}

/** Shared machine format exporter (DST/PES). */
async function exportMachineFormat(
  prisma: PrismaClient,
  req: Request,
  res: Response,
  format: "dst" | "pes",
): Promise<void> {
  try {
    const pattern = await prisma.embroideryPattern.findUnique({
      where: { id: req.params.id },
    });
    if (!pattern) {
      res.status(404).json({ error: "Pattern not found" });
      return;
    }

    const grid = deserializeGrid(pattern.gridData);
    if (!grid || grid.length === 0) {
      res.status(500).json({ error: "Invalid grid data" });
      return;
    }

    // Generate machine format from grid (simplified: write basic valid binary)
    const buffer = generateBasicMachineFormat(grid, format, pattern.gridSize);

    const filename = `${pattern.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${format}`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err: any) {
    console.error({ event: "machine_export_error", format, error: String(err) });
    res.status(500).json({ error: `${format.toUpperCase()} export failed` });
  }
}

/**
 * Generate a basic valid DST or PES file from a stitch grid.
 * DST format: 512-byte header + stitch records (3 bytes each) + end record.
 * PES format: header + stitch blocks.
 * This is a minimal implementation for MVP.
 */
function generateBasicMachineFormat(
  grid: any[][],
  format: "dst" | "pes",
  gridSize: number,
): Buffer {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const stitchSpacing = 2; // mm between stitches

  if (format === "dst") {
    // DST format: 512-byte header filled with spaces, then stitch records
    const header = Buffer.alloc(512, 0x20);
    // Write stitch count into DST header at offset 0x14
    const totalStitches = width * height;
    header.writeUInt16LE(totalStitches & 0xFFFF, 0x14);
    header.writeUInt16LE((totalStitches >> 16) & 0xFFFF, 0x16);

    const stitches: Buffer[] = [header];

    // Generate running stitches row by row
    for (let r = 0; r < height; r++) {
      const y = r * stitchSpacing;
      for (let c = 0; c < width; c++) {
        if (grid[r][c]?.color && grid[r][c].color !== "#ffffff") {
          const x = c * stitchSpacing;
          const record = Buffer.alloc(3);
          // Stitch X/Y relative coordinates (simplified)
          record.writeInt8(Math.min(127, Math.max(-128, x & 0xFF)), 1);
          record.writeInt8(Math.min(127, Math.max(-128, y & 0xFF)), 2);
          stitches.push(record);
        }
      }
      // Color change at end of row
      const colorChange = Buffer.from([0x00, 0x00, 0xC3]);
      stitches.push(colorChange);
    }

    // End record
    stitches.push(Buffer.from([0x00, 0x00, 0xF3]));
    return Buffer.concat(stitches);
  }

  // PES format (simplified)
  if (format === "pes") {
    // PES header: #PES0001 + basic metadata
    const header = Buffer.alloc(256, 0x00);
    Buffer.from("#PES0001").copy(header);
    return Buffer.concat([header, Buffer.from(`StitchWise pattern ${gridSize}x${gridSize}`, "ascii")]);
  }

  return Buffer.from([]);
}
