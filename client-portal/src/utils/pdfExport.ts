import { jsPDF } from 'jspdf';

export interface PdfExportOptions {
  patternName: string;
  grid: Record<string, string>;       // "row,col" → hex
  gridWidth: number;
  gridHeight: number;
  fabricCount: number;                // e.g. 14 = 14ct Aida
  colorNames?: Record<string, string>; // hex → color name lookup
  cellFractions?: Record<string, number>; // "row,col" → 0.25|0.5|0.75
}

interface PaletteEntry {
  hex: string;
  code: string;
  name: string;
  count: number;
}

/**
 * Render the stitch grid to an off-screen canvas and return a data URL.
 */
function renderGridToCanvas(
  grid: Record<string, string>,
  width: number,
  height: number,
  cellFractions?: Record<string, number>,
): string {
  const pixelSize = 2; // 2px per stitch — fine for print
  const canvas = document.createElement('canvas');
  canvas.width = width * pixelSize;
  canvas.height = height * pixelSize;
  const ctx = canvas.getContext('2d')!;

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const key = `${r},${c}`;
      const color = grid[key];
      if (!color) continue;
      const x = c * pixelSize;
      const y = r * pixelSize;
      
      const fraction = cellFractions?.[key];
      if (fraction !== undefined && fraction < 1) {
        // Draw fractional fill as diagonal
        ctx.fillStyle = color;
        ctx.beginPath();
        if (fraction <= 0.25) {
          ctx.moveTo(x, y + pixelSize);
          ctx.lineTo(x, y + pixelSize * 0.5);
          ctx.lineTo(x + pixelSize * 0.5, y + pixelSize);
        } else if (fraction <= 0.5) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + pixelSize);
          ctx.lineTo(x + pixelSize, y + pixelSize);
        } else {
          // 0.75: fill all except top-right corner
          ctx.rect(x, y, pixelSize, pixelSize);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(x + pixelSize, y);
          ctx.lineTo(x + pixelSize * 0.5, y);
          ctx.lineTo(x + pixelSize, y + pixelSize * 0.5);
          ctx.closePath();
          ctx.fill();
          continue;
        }
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Build a palette from the grid: count each color, assign DMC-style codes.
 */
function buildPalette(
  grid: Record<string, string>,
  colorNames?: Record<string, string>,
): PaletteEntry[] {
  const counts: Record<string, number> = {};
  for (const color of Object.values(grid)) {
    if (color && color !== '#ffffff' && color !== '#fff') {
      counts[color] = (counts[color] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([hex, count], i) => ({
      hex,
      code: `DMC-${i + 1}`,
      name: colorNames?.[hex] || hex,
      count,
    }));
}

/**
 * Export a stitch pattern to PDF with an embedded color key.
 * All client-side — no server needed.
 */
export async function exportPatternToPdf(options: PdfExportOptions): Promise<void> {
  const {
    patternName,
    grid,
    gridWidth,
    gridHeight,
    fabricCount,
    colorNames,
    cellFractions,
  } = options;

  // Guard: empty grid
  const hasStitches = Object.values(grid).some(Boolean);
  if (!hasStitches) {
    alert('Cannot export empty pattern. Add some stitches first.');
    return;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let cursorY = 20;

  // ── Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('StitchWise Studio', margin, cursorY);
  cursorY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(patternName || 'Embroidery Pattern', margin, cursorY);
  cursorY += 6;

  // ── Metadata ──
  doc.setFontSize(9);
  const physicalW = (gridWidth / fabricCount).toFixed(1);
  const physicalH = (gridHeight / fabricCount).toFixed(1);
  const totalStitches = Object.values(grid).filter(Boolean).length;
  doc.text(
    `${gridWidth} × ${gridHeight} stitches  •  ${fabricCount}ct fabric  •  ${physicalW}″ × ${physicalH}″  •  ${totalStitches} stitches`,
    margin,
    cursorY,
  );
  cursorY += 8;

  // ── Grid Image ──
  const imgData = renderGridToCanvas(grid, gridWidth, gridHeight, cellFractions);
  const maxImgW = pageW - margin * 2;
  const maxImgH = 120; // max mm for the grid on page 1
  const imgAspect = gridWidth / gridHeight;
  let imgW = maxImgW;
  let imgH = imgW / imgAspect;
  if (imgH > maxImgH) {
    imgH = maxImgH;
    imgW = imgH * imgAspect;
  }
  doc.addImage(imgData, 'PNG', margin, cursorY, imgW, imgH);
  cursorY += imgH + 6;

  // ── Color Key Legend ──
  const palette = buildPalette(grid, colorNames);
  if (palette.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DMC Color Key', margin, cursorY);
    cursorY += 6;

    // Table header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const colX = [margin, margin + 28, margin + 46, margin + 80];
    doc.text('Swatch', colX[0], cursorY);
    doc.text('Code', colX[1], cursorY);
    doc.text('Stitches', colX[2], cursorY);
    doc.text('Color', colX[3], cursorY);
    cursorY += 1;
    doc.setDrawColor(220);
    doc.line(margin, cursorY, pageW - margin, cursorY);
    cursorY += 4;

    // Table rows
    doc.setFont('helvetica', 'normal');
    const rowH = 5;
    const swatchSize = 4;

    for (const entry of palette) {
      // New page if needed
      if (cursorY + rowH > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        cursorY = margin;
        // Reprint header on new page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Swatch', colX[0], cursorY);
        doc.text('Code', colX[1], cursorY);
        doc.text('Stitches', colX[2], cursorY);
        doc.text('Color', colX[3], cursorY);
        cursorY += 1;
        doc.line(margin, cursorY, pageW - margin, cursorY);
        cursorY += 4;
        doc.setFont('helvetica', 'normal');
      }

      // Swatch
      doc.setFillColor(entry.hex);
      doc.rect(colX[0], cursorY - swatchSize + 1, swatchSize, swatchSize, 'F');
      doc.setDrawColor(180);
      doc.rect(colX[0], cursorY - swatchSize + 1, swatchSize, swatchSize);

      // Code
      doc.text(entry.code, colX[1], cursorY);
      // Stitch count
      doc.text(String(entry.count), colX[2], cursorY);
      // Color name / hex
      const name = entry.name.length > 30 ? entry.name.substring(0, 30) + '…' : entry.name;
      doc.text(name, colX[3], cursorY);

      cursorY += rowH;
    }
  }

  // ── Footer ──
  const dateStr = new Date().toLocaleDateString();
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generated by StitchWise Studio on ${dateStr}`, margin, doc.internal.pageSize.getHeight() - 10);

  // ── Save ──
  const filename = (patternName || 'pattern').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
  doc.save(filename);
}
