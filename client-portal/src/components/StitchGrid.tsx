import React from 'react';

export interface StitchCell {
  row: number;
  col: number;
  color: string;     // hex color for the stitch
  dmcCode?: string;  // DMC thread code (e.g., '310', '321')
  stitchType?: 'cross' | 'satin' | 'back' | 'french';
}

export interface StitchGridData {
  grid: StitchCell[][];        // 2D array: grid[row][col]
  width: number;               // number of columns
  height: number;              // number of rows
  dmcPalette: { code: string; name: string; hex: string; count: number }[];
  totalStitches: number;
}

interface StitchGridProps {
  data: StitchGridData;
  zoom: number;
  onCellClick?: (row: number, col: number) => void;
  selectedColor?: string;
  /** Active tool for interaction */
  activeTool?: 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet';
  /** Whether mouse is currently held down (for paint/erase drag) */
  isMouseDown?: boolean;
  /** Fires on cell hover while dragging */
  onCellHover?: (row: number, col: number) => void;
  /** Clone source region — cells within this region are highlighted */
  cloneSource?: { row: number; col: number };
  /** Clone selection corner — the second corner of the selection rectangle */
  cloneSelectionEnd?: { row: number; col: number } | null;
  /** Mirror axis display mode */
  mirrorAxis?: 'horizontal' | 'vertical' | 'both' | null;
}

/** DMC Color Legend - shows thread colors used with counts */
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

/** StitchGrid renders a 2D array of colored cells representing stitches */
const StitchGrid: React.FC<StitchGridProps> = ({ data, zoom, onCellClick, activeTool, isMouseDown, onCellHover, cloneSource, cloneSelectionEnd, mirrorAxis }) => {
  const cellSize = Math.max(12, Math.round(28 * zoom));

  const getToolCursor = () => {
    switch (activeTool) {
      case 'erase': return 'cursor-cell';
      case 'paint': return 'cursor-pointer';
      case 'eyedropper': return 'cursor-crosshair';
      case 'clone': return 'cursor-copy';
      case 'mirror': return 'cursor-default';
      default: return 'cursor-pointer';
    }
  };

  /** Check if a cell is within the clone selection rectangle */
  const isInCloneSelection = (row: number, col: number): boolean => {
    if (!cloneSource) return false;
    const end = cloneSelectionEnd || cloneSource;
    const rMin = Math.min(cloneSource.row, end.row);
    const rMax = Math.max(cloneSource.row, end.row);
    const cMin = Math.min(cloneSource.col, end.col);
    const cMax = Math.max(cloneSource.col, end.col);
    return row >= rMin && row <= rMax && col >= cMin && col <= cMax;
  };

  /** Check if a cell is on the mirror axis */
  const isOnMirrorAxis = (row: number, col: number): boolean => {
    if (!mirrorAxis) return false;
    const cx = Math.floor(data.width / 2);
    const cy = Math.floor(data.height / 2);
    if (mirrorAxis === 'vertical') return col === cx;
    if (mirrorAxis === 'horizontal') return row === cy;
    if (mirrorAxis === 'both') return col === cx || row === cy;
    return false;
  };

  return (
    <div className="overflow-auto rounded-xl border border-blush-100 shadow-inner bg-white p-3">
      <div
        className="grid gap-[0.5px] bg-blush-100/10 rounded-lg overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${data.width}, ${cellSize}px)`,
          width: data.width * (cellSize + 0.5) + 1,
        }}
      >
        {Array.from({ length: data.height }).flatMap((_, row) =>
          Array.from({ length: data.width }).map((_, col) => {
            const cell = data.grid[row]?.[col];
            const color = cell?.color;
            const stitchType = cell?.stitchType;
            const isFilled = !!color;
            const inSelection = isInCloneSelection(row, col);
            const onMirrorLine = isOnMirrorAxis(row, col);

            return (
              <button
                key={`${row}-${col}`}
                onClick={() => onCellClick?.(row, col)}
                onMouseEnter={() => {
                  if (isMouseDown && (activeTool === 'paint' || activeTool === 'erase')) {
                    onCellHover?.(row, col);
                  }
                }}
                className={`flex items-center justify-center transition-all duration-75 hover:scale-110 active:scale-95 focus:outline-none ${getToolCursor()} ${inSelection ? 'ring-2 ring-blush-400 ring-offset-1 scale-105 z-10' : ''} ${onMirrorLine ? 'ring-1 ring-blush-300/50' : ''}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: color || '#fdf2f8',
                  border: inSelection
                    ? '2px solid #f472b6'
                    : isFilled
                    ? '1px solid rgba(0,0,0,0.06)'
                    : '1px solid #fce7f3',
                  backgroundImage: isFilled && stitchType === 'satin'
                    ? `linear-gradient(45deg, ${color} 25%, rgba(255,255,255,0.2) 50%, ${color} 75%)`
                    : undefined,
                  boxShadow: isFilled && stitchType === 'satin'
                    ? '0 0 3px rgba(255,255,255,0.3) inset'
                    : inSelection
                    ? '0 0 6px rgba(244,114,182,0.4)'
                    : undefined,
                }}
                title={`(${row},${col})${isFilled ? ` ${cell.dmcCode || ''}${inSelection ? ' [selected]' : ''}` : ''}`}
              >
                {isFilled ? (
                  stitchType === 'satin' ? (
                    <span className="font-extrabold text-white/80 select-none text-[8px]">|||</span>
                  ) : stitchType === 'back' ? (
                    <span className="font-extrabold text-white/70 select-none text-[8px]">─</span>
                  ) : (
                    <span className="font-bold text-white/50 select-none text-[8px]">X</span>
                  )
                ) : (
                  <span className="block rounded-full bg-blush-200/40" style={{ width: 2, height: 2 }} />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default StitchGrid;
