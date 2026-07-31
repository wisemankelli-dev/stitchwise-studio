/**
 * Quilt Block PDF Exporter — Generates printable quilt block pattern sheets.
 *
 * Uses pdfkit to render a professional A4 PDF with:
 *   1. Block metadata header
 *   2. Visual grid rendering (colored rectangles + diagonal lines for HST/QST splits)
 *   3. Fabric key with color swatches, names, and usage counts
 *   4. Cutting guide table with dimensions, quantities, and fabric assignments
 */

import PDFDocument from "pdfkit";
import { GridSplit } from "../../domain/quiltBlock";
import type {
  QuiltBlockProject,
  QuiltBlockData,
  BlockFabric,
  Patch,
} from "../../domain/quiltBlock";

// ─── Dimensions & Layout Constants ───────────────────────────────────────

const PAGE = { width: 595, height: 842 }; // A4 portrait in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const CELL_SIZE = 40; // grid cell size in points
const GRID_ORIGIN_X = MARGIN + 60; // leave space for row labels
const GRID_ORIGIN_Y = 220;

// Fabric letters: A, B, C, ..., Z
function fabricLetter(index: number): string {
  return String.fromCharCode(65 + Math.min(index, 25));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function parseQuiltBlockData(project: QuiltBlockProject): QuiltBlockData {
  return JSON.parse(project.data) as QuiltBlockData;
}

/**
 * Count how many patches use each fabric.
 * Returns an array of counts indexed by fabric palette index.
 */
function countFabricUsage(patches: Patch[], fabricCount: number): number[] {
  const counts: number[] = new Array(fabricCount).fill(0);
  for (const patch of patches) {
    if (patch.fabricIndex >= 0 && patch.fabricIndex < fabricCount) {
      counts[patch.fabricIndex]++;
    }
  }
  return counts;
}

/**
 * Calculate patch dimensions in finished inches.
 * Cell size = blockSize / gridDimension. Patch width/height accounts for
 * shape type, subdivisions, and seam allowance.
 */
function patchDimensions(
  patch: Patch,
  blockSize: number,
  gridRows: number,
  gridCols: number,
): { width: number; height: number } {
  const cellW = blockSize / gridCols;
  const cellH = blockSize / gridRows;
  const scale = patch.scale || 1;

  let w = cellW * scale;
  let h = cellH * scale;

  switch (patch.shape) {
    case "half_square_triangle":
      // HST fills half the cell
      w = cellW;
      h = cellH;
      break;
    case "quarter_square_triangle":
      w = cellW;
      h = cellH;
      break;
    case "flying_geese":
      w = cellW * 2;
      h = cellH;
      break;
    case "diamond":
      w = cellW * 0.7;
      h = cellH * 0.7;
      break;
  }

  return {
    width: Math.round(w * 100) / 100,
    height: Math.round(h * 100) / 100,
  };
}

/**
 * Shape name mapping for the cutting guide.
 */
function shapeLabel(shape: string): string {
  switch (shape) {
    case "square": return "Square";
    case "rectangle": return "Rectangle";
    case "half_square_triangle": return "HST";
    case "quarter_square_triangle": return "QST";
    case "triangle": return "Triangle";
    case "flying_geese": return "Flying Geese";
    case "diamond": return "Diamond";
    default: return shape;
  }
}

// ─── PDF Generation ──────────────────────────────────────────────────────

export async function generateQuiltBlockPdf(project: QuiltBlockProject): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: Error) => reject(err));

  const blockData = parseQuiltBlockData(project);
  const fabrics: BlockFabric[] = blockData.fabrics || [];
  const patches: Patch[] = blockData.patches || [];
  const rows = project.gridRows || blockData.gridRows || 4;
  const cols = project.gridCols || blockData.gridCols || 4;
  const blockSize = project.blockSize || blockData.blockSize || 12;
  const seamAllowance = blockData.seamAllowance ?? 0.25;
  const fabricCounts = countFabricUsage(patches, fabrics.length);

  // ── Header ─────────────────────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("StitchWise Studio — Quilt Block Pattern", MARGIN, 40, {
      align: "center",
      width: CONTENT_WIDTH,
    });

  doc
    .moveTo(MARGIN, 70)
    .lineTo(PAGE.width - MARGIN, 70)
    .stroke("#e2e8f0");

  // ── Section 1: Block Info ──────────────────────────────────────────────
  let y = 85;
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Block Information", MARGIN, y);
  y += 18;

  doc.font("Helvetica").fontSize(10);
  const infoLines = [
    `Name:            ${project.name}`,
    `Block Size:      ${blockSize}" × ${blockSize}"`,
    `Grid:            ${cols} columns × ${rows} rows`,
    `Seam Allowance:  ${seamAllowance}"`,
    `Fabrics:         ${fabrics.length}`,
    `Total Patches:   ${patches.length}`,
  ];
  for (const line of infoLines) {
    doc.text(line, MARGIN, y);
    y += 14;
  }

  // ── Section 2: Visual Grid ─────────────────────────────────────────────
  y = Math.max(y + 10, GRID_ORIGIN_Y - 20);
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Block Layout", MARGIN, y);
  y += 20;

  const gridStartY = y;
  const totalGridW = cols * CELL_SIZE;
  const totalGridH = rows * CELL_SIZE;

  // Draw grid border
  doc
    .rect(GRID_ORIGIN_X, gridStartY, totalGridW, totalGridH)
    .stroke("#1e293b");

  // Build patch lookup: map (row, col) → patch
  const patchMap = new Map<string, Patch>();
  for (const p of patches) {
    patchMap.set(`${p.row},${p.col}`, p);
  }

  // Track fabric letter assignments (first occurrence)
  const fabricLetters = new Map<number, string>();
  for (const p of patches) {
    if (!fabricLetters.has(p.fabricIndex)) {
      fabricLetters.set(p.fabricIndex, fabricLetter(fabricLetters.size));
    }
  }

  // Draw each cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellX = GRID_ORIGIN_X + c * CELL_SIZE;
      const cellY = gridStartY + r * CELL_SIZE;
      const patch = patchMap.get(`${r},${c}`);

      // Cell border
      doc.rect(cellX, cellY, CELL_SIZE, CELL_SIZE).stroke("#94a3b8");

      if (patch && patch.fabricIndex < fabrics.length) {
        const fabric = fabrics[patch.fabricIndex];
        if (fabric?.color) {
          const { r: red, g: green, b: blue } = hexToRgb(fabric.color);

          // Fill cell with fabric color
          doc
            .rect(cellX + 2, cellY + 2, CELL_SIZE - 4, CELL_SIZE - 4)
            .fill([red / 255, green / 255, blue / 255]);

          // Draw split lines for HST / QST
          if (patch.split === GridSplit.HST_A) {
            doc
              .moveTo(cellX + 2, cellY + 2)
              .lineTo(cellX + CELL_SIZE - 2, cellY + CELL_SIZE - 2)
              .stroke("#1e293b");
          } else if (patch.split === GridSplit.HST_B) {
            doc
              .moveTo(cellX + CELL_SIZE - 2, cellY + 2)
              .lineTo(cellX + 2, cellY + CELL_SIZE - 2)
              .stroke("#1e293b");
          } else if (patch.split === GridSplit.QST) {
            doc
              .moveTo(cellX + 2, cellY + 2)
              .lineTo(cellX + CELL_SIZE - 2, cellY + CELL_SIZE - 2)
              .stroke("#1e293b");
            doc
              .moveTo(cellX + CELL_SIZE - 2, cellY + 2)
              .lineTo(cellX + 2, cellY + CELL_SIZE - 2)
              .stroke("#1e293b");
          }

          // Fabric letter label
          const letter = fabricLetters.get(patch.fabricIndex) || "?";
          const textColor =
            (red * 0.299 + green * 0.587 + blue * 0.114) > 150
              ? "#1e293b"
              : "#ffffff";
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(textColor)
            .text(letter, cellX + CELL_SIZE / 2 - 4, cellY + CELL_SIZE / 2 - 7, {
              width: 8,
              align: "center",
            });
        }
      }
    }
  }

  // Column labels (A, B, C, ...)
  for (let c = 0; c < cols; c++) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        String(c + 1),
        GRID_ORIGIN_X + c * CELL_SIZE + CELL_SIZE / 2 - 3,
        gridStartY - 12,
        { width: 6, align: "center" },
      );
  }

  y = gridStartY + totalGridH + 20;

  // ── Section 3: Fabric Key ──────────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#1e293b")
    .text("Fabric Key", MARGIN, y);
  y += 20;

  const swatchSize = 16;
  for (let i = 0; i < fabrics.length; i++) {
    const fabric = fabrics[i];
    const letter = fabricLetters.get(i) || fabricLetter(i);
    const { r, g, b } = hexToRgb(fabric.color || "#cccccc");
    const usage = fabricCounts[i] || 0;

    // Color swatch
    doc
      .rect(MARGIN, y + 1, swatchSize, swatchSize)
      .fill([r / 255, g / 255, b / 255])
      .stroke("#94a3b8");

    const label = `${letter}: ${fabric.name || `Fabric ${i + 1}`} — ${fabric.color || "#ccc"} — ${usage} patch${usage !== 1 ? "es" : ""}`;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#1e293b")
      .text(label, MARGIN + swatchSize + 8, y);
    y += 20;
  }

  y += 10;

  // ── Section 4: Cutting Guide ───────────────────────────────────────────
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#1e293b")
    .text("Cutting Guide", MARGIN, y);
  y += 20;

  // Table header
  const colX = [MARGIN, MARGIN + 80, MARGIN + 190, MARGIN + 280, MARGIN + 350];
  const colW = [80, 110, 90, 70, 120];

  doc.font("Helvetica-Bold").fontSize(9);
  const headers = ["Shape", "Dimensions", "Quantity", "Fabric", "Fabric Name"];
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], colX[i], y, { width: colW[i] });
  }
  y += 16;

  // Header underline
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .stroke("#94a3b8");
  y += 6;

  // Group patches by shape + fabric combination for the cutting guide
  const cuttingMap = new Map<string, { shape: string; count: number; fabricIdx: number; width: number; height: number }>();
  for (const patch of patches) {
    const dims = patchDimensions(patch, blockSize, rows, cols);
    const key = `${patch.shape}|${patch.fabricIndex}|${dims.width}x${dims.height}`;
    const existing = cuttingMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      cuttingMap.set(key, {
        shape: patch.shape,
        count: 1,
        fabricIdx: patch.fabricIndex,
        width: dims.width,
        height: dims.height,
      });
    }
  }

  doc.font("Helvetica").fontSize(8.5).fillColor("#1e293b");
  for (const [, entry] of cuttingMap) {
    const fabric = entry.fabricIdx < fabrics.length ? fabrics[entry.fabricIdx] : null;
    const letter = fabricLetters.get(entry.fabricIdx) || "?";

    doc.text(shapeLabel(entry.shape), colX[0], y, { width: colW[0] });
    doc.text(`${entry.width}" × ${entry.height}"`, colX[1], y, { width: colW[1] });
    doc.text(String(entry.count), colX[2], y, { width: colW[2] });
    doc.text(letter, colX[3], y, { width: colW[3] });
    doc.text(fabric?.name || "—", colX[4], y, { width: colW[4] });
    y += 14;
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  y = Math.max(y + 20, PAGE.height - 60);
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .stroke("#e2e8f0");
  y += 10;

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#94a3b8")
    .text(
      `Generated by StitchWise Studio — stitchwisestudio.com — ${new Date().toISOString().slice(0, 10)}`,
      MARGIN,
      y,
      { align: "center", width: CONTENT_WIDTH },
    );

  doc.end();
  });
}
