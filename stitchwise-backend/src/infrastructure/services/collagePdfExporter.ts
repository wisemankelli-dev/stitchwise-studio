/**
 * Collage Pattern PDF Exporter — Generates printable collage quilt pattern sheets.
 *
 * Uses pdfkit to render a professional A4 PDF with:
 *   1. Pattern header with name and block size
 *   2. Outline pattern with numbered fabric pieces
 *   3. Color guide table (number → swatch → suggested fabric)
 *   4. Cutting instructions with seam allowance note
 */

import PDFDocument from "pdfkit";
import type { PatternRegion } from "../../domain/ai/collageAI";

// ─── Dimensions & Layout ────────────────────────────────────────────────

const PAGE = { width: 595, height: 842 }; // A4 portrait in points
const MARGIN = 40;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

export interface CollagePdfOptions {
  /** Project name / prompt */
  name: string;
  /** Block size in inches */
  blockSize: number;
  /** Pattern regions */
  regions: PatternRegion[];
  /** Canvas dimensions used for layout */
  canvasWidth?: number;
  canvasHeight?: number;
}

export async function generateCollagePatternPdf(opts: CollagePdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: Error) => reject(err));

    const canvasW = opts.canvasWidth || 400;
    const canvasH = opts.canvasHeight || 400;

    // Scale pattern to fit content width while maintaining aspect ratio
    const patternAreaWidth = CONTENT_WIDTH - 120; // leave room for color guide sidebar
    const patternAreaHeight = PAGE.height - 320;
    const scaleX = patternAreaWidth / canvasW;
    const scaleY = patternAreaHeight / canvasH;
    const scale = Math.min(scaleX, scaleY, 1.2);

    const patternW = canvasW * scale;
    const patternH = canvasH * scale;
    const patternX = MARGIN + 50; // left labels
    const patternY = 250;

    // ── Header ──────────────────────────────────────────────────────────
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("StitchWise Studio", MARGIN, 30, { align: "center", width: CONTENT_WIDTH });

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor("#666")
      .text("Collage Quilt Pattern", MARGIN, 52, { align: "center", width: CONTENT_WIDTH })
      .fillColor("#000");

    doc
      .moveTo(MARGIN, 72)
      .lineTo(PAGE.width - MARGIN, 72)
      .stroke("#e2e8f0");

    // Project info line
    let y = 82;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Pattern:", MARGIN, y, { continued: true })
      .font("Helvetica")
      .text(` ${opts.name || "Untitled Collage"}`);
    y += 16;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Block Size:", MARGIN, y, { continued: true })
      .font("Helvetica")
      .text(` ${opts.blockSize}" × ${opts.blockSize}"`);
    y += 16;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("Pieces:", MARGIN, y, { continued: true })
      .font("Helvetica")
      .text(` ${opts.regions.length}`);

    // ── Section: Pattern Outline ────────────────────────────────────────
    y = 130;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .text("Pattern Outline", MARGIN, y);

    // Draw the outline pattern - white background with bordered regions
    const bgX = patternX - 5;
    const bgY = patternY - 5;
    doc
      .rect(bgX, bgY, patternW + 10, patternH + 10)
      .fillAndStroke("#fafafa", "#ccc");

    // Draw each region
    for (const r of opts.regions) {
      const rx = patternX + r.x * scale;
      const ry = patternY + r.y * scale;
      const rw = r.width * scale;
      const rh = r.height * scale;

      // Region fill (white)
      doc.rect(rx, ry, rw, rh).fillAndStroke("#fff", "#333");

      // Region number
      const fontSize = Math.max(7, Math.min(rw, rh) * 0.35);
      doc
        .font("Helvetica-Bold")
        .fontSize(fontSize)
        .fillColor("#333")
        .text(
          String(r.number),
          rx + rw / 2 - fontSize * 0.3,
          ry + rh / 2 - fontSize * 0.35,
          { width: rw, align: "center" }
        );
    }

    // ── Section: Color Guide ────────────────────────────────────────────
    const guideY = patternY + patternH + 20;
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#000")
      .text("Color Guide", MARGIN, guideY);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666")
      .text("Suggested fabric colors for each numbered piece.", MARGIN, guideY + 16);

    // Color guide table
    let tableY = guideY + 34;
    const colX = [MARGIN, MARGIN + 30, MARGIN + 50, MARGIN + 70];

    // Header
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#000");
    doc.text("#", colX[0], tableY);
    doc.text("Swatch", colX[1], tableY);
    doc.text("Fabric", colX[2], tableY);

    doc
      .moveTo(MARGIN, tableY + 11)
      .lineTo(PAGE.width - MARGIN, tableY + 11)
      .stroke("#e2e8f0");

    tableY += 14;

    // Build unique color list (deduplicate by suggestedHex)
    const seenColors = new Map<string, PatternRegion>();
    for (const r of opts.regions) {
      if (!seenColors.has(r.suggestedHex)) {
        seenColors.set(r.suggestedHex, r);
      }
    }
    const uniqueColors = Array.from(seenColors.values());

    doc.font("Helvetica").fontSize(8);
    for (const c of uniqueColors) {
      if (tableY > PAGE.height - 60) break; // safety overflow

      // Number
      doc.fillColor("#000").text(String(c.number), colX[0], tableY);

      // Color swatch
      doc
        .rect(colX[1], tableY, 12, 12)
        .fillAndStroke(c.suggestedHex, "#999");

      // Fabric name
      doc
        .fillColor("#000")
        .text(c.suggestedColor, colX[2], tableY + 1);

      tableY += 16;
    }

    // ── Cutting Instructions ────────────────────────────────────────────
    const cutY = Math.max(tableY + 20, guideY + 120);
    doc
      .moveTo(MARGIN, cutY)
      .lineTo(PAGE.width - MARGIN, cutY)
      .stroke("#e2e8f0");

    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#000")
      .text("Cutting Instructions", MARGIN, cutY + 10);

    const instructions = [
      "1. Print this pattern at 100% scale (do not scale to fit).",
      `2. The pattern is designed for a ${opts.blockSize}" × ${opts.blockSize}" finished block.`,
      "3. Cut out each numbered piece along the solid outline.",
      "4. Trace each piece onto your chosen fabric, adding ¼\" seam allowance on all sides.",
      "5. Use the Color Guide above for fabric suggestions, or choose your own!",
      "6. Piece the sections together following the number layout as a map.",
      "7. Press seams open and square up to finish.",
    ];

    doc.font("Helvetica").fontSize(9).fillColor("#333");
    let instY = cutY + 28;
    for (const line of instructions) {
      doc.text(line, MARGIN, instY, { width: CONTENT_WIDTH });
      instY += 14;
    }

    // ── Footer ──────────────────────────────────────────────────────────
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#999")
      .text(
        `Generated by StitchWise Studio — stitchwisestudio.com`,
        MARGIN,
        PAGE.height - 30,
        { align: "center", width: CONTENT_WIDTH }
      );

    doc.end();
  });
}