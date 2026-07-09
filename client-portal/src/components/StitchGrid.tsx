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
const StitchGrid: React.FC<StitchGridProps> = ({ data, zoom, onCellClick, selectedColor, activeTool, isMouseDown, onCellHover }) => {
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

  return (
    <div className="overflow-auto rounded-xl border border-blush-100 shadow-inner bg-amber-50/10 p-3">
      <div
        className="grid gap-[1px] bg-blush-100/30 rounded-lg overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(${data.width}, ${cellSize}px)`,
          width: data.width * (cellSize + 1) + 2,
        }}
      >
        {Array.from({ length: data.height }).flatMap((_, row) =>
          Array.from({ length: data.width }).map((_, col) => {
            const cell = data.grid[row]?.[col];
            const color = cell?.color;
            const stitchType = cell?.stitchType;
            const isFilled = !!color;

            return (
              <button
                key={`${row}-${col}`}
                onClick={() => onCellClick?.(row, col)}
                onMouseEnter={() => {
                  if (isMouseDown && (activeTool === 'paint' || activeTool === 'erase')) {
                    onCellHover?.(row, col);
                  }
                }}
                className={`flex items-center justify-center transition-all duration-75 hover:scale-110 active:scale-95 focus:outline-none ${getToolCursor()}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: color || '#fafaf9',
                  border: isFilled
                    ? '1px solid rgba(0,0,0,0.08)'
                    : '1px solid #fce7f3',
                  backgroundImage: isFilled && stitchType === 'satin'
                    ? `linear-gradient(45deg, ${color} 25%, rgba(255,255,255,0.2) 50%, ${color} 75%)`
                    : undefined,
                  boxShadow: isFilled && stitchType === 'satin'
                    ? '0 0 3px rgba(255,255,255,0.3) inset'
                    : undefined,
                }}
                title={`(${row},${col})${isFilled ? ` ${cell.dmcCode || ''}` : ''}`}
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
