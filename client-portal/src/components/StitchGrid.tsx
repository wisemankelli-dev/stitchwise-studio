import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Grid3X3, Minimize } from 'lucide-react';

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
  activeTool?: 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet' | 'rectangle' | 'circle' | 'line' | 'fill' | 'pan' | 'shape';
  isMouseDown?: boolean;
  onCellHover?: (row: number, col: number) => void;
  cloneSource?: { row: number; col: number } | null;
  cloneSelectionEnd?: { row: number; col: number } | null;
  mirrorAxis?: 'horizontal' | 'vertical' | 'both' | null;
  /** Called when user changes zoom via built-in zoom controls */
  onZoomChange?: (zoom: number) => void;
  /** Fullscreen mode flag */
  isFullscreen?: boolean;
  /** Called when user toggles fullscreen */
  onToggleFullscreen?: () => void;
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
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (col < 0 || col >= width || row < 0 || row >= height) return null;
  return { row, col };
}

// ── Component ────────────────────────────────────────────────────────────────

const StitchGrid: React.FC<StitchGridProps> = ({
  data,
  zoom,
  onCellClick,
  activeTool,
  isMouseDown,
  onCellHover,
  cloneSource,
  cloneSelectionEnd,
  mirrorAxis,
  onZoomChange,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [showGridLines, setShowGridLines] = useState(true);
  const lastHoveredCell = useRef<{ row: number; col: number } | null>(null);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;

  // ── Draw the grid on canvas ──────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cellSize = BASE_CELL_SIZE * zoom;
    const cw = data.width * cellSize;
    const ch = data.height * cellSize;

    // Set canvas buffer size (high-DPI)
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    // Set CSS display size
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    // Background
    ctx.fillStyle = '#fdf2f8';
    ctx.fillRect(0, 0, cw, ch);

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

    // ── Draw cells ──
    for (let r = 0; r < data.height; r++) {
      for (let c = 0; c < data.width; c++) {
        const cell = data.grid[r]?.[c];
        const color = cell?.color;
        const x = c * cellSize;
        const y = r * cellSize;

        // Fill cell
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, cellSize, cellSize);

          // Subtle cell border for contrast
          ctx.strokeStyle = 'rgba(0,0,0,0.06)';
          ctx.lineWidth = 0.3;
          ctx.strokeRect(x + 0.15, y + 0.15, cellSize - 0.3, cellSize - 0.3);

          // Satin stitch highlight effect
          if (cell.stitchType === 'satin') {
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

    // ── Stitch type symbols ──
    if (cellSize >= 8) {
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          const cell = data.grid[r]?.[c];
          if (cell?.color && cell.stitchType && cell.stitchType !== 'cross') {
            const cx = c * cellSize + cellSize / 2;
            const cy = r * cellSize + cellSize / 2;
            drawStitchSymbol(ctx, cell.stitchType, cx, cy, cellSize);
          }
          // Always draw cross symbol for cross-stitch type on filled cells
          if (cell?.color && cell.stitchType === 'cross') {
            const cx = c * cellSize + cellSize / 2;
            const cy = r * cellSize + cellSize / 2;
            drawCross(ctx, cx, cy, cellSize);
          }
        }
      }
    }

    // ── DMC palette symbols ──
    if (showGridLines && cellSize >= 8 && colorSymbolMap.size > 0) {
      const fontSize = Math.max(6, Math.round(cellSize * 0.7));
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < data.height; r++) {
        for (let c = 0; c < data.width; c++) {
          const cell = data.grid[r]?.[c];
          if (!cell?.color) continue;
          const symbol = colorSymbolMap.get(cell.color.toLowerCase());
          if (!symbol) continue;
          const cx = c * cellSize + cellSize / 2;
          const cy = r * cellSize + cellSize / 2;
          ctx.fillStyle = isLightColor(cell.color) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
          ctx.fillText(symbol, cx, cy + 1); // +1 for vertical optical centering
        }
      }
    }
  }, [data, zoom, activeTool, cloneSource, cloneSelectionEnd, mirrorAxis, showGridLines]);

  // ── Redraw on changes ──

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

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
      if (pos) onCellClick?.(pos.row, pos.col);
    },
    [getGridPos, onCellClick],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getGridPos(e);
      if (!pos || !isMouseDown) return;
      // Only fire hover if we moved to a different cell
      const last = lastHoveredCell.current;
      if (!last || last.row !== pos.row || last.col !== pos.col) {
        lastHoveredCell.current = pos;
        onCellHover?.(pos.row, pos.col);
      }
    },
    [getGridPos, isMouseDown, onCellHover],
  );

  const handleCanvasMouseLeave = useCallback(() => {
    lastHoveredCell.current = null;
  }, []);

  // ── Cursor style ──

  const getCursorStyle = () => {
    switch (activeTool) {
      case 'erase': return 'crosshair';
      case 'paint': return 'pointer';
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
