import { useState } from 'react';
import { Shapes, ChevronDown, ChevronRight } from 'lucide-react';
import type { ClipartShape, ShapeCategory } from '../data/shapes';
import { SHAPE_CATEGORIES, getShapesByCategory } from '../data/shapes';

export interface ShapePickerProps {
  selectedShape: ClipartShape | null;
  selectedColor: string;
  onSelectShape: (shape: ClipartShape) => void;
  className?: string;
}

/**
 * ShapePicker — browse and select pixel-art clipart shapes to stamp onto the canvas.
 *
 * Renders a collapsible panel with category tabs and pixel-art thumbnails
 * matching the StitchWise blush-pink design system.
 */
export default function ShapePicker({
  selectedShape,
  selectedColor,
  onSelectShape,
  className = '',
}: ShapePickerProps) {
  const [expanded, setExpanded] = useState(true);
  const [category, setCategory] = useState<ShapeCategory>('Animals');

  const grouped = getShapesByCategory();
  const shapes = grouped[category] ?? [];

  return (
    <div
      className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg shadow-blush-100/50 border border-blush-100 overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-blush-50/50 transition-colors"
      >
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Shapes className="h-5 w-5 text-blush-500" />
          Clipart Shapes
          {selectedShape && (
            <span className="text-xs font-medium text-blush-500 bg-blush-50 rounded-full px-2 py-0.5">
              {selectedShape.name}
            </span>
          )}
        </h2>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1">
            {SHAPE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-200 ${
                  category === cat
                    ? 'bg-blush-500 text-white border-blush-500 shadow-sm'
                    : 'bg-white text-slate-500 border-blush-100 hover:bg-blush-50 hover:border-blush-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Shape grid */}
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
            {shapes.map((shape) => {
              const isSelected = selectedShape?.id === shape.id;
              // Determine cell size based on shape dimensions
              const cellSize = shape.width <= 8 ? 6 : 3;
              const displayCols = Math.min(shape.width, 8);
              const displayRows = Math.min(shape.height, 8);

              return (
                <button
                  key={shape.id}
                  onClick={() => onSelectShape(shape)}
                  className={`p-2 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? 'border-blush-500 bg-blush-50 ring-2 ring-blush-500/20 shadow-md'
                      : 'border-blush-100 bg-white hover:bg-blush-50 hover:border-blush-300 hover:shadow-sm'
                  }`}
                  title={`${shape.name} — click to select, then click canvas to place`}
                >
                  {/* Pixel art thumbnail */}
                  <div
                    className="grid gap-0 rounded-lg overflow-hidden border border-blush-100/50 bg-white"
                    style={{
                      gridTemplateColumns: `repeat(${displayCols}, ${cellSize}px)`,
                      width: displayCols * cellSize,
                      height: displayRows * cellSize,
                    }}
                  >
                    {shape.grid.slice(0, displayRows).flatMap((row, r) =>
                      row.slice(0, displayCols).map((cell, c) => (
                        <div
                          key={`${r}-${c}`}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: cell ? selectedColor : '#fdf2f8',
                            border: cell
                              ? '0.5px solid rgba(236,72,153,0.3)'
                              : '0.5px solid #fce7f3',
                          }}
                        />
                      ))
                    )}
                  </div>

                  {/* Shape name */}
                  <span className="text-[10px] font-medium text-slate-600 leading-tight text-center px-0.5">
                    {shape.name}
                  </span>
                </button>
              );
            })}

            {shapes.length === 0 && (
              <div className="col-span-4 py-6 text-center text-xs text-slate-400">
                No shapes in this category yet.
              </div>
            )}
          </div>

          {/* Selected shape indicator */}
          {selectedShape && (
            <div className="flex items-center gap-3 p-3 bg-blush-50 rounded-xl border border-blush-100">
              {/* Mini preview of selected */}
              <div
                className="grid gap-0 rounded-md overflow-hidden border border-blush-200 flex-shrink-0"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(selectedShape.width, 8)}, 4px)`,
                  width: Math.min(selectedShape.width, 8) * 4,
                }}
              >
                {selectedShape.grid.slice(0, 8).flatMap((row, r) =>
                  row.slice(0, 8).map((cell, c) => (
                    <div
                      key={`sel-${r}-${c}`}
                      style={{
                        width: 4,
                        height: 4,
                        backgroundColor: cell ? selectedColor : '#fdf2f8',
                        border: cell
                          ? '0.5px solid rgba(236,72,153,0.3)'
                          : 'none',
                      }}
                    />
                  ))
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {selectedShape.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  Click on grid to place • {selectedShape.width}×{selectedShape.height}px
                </p>
              </div>
            </div>
          )}

          {!selectedShape && (
            <p className="text-[11px] text-slate-400 text-center py-1">
              Select a shape, then click on the canvas to stamp it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
