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

export interface PaletteEntry {
  hex: string;
  code: string;
  name: string;
  count: number;
}

/**
 * Rule of thumb: one 6-strand DMC skein (~8 m) covers ≈ 3,100 cross stitches
 * on 14-count Aida worked over two threads. Stitches-per-skein scale roughly
 * linearly with fabric count (18ct → ~4,000, 22ct → ~4,900).
 */
export const STITCHES_PER_SKEIN_14CT = 3100;

/** Chart rendering constants. */
export const CHART_PX_PER_STITCH = 12; // ≥6 required by spec; 12 keeps tiles crisp & PDF size sane
export const TILE_STITCHES = 60;       // stitches per chart-tile axis
const GRIDLINE_EVERY = 10;
const PREVIEW_PX_PER_STITCH = 4;       // small overview on the summary page
export const OVERVIEW_PX_PER_STITCH = 10; // full-design overview page resolution
const SYMBOL_MIN_PX = CHART_PX_PER_STITCH; // draw per-cell symbols only at chart-tile scale

/**
 * Vendor-style chart symbols, assigned deterministically by palette index.
 * This list REPLICATES the backend CROSS_STITCH_SYMBOLS ordered glyph list
 * (stitchwise-backend/src/domain/stitch/types.ts) so the printed PDF chart and
 * the in-app pattern share the same symbol convention. Each glyph is drawn as
 * pure canvas-2D vector paths (no fonts, no images), so symbols stay crisp at
 * chart-tile scale, render identically in tests, and never depend on a font
 * being present in the PDF rasterizer.
 */
export const CHART_SYMBOLS = [
  'heart',        // ♥
  'diamond',      // ◆
  'dot',          // ●
  'star',         // ★ (5-point filled star)
  'tri-up',       // ▲
  'tri-down',     // ▼
  'square',       // ◼ (filled)
  'pentagon',     // ⬟
  'sparkle',      // ✦ (4-point sparkle)
  'open-sparkle', // ✧
  'flower',       // ✿
  'diamond-plus', // ❖
  'arrow',        // ➤
  'plus',         // ✚
  'square-open',  // ⬒ (open square — same intent as the ◻-style glyph)
] as const;
export type ChartSymbol = (typeof CHART_SYMBOLS)[number];

/** Symbols drawn as solid filled glyphs; the rest are stroked outlines. */
const SOLID_SYMBOLS: ReadonlySet<ChartSymbol> = new Set<ChartSymbol>([
  'heart', 'diamond', 'dot', 'star', 'square', 'pentagon', 'sparkle',
  'flower', 'diamond-plus', 'arrow',
]);

/** Stable per-index symbol; wraps when the palette exceeds the symbol set. */
export function symbolForIndex(index: number): ChartSymbol {
  return CHART_SYMBOLS[index % CHART_SYMBOLS.length];
}

/** hex → symbol map for a palette (palette order is deterministic → stable). */
export function assignSymbols(palette: PaletteEntry[]): Record<string, ChartSymbol> {
  const map: Record<string, ChartSymbol> = {};
  palette.forEach((entry, i) => {
    map[entry.hex] = symbolForIndex(i);
  });
  return map;
}

/** Normalize "#abc" → "#aabbcc" so identical colors don't split the key. */
function normalizeHex(hex: string): string {
  let h = hex.trim().toLowerCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

/**
 * Build the color key from the grid. Counts every filled cell (including white —
 * white is a real stitched DMC color), sorted most-used first, labeled DMC-1…N.
 * The header "total stitches" is derived from this palette so the sheet is
 * always internally consistent (total = Σ per-color counts).
 */
export function buildPalette(
  grid: Record<string, string>,
  colorNames?: Record<string, string>,
): PaletteEntry[] {
  const counts: Record<string, number> = {};
  for (const raw of Object.values(grid)) {
    if (!raw) continue;
    const hex = normalizeHex(raw);
    counts[hex] = (counts[hex] || 0) + 1;
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
 * Skein estimate for a stitch count: one 6-strand DMC skein ≈ 3,100 stitches
 * at 14ct over 2 threads; scales with fabric count. Always rounds up, min 1.
 */
export function estimateSkeins(stitches: number, fabricCount: number): number {
  const perSkein = STITCHES_PER_SKEIN_14CT * (fabricCount / 14);
  return Math.max(1, Math.ceil(stitches / perSkein));
}

/** Number of chart tiles needed along each axis for a grid of this size. */
export function computeChartTiles(
  gridWidth: number,
  gridHeight: number,
): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.ceil(gridWidth / TILE_STITCHES)),
    rows: Math.max(1, Math.ceil(gridHeight / TILE_STITCHES)),
  };
}

/* ------------------------------------------------------------------ *
 * Canvas rendering
 * ------------------------------------------------------------------ */

/** Parse a normalized hex color into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

/** Perceived brightness 0–255 (Rec. 601 luma weights). */
export function colorLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Symbol ink: white on dark fills, near-black on light fills (legibility). */
export function symbolInk(hex: string): string {
  return colorLuminance(hex) > 140 ? '#1f2937' : '#ffffff';
}

/** Trace the outline of one chart symbol centered on (cx, cy), half-size s. */
function drawSymbolPath(
  ctx: CanvasRenderingContext2D,
  symbol: ChartSymbol,
  cx: number,
  cy: number,
  s: number,
): void {
  ctx.beginPath();
  switch (symbol) {
    case 'heart': {
      // Two circles + a downward triangle → classic heart outline
      ctx.moveTo(cx, cy - s * 0.35);
      ctx.arc(cx - s * 0.45, cy - s * 0.3, s * 0.5, 0, Math.PI * 2);
      ctx.moveTo(cx, cy - s * 0.35);
      ctx.arc(cx + s * 0.45, cy - s * 0.3, s * 0.5, 0, Math.PI * 2);
      ctx.moveTo(cx - s * 0.95, cy - s * 0.28);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx + s * 0.95, cy - s * 0.28);
      ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      break;
    case 'dot':
      ctx.arc(cx, cy, s * 0.72, 0, Math.PI * 2);
      break;
    case 'star': {
      // 5-pointed star (★) — outer 5 points, inner 5 concave notches
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s : s * 0.45;
        const px = cx + r * Math.cos(ang);
        const py = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'tri-up':
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.lineTo(cx + s, cy + s);
      ctx.closePath();
      break;
    case 'tri-down':
      ctx.moveTo(cx, cy + s);
      ctx.lineTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy - s);
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(cx - s, cy - s, s * 2, s * 2);
      break;
    case 'pentagon': {
      // Regular pentagon (all sides equal)
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = cx + s * Math.cos(ang);
        const py = cy + s * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'sparkle': {
      // 4-point sparkle: concave diamond (✦)
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx - s, cy);
      ctx.lineTo(cx - s * 0.3, cy - s * 0.3);
      ctx.closePath();
      break;
    }
    case 'open-sparkle': {
      // Open 4-point sparkle (✧) — stroked, not filled
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s * 0.3, cy - s * 0.3);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s * 0.3, cy + s * 0.3);
      ctx.lineTo(cx - s, cy);
      ctx.lineTo(cx - s * 0.3, cy - s * 0.3);
      break;
    }
    case 'flower': {
      // Six-petal flower (✿)
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        ctx.moveTo(cx, cy);
        ctx.arc(
          cx + s * 0.6 * Math.cos(ang),
          cy + s * 0.6 * Math.sin(ang),
          s * 0.42,
          0,
          Math.PI * 2,
        );
      }
      break;
    }
    case 'diamond-plus': {
      // Diamond with inner cross (❖)
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      break;
    }
    case 'arrow': {
      // Right-pointing solid arrow (➤)
      ctx.moveTo(cx - s, cy - s * 0.62);
      ctx.lineTo(cx + s * 0.35, cy - s * 0.62);
      ctx.lineTo(cx + s * 0.35, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx + s * 0.35, cy + s);
      ctx.lineTo(cx + s * 0.35, cy + s * 0.62);
      ctx.lineTo(cx - s, cy + s * 0.62);
      ctx.closePath();
      break;
    }
    case 'plus': {
      // Greek cross (✚)
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx, cy + s);
      ctx.moveTo(cx - s, cy);
      ctx.lineTo(cx + s, cy);
      break;
    }
    case 'square-open':
      ctx.rect(cx - s, cy - s, s * 2, s * 2);
      break;
  }
}

/**
 * Draw a chart symbol centered on (cx, cy) with ink contrasting against the
 * cell fill. Solid glyphs (dot, star) are filled; the rest are stroked.
 */
function drawCellSymbol(
  ctx: CanvasRenderingContext2D,
  symbol: ChartSymbol,
  cx: number,
  cy: number,
  px: number,
  fill: string,
  ink?: string,
): void {
  const s = px * 0.29; // symbol spans ~58% of the cell (55–60% per spec)
  const color = ink ?? symbolInk(fill);
  ctx.lineWidth = Math.max(1, px * 0.15);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  drawSymbolPath(ctx, symbol, cx, cy, s);
  if (SOLID_SYMBOLS.has(symbol)) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

/** Standalone symbol glyph as a PNG data URL (key-page column, dark ink). */
export function renderSymbolImage(symbol: ChartSymbol, px = 24, ink = '#1f2937'): string {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  drawCellSymbol(ctx, symbol, px / 2, px / 2, px, '#000000', ink);
  return canvas.toDataURL('image/png');
}

/** Draw one fractional stitch cell (0.25 / 0.5 / 0.75) as a diagonal. */
function fillFractionalCell(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  px: number,
  fraction: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (fraction <= 0.25) {
    ctx.moveTo(x, y + px);
    ctx.lineTo(x, y + px * 0.5);
    ctx.lineTo(x + px * 0.5, y + px);
  } else if (fraction <= 0.5) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + px);
    ctx.lineTo(x + px, y + px);
  } else {
    // 0.75: fill all except the top-right corner triangle
    ctx.rect(x, y, px, px);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + px, y);
    ctx.lineTo(x + px * 0.5, y);
    ctx.lineTo(x + px, y + px * 0.5);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fill();
}

/**
 * Render the stitch grid to an off-screen canvas and return a PNG data URL.
 * Only the stitches themselves are drawn here (on white fabric); the PDF
 * layer adds crisp vector gridlines + numbering on top, which keeps the
 * embedded PNG small (flat color regions compress well) and the print sharp.
 * `tile` slices the design so each chart page embeds only its own cells.
 */
function renderStitchesToCanvas(
  grid: Record<string, string>,
  width: number,
  height: number,
  cellFractions: Record<string, number> | undefined,
  pxPerStitch: number,
  tile?: { c0: number; r0: number; c1: number; r1: number },
  symbols?: Record<string, ChartSymbol>,
): string {
  const c0 = tile?.c0 ?? 0;
  const r0 = tile?.r0 ?? 0;
  const c1 = tile?.c1 ?? width;
  const r1 = tile?.r1 ?? height;

  const canvas = document.createElement('canvas');
  canvas.width = (c1 - c0) * pxPerStitch;
  canvas.height = (r1 - r0) * pxPerStitch;
  const ctx = canvas.getContext('2d')!;

  // White fabric behind the stitches
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawSymbols = symbols !== undefined && pxPerStitch >= SYMBOL_MIN_PX;

  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const key = `${r},${c}`;
      const color = grid[key];
      if (!color) continue;
      const x = (c - c0) * pxPerStitch;
      const y = (r - r0) * pxPerStitch;

      const fraction = cellFractions?.[key];
      if (fraction !== undefined && fraction < 1) {
        fillFractionalCell(ctx, color, x, y, pxPerStitch, fraction);
      } else {
        ctx.fillStyle = normalizeHex(color);
        ctx.fillRect(x, y, pxPerStitch, pxPerStitch);
      }

      // Vendor-style per-cell symbol, contrasting against the cell fill.
      // Skipped for small partial stitches (the triangle fill is the guide).
      if (drawSymbols && (fraction === undefined || fraction >= 0.75)) {
        const symbol = symbols![normalizeHex(color)];
        if (symbol) {
          drawCellSymbol(ctx, symbol, x + pxPerStitch / 2, y + pxPerStitch / 2, pxPerStitch, color);
        }
      }
    }
  }

  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ *
 * PDF assembly
 * ------------------------------------------------------------------ */

const A4_W = 210;
const MARGIN = 14;
const CONTENT_W = A4_W - MARGIN * 2;
const ROSE: [number, number, number] = [139, 92, 118];

function fitImageMm(imgW: number, imgH: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return { w: imgW * scale, h: imgH * scale };
}

/**
 * Build the full multi-page pattern sheet and return the jsPDF document
 * (no save, no alerts — separated for testability).
 *
 * Page 1   Summary — name, stitch dimensions, fabric count, finished size,
 *          total stitch count + small full-design preview.
 * Page 2   Materials & Color Key — symbol, swatch, code, name, exact stitch
 *          count and skein estimate per color (paginates for large palettes).
 * Page 3   Full Design Overview — the whole design on one page, numbered
 *          every 10 stitches on both axes ("recognizable pattern with box
 *          counts").
 * Pages 4+ Chart — full-resolution tiles (per-color symbols on every stitch)
 *          with 10-stitch gridlines and row/column numbering.
 * Last     Instructions — reading the chart, stitching basics, finishing.
 */
export function buildPatternPdf(options: PdfExportOptions): jsPDF {
  const {
    patternName,
    grid,
    gridWidth,
    gridHeight,
    fabricCount,
    colorNames,
    cellFractions,
  } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const palette = buildPalette(grid, colorNames);
  // Internal consistency: the header total IS the sum of the per-color counts.
  const totalStitches = palette.reduce((sum, e) => sum + e.count, 0);

  // Stable per-color chart symbols (vendor style), by palette order.
  const symbols = assignSymbols(palette);

  const finishedW = (gridWidth / fabricCount).toFixed(1);
  const finishedH = (gridHeight / fabricCount).toFixed(1);

  // Gridline + number positions for a slice: every 10th global stitch
  // boundary (10, 20, …) plus the design origin (labelled "1").
  const labelPositions = (globalStart: number, globalEnd: number): number[] => {
    const positions: number[] = [];
    if (globalStart === 0) positions.push(0);
    for (let g = GRIDLINE_EVERY; g <= globalEnd; g += GRIDLINE_EVERY) positions.push(g);
    return positions;
  };

  /* ── Page 1 · Summary ─────────────────────────────────────────── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(ROSE[0], ROSE[1], ROSE[2]);
  doc.text('STITCHWISE STUDIO', MARGIN, 18);

  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text(patternName || 'Embroidery Pattern', MARGIN, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text('Cross-Stitch Pattern Sheet', MARGIN, 36);

  // Info panel
  const infoRows: [string, string][] = [
    ['Stitch count (W × H)', `${gridWidth} × ${gridHeight}`],
    ['Fabric', `${fabricCount} count Aida (evenweave)`],
    ['Finished size', `${finishedW}″ × ${finishedH}″ (${(gridWidth / fabricCount * 2.54).toFixed(1)} × ${(gridHeight / fabricCount * 2.54).toFixed(1)} cm)`],
    ['Total stitches', `${totalStitches.toLocaleString()}`],
    ['Colors', `${palette.length}`],
  ];
  let infoY = 44;
  const boxW = CONTENT_W;
  doc.setDrawColor(226, 215, 222);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, infoY - 5, boxW, infoRows.length * 6.5 + 4, 'S');
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(label, MARGIN + 3, infoY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(value, MARGIN + boxW - 3, infoY, { align: 'right' });
    infoY += 6.5;
  }

  // Full-design preview
  const previewDataUrl = renderStitchesToCanvas(
    grid, gridWidth, gridHeight, cellFractions, PREVIEW_PX_PER_STITCH,
  );
  const previewAspect = gridWidth / gridHeight;
  let pvW = 120;
  let pvH = pvW / previewAspect;
  if (pvH > 92) {
    pvH = 92;
    pvW = pvH * previewAspect;
  }
  if (pvW > CONTENT_W) {
    pvW = CONTENT_W;
    pvH = pvW / previewAspect;
  }
  doc.addImage(previewDataUrl, 'PNG', (pageW - pvW) / 2, infoY + 4, pvW, pvH);

  /* ── Page 2 · Materials & Color Key ────────────────────────────── */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(ROSE[0], ROSE[1], ROSE[2]);
  doc.text('Materials & Color Key', MARGIN, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Worked over 2 threads · ${fabricCount}ct · ${totalStitches.toLocaleString()} total stitches · DMC-style floss (any brand equivalent)`,
    MARGIN,
    26,
  );

  const keyCols = [MARGIN, MARGIN + 8, MARGIN + 19, MARGIN + 44, MARGIN + 114, MARGIN + 158];
  const rowH = 6;
  let keyY = 34;

  const drawKeyHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text('Symbol', keyCols[0], keyY);
    doc.text('Swatch', keyCols[1], keyY);
    doc.text('Code', keyCols[2], keyY);
    doc.text('Color name', keyCols[3], keyY);
    doc.text('Stitches', keyCols[4], keyY);
    doc.text('Skeins', keyCols[5], keyY);
    doc.setDrawColor(220);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, keyY + 1.5, pageW - MARGIN, keyY + 1.5);
    keyY += 5;
  };

  const bottomLimit = pageH - 16;
  drawKeyHeader();

  for (const entry of palette) {
    if (keyY + rowH > bottomLimit) {
      doc.addPage();
      keyY = 18;
      drawKeyHeader();
    }
    const swatchY = keyY - 3.5;
    // Symbol glyph (dark ink on white paper, same glyph the chart uses)
    const symbol = symbols[entry.hex];
    if (symbol) {
      doc.addImage(renderSymbolImage(symbol), 'PNG', keyCols[0], swatchY, 4.5, 4.5);
    }
    doc.setFillColor(entry.hex);
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(keyCols[1], swatchY, 4.5, 4.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(40, 40, 40);
    doc.text(entry.code, keyCols[2], keyY);

    doc.setFont('helvetica', 'normal');
    const name = entry.name.length > 34 ? `${entry.name.substring(0, 33)}…` : entry.name;
    doc.text(name, keyCols[3], keyY);

    doc.text(entry.count.toLocaleString(), keyCols[4], keyY);

    const skeins = estimateSkeins(entry.count, fabricCount);
    doc.setFont('helvetica', 'bold');
    doc.text(`${skeins} ${skeins === 1 ? 'skein' : 'skeins'}`, keyCols[5], keyY);
    keyY += rowH;
  }

  // Skein footnote
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(
    `Skein estimate: 1 × 6-strand DMC skein ≈ ${STITCHES_PER_SKEIN_14CT.toLocaleString()} stitches on 14ct over 2 threads (scaled for ${fabricCount}ct). Rounded up — buy a little extra.`,
    MARGIN,
    bottomLimit + 4,
  );

  /* ── Page 3 · Full Design Overview ─────────────────────────────── */
  // The whole design on one page, numbered every 10 on both axes — the
  // "recognizable pattern with box counts" page (vendor reference).
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(ROSE[0], ROSE[1], ROSE[2]);
  doc.text('Full Design Overview — each square = 1 stitch', MARGIN, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'The entire design on one page — gridlines and numbers mark every 10 stitches.',
    MARGIN,
    26,
  );

  const overviewDataUrl = renderStitchesToCanvas(
    grid, gridWidth, gridHeight, cellFractions, OVERVIEW_PX_PER_STITCH,
  );
  const oImgWpx = gridWidth * OVERVIEW_PX_PER_STITCH;
  const oImgHpx = gridHeight * OVERVIEW_PX_PER_STITCH;
  const { w: oW, h: oH } = fitImageMm(oImgWpx, oImgHpx, CONTENT_W, pageH - 42);
  const oX = (pageW - oW) / 2;
  const oY = 31;
  doc.addImage(overviewDataUrl, 'PNG', oX, oY, oW, oH);

  // Box gridlines every 10 stitches
  const oStitchMm = oW / gridWidth;
  doc.setDrawColor(160, 160, 170);
  doc.setLineWidth(0.15);
  for (const g of labelPositions(0, gridWidth)) {
    const x = oX + g * oStitchMm;
    doc.line(x, oY, x, oY + oH);
  }
  for (const g of labelPositions(0, gridHeight)) {
    const y = oY + g * oStitchMm;
    doc.line(oX, y, oX + oW, y);
  }

  // Box numbers every 10 on both axes (origin labelled "1")
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(90, 90, 100);
  for (const g of labelPositions(0, gridWidth)) {
    const x = oX + g * oStitchMm;
    doc.text(String(g === 0 ? 1 : g), x, oY - 1.6, { align: 'center' });
  }
  for (const g of labelPositions(0, gridHeight)) {
    const y = oY + g * oStitchMm;
    doc.text(String(g === 0 ? 1 : g), oX - 1.6, y, { align: 'right', baseline: 'middle' });
  }

  // Overview border
  doc.setDrawColor(30, 30, 40);
  doc.setLineWidth(0.3);
  doc.rect(oX, oY, oW, oH);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(130, 130, 130);
  doc.text(
    'Boxes mark 10-stitch blocks — use the numbers along the top and left edge to find any area.',
    pageW / 2,
    pageH - 12,
    { align: 'center' },
  );

  /* ── Chart pages ───────────────────────────────────────────────── */
  const tiles = computeChartTiles(gridWidth, gridHeight);
  const tileCount = tiles.cols * tiles.rows;
  let chartIndex = 0;

  // Reserve a slim left gutter for the row numbers.
  const chartLeftGutter = 7;
  const chartMaxW = CONTENT_W - chartLeftGutter;

  for (let ty = 0; ty < tiles.rows; ty++) {
    for (let tx = 0; tx < tiles.cols; tx++) {
      chartIndex += 1;
      doc.addPage();

      // Tile header
      const rowStart = ty * TILE_STITCHES + 1;
      const rowEnd = Math.min(ty * TILE_STITCHES + TILE_STITCHES, gridHeight);
      const colStart = tx * TILE_STITCHES + 1;
      const colEnd = Math.min(tx * TILE_STITCHES + TILE_STITCHES, gridWidth);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(ROSE[0], ROSE[1], ROSE[2]);
      doc.text(`Chart — Tile ${chartIndex} of ${tileCount}`, MARGIN, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Rows ${rowStart}–${rowEnd} · Columns ${colStart}–${colEnd} · each square = 1 stitch`,
        MARGIN,
        22,
      );

      // Full-resolution stitches + per-color symbols (gridlines + numbers drawn as vectors)
      const c0 = tx * TILE_STITCHES;
      const r0 = ty * TILE_STITCHES;
      const c1 = Math.min(c0 + TILE_STITCHES, gridWidth);
      const r1 = Math.min(r0 + TILE_STITCHES, gridHeight);
      const cellsW = c1 - c0;
      const cellsH = r1 - r0;
      const tileDataUrl = renderStitchesToCanvas(
        grid, gridWidth, gridHeight, cellFractions, CHART_PX_PER_STITCH,
        { c0, r0, c1, r1 }, symbols,
      );

      const imgWpx = cellsW * CHART_PX_PER_STITCH;
      const imgHpx = cellsH * CHART_PX_PER_STITCH;
      const { w, h } = fitImageMm(imgWpx, imgHpx, chartMaxW, pageH - 48);
      const imgX = (pageW - w) / 2 + chartLeftGutter / 2;
      const imgY = 29;
      doc.addImage(tileDataUrl, 'PNG', imgX, imgY, w, h);

      // ── Vector gridlines every 10 stitches ──
      const stitchMm = w / cellsW;
      doc.setDrawColor(160, 160, 170);
      doc.setLineWidth(0.15);
      for (const g of labelPositions(c0, c1)) {
        const x = imgX + (g - c0) * stitchMm;
        doc.line(x, imgY, x, imgY + h);
      }
      for (const g of labelPositions(r0, r1)) {
        const y = imgY + (g - r0) * stitchMm;
        doc.line(imgX, y, imgX + w, y);
      }

      // ── Row/column numbers (global coordinates) ──
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(90, 90, 100);
      for (const g of labelPositions(c0, c1)) {
        if (g > 0 || c0 === 0) {
          const x = imgX + (g - c0) * stitchMm;
          doc.text(String(g === 0 ? 1 : g), x, imgY - 1.6, { align: 'center' });
        }
      }
      for (const g of labelPositions(r0, r1)) {
        if (g > 0 || r0 === 0) {
          const y = imgY + (g - r0) * stitchMm;
          doc.text(String(g === 0 ? 1 : g), imgX - 1.6, y, { align: 'right', baseline: 'middle' });
        }
      }

      // ── Tile border ──
      doc.setDrawColor(30, 30, 40);
      doc.setLineWidth(0.3);
      doc.rect(imgX, imgY, w, h);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 130);
      doc.text(
        'Gridlines every 10 stitches — numbers on the edges mark every 10th row/column (and the start).',
        pageW / 2,
        pageH - 12,
        { align: 'center' },
      );
    }
  }

  /* ── Instructions page ─────────────────────────────────────────── */
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(ROSE[0], ROSE[1], ROSE[2]);
  doc.text('How to Read & Stitch This Pattern', MARGIN, 20);

  const instructions: [string, string][] = [
    [
      'Reading the chart',
      'Each square is one cross stitch; its color and chart symbol match an entry on the Materials & Color Key page. Gridlines mark every 10 stitches with row/column numbers so you can find your place, and the Full Design Overview shows the whole pattern with 10-stitch boxes. Large designs are split into tiles — each tile page shows its row/column range.',
    ],
    [
      'Cross-stitch basics',
      'Use 2 strands of floss on the count listed, stitched over 2 threads of the fabric. Work full crosses (a \u00d7 over one square). Cells showing a diagonal triangle are partial stitches — half or quarter crosses — follow the direction shown. Keep tension even.',
    ],
    [
      'Backstitch & outlines',
      'If your pattern includes backstitched outlines, stitch them last with 1 strand of a darker color so the design reads cleanly. Dashed lines on the chart indicate backstitch placement.',
    ],
    [
      'Centering on fabric',
      'Find the middle of the chart (the center stitch) and the middle of your fabric, then start there and work outward. Leave at least 5 cm (2″) of fabric on every side for framing or finishing.',
    ],
    [
      'Finishing',
      'When stitching is complete, gently wash with mild soap, rinse, and roll in a towel. Press face down on a padded surface, then frame, hoop, or finish as desired. Block the piece if it has distorted.',
    ],
  ];

  let iy = 30;
  for (const [title, body] of instructions) {
    if (iy > pageH - 30) {
      doc.addPage();
      iy = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(60, 60, 60);
    doc.text(title, MARGIN, iy);
    iy += 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const wrapped = doc.splitTextToSize(body, CONTENT_W);
    doc.text(wrapped, MARGIN, iy + 4);
    iy += wrapped.length * 4.6 + 7;
  }

  /* ── Footers ───────────────────────────────────────────────────── */
  const dateStr = new Date().toLocaleDateString();
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated by StitchWise Studio on ${dateStr}`,
      MARGIN,
      pageH - 8,
    );
    doc.text(`Page ${p} of ${pageCount}`, pageW - MARGIN, pageH - 8, { align: 'right' });
  }

  return doc;
}

/**
 * Export a stitch pattern to PDF as a complete multi-page pattern sheet:
 * summary → materials/color key (with chart symbols) → full-design overview
 * (numbered every 10) → full-resolution chart (tiled, symbols per stitch) →
 * instructions. All client-side — no server needed.
 */
export async function exportPatternToPdf(options: PdfExportOptions): Promise<void> {
  const { patternName, grid } = options;

  // Guard: empty grid
  const hasStitches = Object.values(grid).some(Boolean);
  if (!hasStitches) {
    alert('Cannot export empty pattern. Add some stitches first.');
    return;
  }

  const doc = buildPatternPdf(options);

  // ── Save ──
  const filename = (patternName || 'pattern').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
  doc.save(filename);
}
