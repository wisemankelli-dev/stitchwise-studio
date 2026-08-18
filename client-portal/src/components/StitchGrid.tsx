import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Grid3X3, Minimize } from 'lucide-react';
import {
  STOCKING_GUIDE,
  STOCKING_GUIDE_ASPECT,
  fitStockingInBox,
  type ProductGuide,
} from '../data/guides';

export interface StitchCell {
  row: number;
  col: number;
  color: string;
  dmcCode?: string;
  stitchType?: 'cross' | 'satin' | 'back' | 'french';
}

export interface StitchGridData {
  grid: StitchCell[][];
  width: number;
  height: number;
  dmcPalette: { code: string; name: string; hex: string; count: number; symbol?: string }[];
  totalStitches: number;
}

export interface StitchGridProps {
  data: StitchGridData;
  zoom: number;
  onCellClick?: (row: number, col: number) => void;
  selectedColor?: string;
  /** Selected stitch type for instant brush painting */
  selectedStitch?: string;
  activeTool?: 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet' | 'rectangle' | 'circle' | 'line' | 'fill' | 'pan' | 'shape' | 'half';
  isMouseDown?: boolean;
  onCellHover?: (row: number, col: number) => void;
  /** Called on mousedown for immediate brush response (paint/erase) */
  onCellPress?: (row: number, col: number) => void;
  cloneSource?: { row: number; col: number } | null;
  cloneSelectionEnd?: { row: number; col: number } | null;
  mirrorAxis?: 'horizontal' | 'vertical' | 'both' | null;
  /** Called when user changes zoom via built-in zoom controls */
  onZoomChange?: (zoom: number) => void;
  /** Fullscreen mode flag */
  isFullscreen?: boolean;
  /** Called when user toggles fullscreen */
  onToggleFullscreen?: () => void;
  /** Fractional cell fills for anti-aliased shapes */
  cellFractions?: Record<string, number>;
  /** Live shape preview origin/end (rect/circle/line drag) */
  shapeStart?: { row: number; col: number } | null;
  shapeEnd?: { row: number; col: number } | null;
  /** Reference image URL to show as a faded overlay behind the grid */
  referenceImage?: string | null;
  /** Whether the reference image overlay is visible */
  showReference?: boolean;
  /** Opacity of the reference image overlay (0.0 - 1.0, default: 0.20) */
  referenceOpacity?: number;
  /**
   * Product-shape guide (Ornament circle, Pillow rounded rect, Frame rect,
   * Stocking silhouette) drawn as a dashed, non-interactive outline on top of
   * the canvas. colW/rowH are in STITCH units. null/undefined draws nothing.
   */
  guide?: ProductGuide | null;
}

/** DMC Color Legend — unchanged from previous version */
export const DmcLegend: React.FC<{ palette: StitchGridData['dmcPalette'] }> = ({ palette }) => (
  <div className="space-y-1.5">
    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">DMC Thread Palette</h4>
    <div className="flex flex-wrap gap-1.5">
      {palette.map((c) => (
        <div key={c.code} className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 border border-blush-100 shadow-sm">
          <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: c.hex }} />
          <span className="text-[10px] font-mono font-bold text-slate-600">{c.code}</span>
          <span className="text-[9px] text-slate-400">{c.name}</span>
          <span className="text-[9px] text-blush-500 font-bold ml-0.5">×{c.count}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Drawing helpers ──────────────────────────────────────────────────────────

const BASE_CELL_SIZE = 12; // pixels per cell at zoom=1 (before devicePixelRatio)

/** Determine if a hex color is "light" (luminance > 0.5) */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Relative luminance formula
  return (0.299 * r + 0.587 * g + 0.114 * b) > 0.5;
}

/** Draw a cross-stitch 'X' symbol centered at (cx, cy) */
function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size * 0.35;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(0.8, size * 0.1);
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.stroke();
}

/** Draw satin stitch lines (3 vertical-ish lines) */
function drawSatin(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size * 0.3;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(0.8, size * 0.08);
  for (let i = -1; i <= 1; i++) {
    const x = cx + i * (size * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, cy - s);
    ctx.lineTo(x, cy + s);
    ctx.stroke();
  }
}

/** Draw a back-stitch dot */
function drawBackStitch(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw a french knot (small circle with dot) */
function drawFrenchKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(0.8, size * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw a stitch type symbol at cell center */
function drawStitchSymbol(
  ctx: CanvasRenderingContext2D,
  stitchType: string,
  cx: number,
  cy: number,
  cellSize: number,
) {
  switch (stitchType) {
    case 'cross': drawCross(ctx, cx, cy, cellSize); break;
    case 'satin': drawSatin(ctx, cx, cy, cellSize); break;
    case 'back': drawBackStitch(ctx, cx, cy, cellSize); break;
    case 'french': drawFrenchKnot(ctx, cx, cy, cellSize); break;
  }
}

// ── Symbol sprite cache ───────────────────────────────────────────────────────
// Redrawing every filled cell's stitch glyph + DMC symbol each frame with vector
// paths/fillText is the dominant cost of a redraw on large grids (owner report
// 08-17: tools feel "sloppy and delayed"). Pre-render each (symbol, size, color)
// once onto a tiny offscreen canvas, then blit with drawImage — 20-50× cheaper
// per cell than per-cell path/text rendering.
const spriteCache = new Map<string, HTMLCanvasElement>();
const SPRITE_MAX = 400;

function stitchSprite(stitchType: string, cellSize: number): HTMLCanvasElement | null {
  const key = `st:${stitchType}:${Math.round(cellSize * 10)}`;
  let spr = spriteCache.get(key);
  if (spr) return spr;
  if (spriteCache.size > SPRITE_MAX) spriteCache.clear();
  const B = Math.ceil(cellSize) + 2;
  spr = document.createElement('canvas');
  spr.width = B;
  spr.height = B;
  const g = spr.getContext('2d');
  if (!g) return null;
  drawStitchSymbol(g, stitchType, B / 2, B / 2, cellSize);
  spriteCache.set(key, spr);
  return spr;
}

function dmcSprite(symbol: string, color: string, cellSize: number): HTMLCanvasElement | null {
  const fontSize = Math.max(6, Math.round(cellSize * 0.7));
  const fg = isLightColor(color) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
  const key = `dmc:${symbol}:${fg}:${fontSize}`;
  let spr = spriteCache.get(key);
  if (spr) return spr;
  if (spriteCache.size > SPRITE_MAX) spriteCache.clear();
  const B = Math.ceil(cellSize) + 2;
  spr = document.createElement('canvas');
  spr.width = B;
  spr.height = B;
  const g = spr.getContext('2d');
  if (!g) return null;
  g.font = `${fontSize}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(symbol, B / 2, B / 2 + 1); // +1 optical centering (matches original)
  spriteCache.set(key, spr);
  return spr;
}

/** Browser canvas area cap — above this the backing store shrinks so drawing
 *  never silently blanks (owner report 08-17). Shared by draw() and the
 *  instant-brush path so both use the same transform. */
const MAX_BUFFER_AREA = 250_000_000;

/**
 * Best-guess DMC symbol for a color (matches the palette lookup used in draw()).
 */
function dmcSymbolFor(color: string, palette: StitchGridData['dmcPalette']): string | undefined {
  for (const entry of palette) {
    if (entry.symbol && entry.hex && entry.hex.toLowerCase() === color.toLowerCase()) {
      return entry.symbol;
    }
  }
  return undefined;
}

/** Fill + border + satin highlight for ONE cell (CSS coords). Shared by the full
 *  redraw, the hover-cell restore, and instant brush feedback so all three
 *  render identically. */
function drawCellAt(
  ctx: CanvasRenderingContext2D,
  cell: StitchCell | undefined,
  x: number,
  y: number,
  cellSize: number,
) {
  const color = cell?.color;
  if (color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cellSize, cellSize);
    // Subtle cell border for contrast
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x + 0.15, y + 0.15, cellSize - 0.3, cellSize - 0.3);
    // Satin stitch highlight effect
    if (cell?.stitchType === 'satin') {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + i * (cellSize / 4) + 1, y + 1, cellSize / 8, cellSize - 2);
      }
    }
  } else {
    // Empty cell
    ctx.fillStyle = '#fdf2f8';
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.strokeStyle = '#fce7f3';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x + 0.15, y + 0.15, cellSize - 0.3, cellSize - 0.3);
  }
}

/** Single-cell diagonal half-fill — identical math to the main redraw loop. */
function drawHalfFraction(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  color: string,
  fraction: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, cellSize, cellSize);
  ctx.clip();
  // Draw diagonal half-fill: color on bottom-left triangle, background on top-right
  if (fraction <= 0.25) {
    // Small corner fill
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + cellSize);
    ctx.lineTo(x, y + cellSize * 0.5);
    ctx.lineTo(x + cellSize * 0.5, y + cellSize);
    ctx.fill();
  } else if (fraction <= 0.5) {
    // Half fill: bottom-left triangle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + cellSize);
    ctx.lineTo(x + cellSize, y + cellSize);
    ctx.fill();
    ctx.fillStyle = '#fdf2f8';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cellSize, y + cellSize);
    ctx.lineTo(x + cellSize, y);
    ctx.fill();
  } else if (fraction <= 0.75) {
    // Three-quarters: color on 3/4, background on top-right corner
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.fillStyle = '#fdf2f8';
    ctx.beginPath();
    ctx.moveTo(x + cellSize, y);
    ctx.lineTo(x + cellSize * 0.5, y);
    ctx.lineTo(x + cellSize, y + cellSize * 0.5);
    ctx.fill();
  }
  ctx.restore();
}

/** Hovered-cell selection highlight (topmost layer). */
function drawHoverHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number) {
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
  ctx.fillStyle = 'rgba(244,114,182,0.14)';
  ctx.fillRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
}

/** Restore the thin/bold grid-line segments that cross a single cell's rect
 *  (top + left edges — the ones cleared when the cell area is repainted). */
function restoreCellGridLines(ctx: CanvasRenderingContext2D, r: number, c: number, cellSize: number) {
  const x0 = c * cellSize;
  const y0 = r * cellSize;
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath();
  if (r > 0 && r % 10 !== 0) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + cellSize, y0);
  }
  if (c > 0 && c % 10 !== 0) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y0 + cellSize);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (r > 0 && r % 10 === 0) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + cellSize, y0);
  }
  if (c > 0 && c % 10 === 0) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y0 + cellSize);
  }
  ctx.stroke();
}

/** Trace a rounded-rectangle path (pillow look) onto the current path. */
function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Draw the product-shape guide as the LAST layer — dashed blush/rose outline,
 * purely visual (no pointer interaction). colW/rowH are in stitch units.
 */
function drawGuide(
  ctx: CanvasRenderingContext2D,
  guide: ProductGuide,
  cw: number,
  ch: number,
  cellSize: number,
) {
  // Clamp the guide to the canvas it is drawn on: a product guide must never
  // render larger than the canvas (owner 08-18: generated art was spilling
  // outside the ornament circle when the guide and canvas sizes had desynced —
  // e.g. after a fabric-count change or a resize that was declined). The mask
  // in maskGridToGuide (Designer.tsx) applies the same clamp, so the drawn
  // guide and the mask are always the same canvas-tangent shape.
  const gw = Math.min(guide.colW, Math.max(1, cw / cellSize)) * cellSize;
  const gh = Math.min(guide.rowH, Math.max(1, ch / cellSize)) * cellSize;
  const gx = (cw - gw) / 2;
  const gy = (ch - gh) / 2;

  ctx.save();
  ctx.strokeStyle = 'rgba(190,18,60,0.6)'; // blush/rose
  ctx.lineWidth = Math.max(1.5, Math.min(3.5, cellSize * 0.18));
  ctx.beginPath();

  switch (guide.type) {
    case 'circle': {
      ctx.setLineDash([cellSize * 0.5, cellSize * 0.35]);
      const radius = (Math.min(guide.colW, guide.rowH) / 2) * cellSize;
      ctx.arc(cw / 2, ch / 2, radius, 0, Math.PI * 2);
      break;
    }
    case 'rect':
      ctx.setLineDash([cellSize * 0.5, cellSize * 0.35]);
      ctx.rect(gx, gy, gw, gh);
      break;
    case 'roundedRect': {
      ctx.setLineDash([cellSize * 0.5, cellSize * 0.35]);
      const radius = 0.15 * Math.min(guide.colW, guide.rowH) * cellSize;
      traceRoundedRect(ctx, gx, gy, gw, gh, radius);
      break;
    }
    case 'stocking': {
      // Solid outline (no dashes): a dashed stroke breaks apart on the stocking's
      // tight toe curve and reads as an incomplete template (owner report 08-17).
      ctx.setLineDash([]);
      const fit = fitStockingInBox(guide.colW, guide.rowH);
      const pts = STOCKING_GUIDE.map(([px, py]) => ({
        x: gx + (px * STOCKING_GUIDE_ASPECT * fit.scale + fit.dx) * cellSize,
        y: gy + (py * fit.scale + fit.dy) * cellSize,
      }));
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      break;
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/** Convert a mouse event to { row, col } relative to the grid canvas */
export function mouseToGrid(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  cellSize: number,
  width: number,
  height: number,
): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect();
  // Use CSS coordinates directly — cellSize is in CSS pixels (BASE_CELL_SIZE * zoom),
  // not canvas buffer pixels (which are scaled by devicePixelRatio).
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (col < 0 || col >= width || row < 0 || row >= height) return null;
  return { row, col };
}

// ── Component ────────────────────────────────────────────────────────────────


/**
 * All cells on the straight line from `a` to `b` (inclusive of `b`, exclusive of `a`).
 * Used to fill the gaps between sparse mousemove samples during a drag, so fast
 * strokes paint a contiguous line instead of scattered dots (owner report 08-17:
 * "paint is scattered"). If `a` is null (first sample of a drag), returns [b].
 */
export function cellsBetween(
  a: { row: number; col: number } | null,
  b: { row: number; col: number },
): { row: number; col: number }[] {
  if (!a) return [b];
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  if (steps === 0) return [b];
  const out: { row: number; col: number }[] = [];
  for (let i = 1; i <= steps; i++) {
    out.push({
      row: Math.round(a.row + (dr * i) / steps),
      col: Math.round(a.col + (dc * i) / steps),
    });
  }
  return out;
}
const StitchGrid: React.FC<StitchGridProps> = ({
  data,
  zoom,
  onCellClick,
  activeTool,
  selectedColor,
  selectedStitch,
  isMouseDown,
  onCellHover,
  onCellPress,
  cloneSource,
  cloneSelectionEnd,
  mirrorAxis,
  onZoomChange,
  isFullscreen,
  onToggleFullscreen,
  cellFractions,
  shapeStart,
  shapeEnd,
  referenceImage,
  showReference = false,
  referenceOpacity = 0.20,
  guide = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [showGridLines, setShowGridLines] = useState(true);
  const lastHoveredCell = useRef<{ row: number; col: number } | null>(null);
  const hoveredCell = useRef<{ row: number; col: number } | null>(null);
  const referenceImgRef = useRef<HTMLImageElement | null>(null);

  // Load reference image into a reusable Image element
  useEffect(() => {
    if (!referenceImage) {
      referenceImgRef.current = null;
      return;
    }
    const img = new window.Image();
    img.onload = () => { referenceImgRef.current = img; };
    img.src = referenceImage;
    return () => { referenceImgRef.current = null; };
  }, [referenceImage]);

  const MIN_ZOOM = 0.15;
  const MAX_ZOOM = 4;

  // ── Draw the grid on canvas ──────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cellSize = BASE_CELL_SIZE * zoom;
    const cw = data.width * cellSize;
    const ch = data.height * cellSize;

    // Set canvas buffer size (high-DPI), capped so extreme zoom × devicePixelRatio
    // can't exceed browser canvas limits and silently blank (owner report 08-17:
    // tools "sloppy and delayed" — large grids at high zoom on a 2× display
    // exceeded Chrome's ~268MP area cap and rendered nothing).
    const rawArea = cw * dpr * ch * dpr;
    const bufferScale = rawArea > MAX_BUFFER_AREA ? Math.sqrt(MAX_BUFFER_AREA / rawArea) : 1;
    const bw = Math.max(1, Math.round(cw * dpr * bufferScale));
    const bh = Math.max(1, Math.round(ch * dpr * bufferScale));
    // Only reallocate when the buffer size actually changes (reallocating on every
    // draw clears the canvas and reallocates GPU memory on each paint event).
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    // Set CSS display size
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr * bufferScale, 0, 0, dpr * bufferScale, 0, 0);

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#fdf2f8';
    ctx.fillRect(0, 0, cw, ch);

    // ── Reference image overlay (faded behind grid) ──
    if (showReference && referenceImgRef.current) {
      ctx.save();
      ctx.globalAlpha = referenceOpacity;
      ctx.drawImage(referenceImgRef.current, 0, 0, cw, ch);
      ctx.restore();
    }

    // ── Compute clone selection rectangle ──
    let selRMin = -1, selRMax = -1, selCMin = -1, selCMax = -1;
    if (activeTool === 'clone' && cloneSource) {
      const end = cloneSelectionEnd || cloneSource;
      selRMin = Math.min(cloneSource.row, end.row);
      selRMax = Math.max(cloneSource.row, end.row);
      selCMin = Math.min(cloneSource.col, end.col);
      selCMax = Math.max(cloneSource.col, end.col);
    }

    // ── Compute mirror axis position ──
    const midRow = Math.floor(data.height / 2);
    const midCol = Math.floor(data.width / 2);

    // ── Draw cells (shared per-cell renderer — also used for hover restore
    // and instant brush feedback so all three render identically) ──
    for (let r = 0; r < data.height; r++) {
      for (let c = 0; c < data.width; c++) {
        drawCellAt(ctx, data.grid[r]?.[c], c * cellSize, r * cellSize, cellSize);
      }
    }
    // ── Half-fill diagonal rendering ──
    if (cellFractions && cellSize >= 8) {
      for (const [key, fraction] of Object.entries(cellFractions)) {
        const [r, c] = key.split(',').map(Number);
        const cell = data.grid[r]?.[c];
        if (!cell?.color) continue;
        drawHalfFraction(ctx, c * cellSize, r * cellSize, cellSize, cell.color, fraction);
      }
    }

    // ── Build color → symbol lookup from palette ──
    const colorSymbolMap = new Map<string, string>();
    if (showGridLines && cellSize >= 8) {
      for (const entry of data.dmcPalette) {
        if (entry.symbol && entry.hex) {
          colorSymbolMap.set(entry.hex.toLowerCase(), entry.symbol);
        }
      }
    }

    // ── Grid lines (on top of cells) ──
    if (showGridLines && cellSize >= 3) {
      // Standard grid lines: every cell
      ctx.strokeStyle = 'rgba(0,0,0,0.10)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let r = 1; r < data.height; r++) {
        if (r % 10 === 0) continue; // skip bold lines
        const y = r * cellSize;
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
      }
      for (let c = 1; c < data.width; c++) {
        if (c % 10 === 0) continue;
        const x = c * cellSize;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
      }
      ctx.stroke();

      // Bold 10×10 grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let r = 10; r < data.height; r += 10) {
        const y = r * cellSize;
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
      }
      for (let c = 10; c < data.width; c += 10) {
        const x = c * cellSize;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
      }
      ctx.stroke();
    }

    // ── Shape drag preview (live dashed outline for rect/circle/line) ──
    if (shapeStart && shapeEnd && (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line')) {
      const r1 = Math.min(shapeStart.row, shapeEnd.row);
      const r2 = Math.max(shapeStart.row, shapeEnd.row);
      const c1 = Math.min(shapeStart.col, shapeEnd.col);
      const c2 = Math.max(shapeStart.col, shapeEnd.col);
      ctx.save();
      ctx.strokeStyle = 'rgba(99,102,241,0.95)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (activeTool === 'rectangle') {
        ctx.rect(c1 * cellSize, r1 * cellSize, (c2 - c1 + 1) * cellSize, (r2 - r1 + 1) * cellSize);
      } else if (activeTool === 'circle') {
        const pcx = ((c1 + c2) / 2) * cellSize;
        const pcy = ((r1 + r2) / 2) * cellSize;
        const prx = Math.max(cellSize / 2, ((c2 - c1) / 2) * cellSize);
        const pry = Math.max(cellSize / 2, ((r2 - r1) / 2) * cellSize);
        ctx.ellipse(pcx, pcy, prx, pry, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo((shapeStart.col + 0.5) * cellSize, (shapeStart.row + 0.5) * cellSize);
        ctx.lineTo((shapeEnd.col + 0.5) * cellSize, (shapeEnd.row + 0.5) * cellSize);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ── Clone selection highlight ──
    if (selRMin >= 0) {
      ctx.fillStyle = 'rgba(244,114,182,0.25)';
      ctx.fillRect(
        selCMin * cellSize,
        selRMin * cellSize,
        (selCMax - selCMin + 1) * cellSize,
        (selRMax - selRMin + 1) * cellSize,
      );
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        selCMin * cellSize,
        selRMin * cellSize,
        (selCMax - selCMin + 1) * cellSize,
        (selRMax - selRMin + 1) * cellSize,
      );
      ctx.setLineDash([]);
    }

    // ── Mirror axis indicator ──
    if (mirrorAxis && activeTool === 'mirror') {
      ctx.strokeStyle = 'rgba(244,114,182,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (mirrorAxis === 'horizontal' || mirrorAxis === 'both') {
        const y = midRow * cellSize + cellSize / 2;
        ctx.moveTo(0, y);
        ctx.lineTo(cw, y);
      }
      if (mirrorAxis === 'vertical' || mirrorAxis === 'both') {
        const x = midCol * cellSize + cellSize / 2;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ch);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Stitch type symbols (sprite-cached — per-cell vector drawing is a
    // dominant redraw cost on large grids) ──
    if (cellSize >= 8) {
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          const cell = data.grid[r]?.[c];
          if (!cell?.color) continue;
          const spr = stitchSprite(cell.stitchType || 'cross', cellSize);
          if (!spr) continue;
          ctx.drawImage(
            spr,
            Math.round(c * cellSize + (cellSize - spr.width) / 2),
            Math.round(r * cellSize + (cellSize - spr.height) / 2),
          );
        }
      }
    }

    // ── DMC palette symbols (sprite-cached — per-cell fillText is the single
    // most expensive op in a redraw; blitting cached glyphs is ~20-50× faster) ──
    if (showGridLines && cellSize >= 8 && colorSymbolMap.size > 0) {
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          const cell = data.grid[r]?.[c];
          if (!cell?.color) continue;
          const symbol = colorSymbolMap.get(cell.color.toLowerCase());
          if (!symbol) continue;
          const spr = dmcSprite(symbol, cell.color, cellSize);
          if (!spr) continue;
          ctx.drawImage(
            spr,
            Math.round(c * cellSize + (cellSize - spr.width) / 2),
            Math.round(r * cellSize + (cellSize - spr.height) / 2),
          );
        }
      }
    }

    // ── Product-shape guide (LAST layer — always visible on top) ──
    if (guide) {
      drawGuide(ctx, guide, cw, ch, cellSize);
    }
    // ── Hovered-cell highlight (topmost — instant selection feedback,
    // updated directly from mousemove with no React state) ──
    const hc = hoveredCell.current;
    if (hc && activeTool !== 'pan') {
      drawHoverHighlight(ctx, hc.col * cellSize, hc.row * cellSize, cellSize);
    }
  }, [data, zoom, activeTool, cloneSource, cloneSelectionEnd, mirrorAxis, showGridLines, showReference, referenceOpacity, guide, shapeStart, shapeEnd]);

  // ── Redraw on changes ──

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  // ── Instant brush feedback (direct canvas ops — no React state) ──
  const getCanvasTransform = useCallback(() => {
    const dpr = window.devicePixelRatio || 1;
    const cellSize = BASE_CELL_SIZE * zoom;
    const cw = data.width * cellSize;
    const ch = data.height * cellSize;
    const rawArea = cw * dpr * ch * dpr;
    const bufferScale = rawArea > MAX_BUFFER_AREA ? Math.sqrt(MAX_BUFFER_AREA / rawArea) : 1;
    return { dpr, cellSize, bufferScale };
  }, [zoom, data.width, data.height]);
  /** Paint cells straight into the canvas buffer (paint/erase/half) so the
   *  stroke tracks the cursor instantly; React state + the rAF redraw confirm. */
  const paintCellsDirect = useCallback((cells: { row: number; col: number }[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { dpr, cellSize, bufferScale } = getCanvasTransform();
    ctx.setTransform(dpr * bufferScale, 0, 0, dpr * bufferScale, 0, 0);
    for (const p of cells) {
      const x = p.col * cellSize;
      const y = p.row * cellSize;
      if (activeTool === 'erase') {
        ctx.fillStyle = '#fdf2f8';
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = '#fce7f3';
        ctx.lineWidth = 0.3;
        ctx.strokeRect(x + 0.15, y + 0.15, cellSize - 0.3, cellSize - 0.3);
      } else {
        const color = selectedColor || '#000000';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.3;
        ctx.strokeRect(x + 0.15, y + 0.15, cellSize - 0.3, cellSize - 0.3);
        if (cellSize >= 8) {
          const spr = stitchSprite(selectedStitch || 'cross', cellSize);
          if (spr) {
            ctx.drawImage(spr, Math.round(x + (cellSize - spr.width) / 2), Math.round(y + (cellSize - spr.height) / 2));
          }
        }
        if (activeTool === 'half') {
          drawHalfFraction(ctx, x, y, cellSize, color, 0.5);
        }
      }
    }
  }, [getCanvasTransform, activeTool, selectedColor, selectedStitch]);
  /** Repaint ONE cell from state (used to clear the previous hover highlight
   *  and to repair the grid line segments the highlight covered). */
  const restoreCell = useCallback((r: number, c: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { dpr, cellSize, bufferScale } = getCanvasTransform();
    ctx.setTransform(dpr * bufferScale, 0, 0, dpr * bufferScale, 0, 0);
    const x = c * cellSize;
    const y = r * cellSize;
    const cell = data.grid[r]?.[c];
    drawCellAt(ctx, cell, x, y, cellSize);
    const frac = cellFractions ? cellFractions[`${r},${c}`] : undefined;
    if (frac && cell?.color) drawHalfFraction(ctx, x, y, cellSize, cell.color, frac);
    if (cellSize >= 8 && cell?.color) {
      const spr = stitchSprite(cell.stitchType || 'cross', cellSize);
      if (spr) {
        ctx.drawImage(spr, Math.round(x + (cellSize - spr.width) / 2), Math.round(y + (cellSize - spr.height) / 2));
      }
      if (showGridLines) {
        const symbol = dmcSymbolFor(cell.color, data.dmcPalette);
        if (symbol) {
          const s2 = dmcSprite(symbol, cell.color, cellSize);
          if (s2) {
            ctx.drawImage(s2, Math.round(x + (cellSize - s2.width) / 2), Math.round(y + (cellSize - s2.height) / 2));
          }
        }
      }
    }
    restoreCellGridLines(ctx, r, c, cellSize);
  }, [getCanvasTransform, data, cellFractions, showGridLines]);
  /** Draw the hover highlight for a cell (direct canvas op). */
  const drawHoverHighlightAt = useCallback((r: number, c: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { dpr, cellSize, bufferScale } = getCanvasTransform();
    ctx.setTransform(dpr * bufferScale, 0, 0, dpr * bufferScale, 0, 0);
    drawHoverHighlight(ctx, c * cellSize, r * cellSize, cellSize);
  }, [getCanvasTransform]);
  // ── Mouse event handlers ──
  const getGridPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const cellSize = BASE_CELL_SIZE * zoom;
      return mouseToGrid(e.clientX, e.clientY, canvas, cellSize, data.width, data.height);
    },
    [zoom, data.width, data.height],
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getGridPos(e);
      // End of a click-drag cycle: clear the last hovered cell so the next drag
      // starts fresh instead of connecting a line from the previous stroke.
      lastHoveredCell.current = null;
      if (pos) onCellClick?.(pos.row, pos.col);
    },
    [getGridPos, onCellClick],
  );
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const pos = getGridPos(e);
      if (pos) {
        if (activeTool === 'paint' || activeTool === 'erase' || activeTool === 'half') {
          paintCellsDirect([pos]);
        }
        onCellPress?.(pos.row, pos.col);
      }
    },
    [getGridPos, onCellPress, activeTool, paintCellsDirect],
  );
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getGridPos(e);
      if (!pos) return;
      const isCellTool = activeTool !== 'pan';
      const isShapeDrag = isMouseDown && (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'line');
      // Hover highlight: update directly on the canvas (no React state),
      // so the selection cursor tracks the mouse at full input rate.
      // Skipped during shape drags — the live preview + full redraws cover
      // it, and restoreCell would notch the preview outline.
      const h = hoveredCell.current;
      if (!isShapeDrag && (!h || h.row !== pos.row || h.col !== pos.col)) {
        if (h) restoreCell(h.row, h.col);
        hoveredCell.current = pos;
        if (isCellTool) drawHoverHighlightAt(pos.row, pos.col);
      } else if (isShapeDrag && (!h || h.row !== pos.row || h.col !== pos.col)) {
        hoveredCell.current = pos;
      }
      if (!isMouseDown) return;
      // Drag painting: paint the stroke into the buffer synchronously
      // (before React re-renders) so it never trails the cursor.
      const last = lastHoveredCell.current;
      if (!last || last.row !== pos.row || last.col !== pos.col) {
        lastHoveredCell.current = pos;
        const cells = cellsBetween(last, pos);
        if (activeTool === 'paint' || activeTool === 'erase' || activeTool === 'half') {
          paintCellsDirect(cells);
        }
        for (const p of cells) {
          onCellHover?.(p.row, p.col);
        }
      }
    },
    [getGridPos, isMouseDown, onCellHover, activeTool, restoreCell, drawHoverHighlightAt, paintCellsDirect],
  );

  const handleCanvasMouseLeave = useCallback(() => {
    const h = hoveredCell.current;
    if (h) restoreCell(h.row, h.col);
    hoveredCell.current = null;
    lastHoveredCell.current = null;
  }, [restoreCell]);

  // ── Cursor style ──

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'erase': return 'crosshair';
      case 'paint': return 'crosshair';
      case 'eyedropper': return 'crosshair';
      case 'clone': return 'copy';
      default: return 'pointer';
    }
  };

  // ── Zoom controls ──

  const handleZoomIn = () => onZoomChange?.(Math.min(MAX_ZOOM, zoom + 0.25));
  const handleZoomOut = () => onZoomChange?.(Math.max(MIN_ZOOM, zoom - 0.25));
  const handleFitToScreen = () => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth - 24; // padding offset
    const containerH = containerRef.current.clientHeight - 120; // controls offset
    const fitW = containerW / (data.width * BASE_CELL_SIZE);
    const fitH = containerH / (data.height * BASE_CELL_SIZE);
    const fit = Math.min(fitW, fitH);
    onZoomChange?.(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fit * 100) / 100)));
  };

  const cellSize = BASE_CELL_SIZE * zoom;

  return (
    <div className="overflow-auto rounded-xl border border-blush-100 shadow-inner bg-white p-3">
      {/* Zoom & display controls */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-blush-100 gap-2">
        <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-lg border border-blush-100">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-md hover:bg-white text-slate-500 transition-colors"
            title="Zoom out"
            type="button"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-[10px] font-bold text-slate-600 w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-md hover:bg-white text-slate-500 transition-colors"
            title="Zoom in"
            type="button"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleFitToScreen}
            className="p-1.5 rounded-md hover:bg-white text-slate-500 transition-colors"
            title="Fit to screen"
            type="button"
            aria-label="Fit to screen"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => setShowGridLines((v) => !v)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
            showGridLines
              ? 'bg-blush-50 border-blush-300 text-blush-700'
              : 'bg-white border-blush-100 text-slate-400'
          }`}
          type="button"
          aria-label={showGridLines ? 'Hide grid lines' : 'Show grid lines'}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
          Grid
        </button>
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              isFullscreen
                ? 'bg-blush-500 text-white border-blush-500'
                : 'bg-white border-blush-100 text-slate-400 hover:bg-blush-50'
            }`}
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            {isFullscreen ? 'Exit' : 'Full'}
          </button>
        )}
      </div>

      {/* Canvas container */}
      <div ref={containerRef} className="flex items-center justify-center min-h-[200px]">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          className="rounded-lg"
          style={{ cursor: getCursorStyle() }}
          aria-label={`Stitch grid: ${data.width}×${data.height}, ${data.totalStitches} stitches`}
        />
      </div>

      {/* Stats bar */}
      <div className="mt-3 pt-2 border-t border-blush-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          {data.width}×{data.height} grid · {cellSize.toFixed(1)}px/cell
        </span>
        <span>{data.totalStitches.toLocaleString()} stitches</span>
      </div>
    </div>
  );
};

export default StitchGrid;
