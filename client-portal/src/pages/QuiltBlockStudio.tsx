import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw, ZoomIn, ZoomOut, Grid3X3,
  Palette, Download, Save, Trash2, Plus,
  Flower2, Square, Triangle, Minus,
  Grid, LayoutGrid
} from 'lucide-react';

interface BlockShape {
  id: string;
  type: 'square' | 'triangle' | 'hst';
  color: string;
  pattern: string;
  gridX: number;
  gridY: number;
  size: number; // grid units (1, 2, 3)
  rotation: number;
  zIndex: number;
}

const FABRIC_COLORS = [
  '#ffffff', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
  '#ec4899', '#db2777', '#86efac', '#fef3c7', '#bfdbfe',
  '#c4b5fd', '#fca5a5', '#d9f99d', '#fed7aa', '#e2e8f0',
  '#1e293b',
];

const FABRIC_PATTERNS = [
  { id: 'solid', name: 'Solid', class: '' },
  { id: 'polka', name: 'Polka Dot', class: 'bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] bg-[length:4px_4px]' },
  { id: 'stripe', name: 'Stripe', class: 'bg-[repeating-linear-gradient(90deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)]' },
  { id: 'plaid', name: 'Plaid', class: 'bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,currentColor_2px,currentColor_3px),repeating-linear-gradient(90deg,transparent,transparent_2px,currentColor_2px,currentColor_3px)]' },
];

const BLOCK_SIZES = [6, 8, 10, 12, 16];

/** Render a shape with fabric color and pattern */
const ShapePreview: React.FC<{ shape: BlockShape; cellPx: number; gridOffset: number }> = ({ shape, cellPx, gridOffset }) => {
  const x = gridOffset + shape.gridX * cellPx;
  const y = gridOffset + shape.gridY * cellPx;
  const size = shape.size * cellPx;
  const mid = size / 2;
  const patternClass = FABRIC_PATTERNS.find(p => p.id === shape.pattern)?.class || '';
  const colorStyle = { backgroundColor: shape.color, color: shape.color };

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: `rotate(${shape.rotation}deg)`,
        zIndex: shape.zIndex,
      }}
    >
      {shape.type === 'square' && (
        <div className={`w-full h-full rounded-sm border border-black/10 ${patternClass}`} style={colorStyle} />
      )}
      {shape.type === 'triangle' && (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          <polygon points={`0,${size} ${size},${size} ${mid},0`} fill={shape.color} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          {patternClass && <polygon points={`0,${size} ${size},${size} ${mid},0`} fill={`url(#pat-${shape.id})`} opacity="0.3" />}
        </svg>
      )}
      {shape.type === 'hst' && (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
          <polygon points={`0,0 ${size},0 ${size},${size}`} fill={shape.color} stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
          {patternClass && <polygon points={`0,0 ${size},0 ${size},${size}`} fill={`url(#pat-${shape.id})`} opacity="0.3" />}
          <line x1="0" y1="0" x2={size} y2={size} stroke="rgba(0,0,0,0.15)" strokeWidth="1" strokeDasharray="3,2" />
        </svg>
      )}
    </div>
  );
};

const DEFAULT_SHAPES: BlockShape[] = [
  { id: 's1', type: 'square', color: '#fce7f3', pattern: 'solid', gridX: 1, gridY: 1, size: 2, rotation: 0, zIndex: 0 },
  { id: 's2', type: 'square', color: '#f9a8d4', pattern: 'polka', gridX: 3, gridY: 1, size: 2, rotation: 0, zIndex: 1 },
  { id: 's3', type: 'triangle', color: '#86efac', pattern: 'stripe', gridX: 1, gridY: 3, size: 2, rotation: 0, zIndex: 2 },
  { id: 's4', type: 'hst', color: '#c4b5fd', pattern: 'solid', gridX: 3, gridY: 3, size: 2, rotation: 0, zIndex: 3 },
];

export const QuiltBlockStudio: React.FC = () => {
  const [shapes, setShapes] = useState<BlockShape[]>(DEFAULT_SHAPES);
  const [selectedShapeId, setSelectedShapeId] = useState<string>('s4');
  const [blockSize, setBlockSize] = useState<number>(8);
  const [zoom, setZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [toolMode, setToolMode] = useState<'square' | 'triangle' | 'hst'>('square');

  const selectedShape = shapes.find(s => s.id === selectedShapeId);
  const cellPx = 50;
  const gridPx = blockSize * cellPx;
  const gridOffset = 20;

  const updateShape = useCallback((id: string, updates: Partial<BlockShape>) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const addShape = () => {
    // Find a free grid position
    let gx = 0, gy = 0;
    for (let y = 0; y < blockSize; y++) {
      for (let x = 0; x < blockSize; x++) {
        const occupied = shapes.some(s => s.gridX === x && s.gridY === y);
        if (!occupied) { gx = x; gy = y; break; }
      }
      if (gx !== 0 || gy !== 0) break;
    }

    const newShape: BlockShape = {
      id: `shape-${Date.now()}`,
      type: toolMode,
      color: '#fbcfe8',
      pattern: 'solid',
      gridX: gx,
      gridY: gy,
      size: 2,
      rotation: 0,
      zIndex: shapes.length,
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newShape.id);
  };

  const deleteShape = (id: string) => {
    if (shapes.length <= 1) return;
    setShapes(prev => prev.filter(s => s.id !== id));
    if (selectedShapeId === id) {
      setSelectedShapeId(shapes[shapes.length - 2]?.id || '');
    }
  };

  // Handle clicking on the grid to place a shape
  const handleGridClick = (e: React.MouseEvent) => {
    if (!snapEnabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - rect.left - gridOffset;
    const my = e.clientY - rect.top - gridOffset;
    const gx = Math.floor(mx / cellPx);
    const gy = Math.floor(my / cellPx);
    if (gx < 0 || gy < 0 || gx >= blockSize || gy >= blockSize) return;
    
    const occupied = shapes.some(s => s.gridX === gx && s.gridY === gy);
    if (occupied) return;

    const newShape: BlockShape = {
      id: `shape-${Date.now()}`,
      type: toolMode,
      color: '#fbcfe8',
      pattern: 'solid',
      gridX: gx,
      gridY: gy,
      size: 2,
      rotation: 0,
      zIndex: shapes.length,
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newShape.id);
  };

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* Header */}
      <div className="bg-white border-b border-blush-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-blush-500 hover:text-blush-600 transition-colors">
                <Flower2 className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-blush-500" />
                  Quilt Block Studio
                </h1>
                <p className="text-[10px] text-blush-400">Geometric Block Designer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-floral-ghost text-xs py-1.5 px-3">
                <Save className="h-3.5 w-3.5 mr-1" />
                Save Block
              </button>
              <button className="btn-floral-primary text-xs py-1.5 px-3">
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Canvas (7 cols) */}
          <div className="lg:col-span-7">
            <div className="floral-card p-4">
              {/* Canvas Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="btn-floral-ghost p-1.5"><ZoomIn className="h-4 w-4" /></button>
                  <span className="text-xs font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="btn-floral-ghost p-1.5"><ZoomOut className="h-4 w-4" /></button>
                  <button onClick={() => setZoom(1)} className="btn-floral-ghost p-1.5"><RotateCcw className="h-4 w-4" /></button>
                  <span className="mx-2 text-blush-200">|</span>
                  {/* Block Size Selector */}
                  {BLOCK_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setBlockSize(s)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        blockSize === s
                          ? 'bg-blush-500 text-white border-blush-500'
                          : 'bg-white text-slate-600 border-blush-100 hover:border-blush-300'
                      }`}
                    >
                      {s}x{s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blush-500">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span>{shapes.length} shapes</span>
                </div>
              </div>

              {/* Tool Mode Bar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tool:</span>
                {([
                  { mode: 'square' as const, icon: Square, label: 'Square' },
                  { mode: 'triangle' as const, icon: Triangle, label: 'Triangle' },
                  { mode: 'hst' as const, icon: Minus, label: 'HST' },
                ]).map(t => (
                  <button
                    key={t.mode}
                    onClick={() => setToolMode(t.mode)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                      toolMode === t.mode
                        ? 'bg-blush-500 text-white border-blush-500'
                        : 'bg-white text-slate-600 border-blush-100 hover:border-blush-300'
                    }`}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
                <span className="mx-2 text-blush-200">|</span>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)}
                    className="rounded text-blush-500 focus:ring-blush-400 h-3 w-3" />
                  Snap to Grid
                </label>
                <button onClick={addShape} className="btn-floral-ghost p-1 ml-auto">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Canvas Area */}
              <div
                className="relative bg-white rounded-2xl border-2 border-dashed border-blush-200 overflow-hidden cursor-crosshair"
                style={{ height: '480px' }}
                onClick={handleGridClick}
              >
                <div
                  className="absolute"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {/* Grid Background */}
                  <div
                    className="relative"
                    style={{
                      width: gridPx + gridOffset * 2,
                      height: gridPx + gridOffset * 2,
                    }}
                  >
                    {/* Grid lines */}
                    <svg className="absolute inset-0" style={{ left: gridOffset, top: gridOffset }}>
                      {Array.from({ length: blockSize + 1 }).map((_, i) => (
                        <React.Fragment key={i}>
                          <line x1={i * cellPx} y1={0} x2={i * cellPx} y2={gridPx} stroke="#fce7f3" strokeWidth="1" />
                          <line x1={0} y1={i * cellPx} x2={gridPx} y2={i * cellPx} stroke="#fce7f3" strokeWidth="1" />
                        </React.Fragment>
                      ))}
                      {/* Outer border */}
                      <rect x="0" y="0" width={gridPx} height={gridPx} fill="none" stroke="#f9a8d4" strokeWidth="2" rx="4" />
                    </svg>

                    {/* Shapes */}
                    {shapes.sort((a, b) => a.zIndex - b.zIndex).map((shape) => (
                      <div
                        key={shape.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedShapeId(shape.id); }}
                        className={`absolute cursor-pointer transition-shadow duration-200 ${
                          selectedShapeId === shape.id ? 'ring-2 ring-blush-500 ring-offset-1 rounded-sm' : ''
                        }`}
                        style={{
                          left: gridOffset + shape.gridX * cellPx,
                          top: gridOffset + shape.gridY * cellPx,
                          width: shape.size * cellPx,
                          height: shape.size * cellPx,
                          zIndex: shape.zIndex + 10,
                        }}
                      >
                        <ShapePreview shape={shape} cellPx={cellPx} gridOffset={0} />
                      </div>
                    ))}

                    {/* Center marker */}
                    <div className="absolute" style={{
                      left: gridOffset + (blockSize / 2) * cellPx - 4,
                      top: gridOffset + (blockSize / 2) * cellPx - 4,
                      width: 8, height: 8,
                    }}>
                      <div className="w-2 h-2 rounded-full bg-blush-300/50" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Shapes List */}
            <div className="floral-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Grid className="h-4 w-4 text-blush-500" />
                  Block Shapes
                </h3>
                <button onClick={addShape} className="btn-floral-ghost p-1">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {shapes.sort((a, b) => b.zIndex - a.zIndex).map((shape) => (
                  <div
                    key={shape.id}
                    onClick={() => setSelectedShapeId(shape.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all text-xs ${
                      selectedShapeId === shape.id
                        ? 'bg-blush-50 border border-blush-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="w-6 h-6 rounded border border-blush-100 flex items-center justify-center text-[9px]" style={{ backgroundColor: shape.color }}>
                      {shape.type === 'square' ? '■' : shape.type === 'triangle' ? '▲' : '◣'}
                    </div>
                    <span className="font-medium text-slate-700 flex-1 capitalize">{shape.type} ({shape.gridX},{shape.gridY})</span>
                    <span className="text-[10px] text-slate-400">{shape.size}x{shape.size}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteShape(shape.id); }} className="text-slate-300 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector Panel */}
            {selectedShape && (
              <div className="floral-card p-5 space-y-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-blush-500" />
                  <span className="capitalize">{selectedShape.type} Shape</span>
                </h3>

                {/* Position */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Grid X</label>
                    <select value={selectedShape.gridX} onChange={(e) => updateShape(selectedShape.id, { gridX: Number(e.target.value) })}
                      className="w-full rounded-lg border-blush-100 text-xs py-1.5 focus:border-blush-500 focus:ring-blush-500">
                      {Array.from({ length: blockSize }).map((_, i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Grid Y</label>
                    <select value={selectedShape.gridY} onChange={(e) => updateShape(selectedShape.id, { gridY: Number(e.target.value) })}
                      className="w-full rounded-lg border-blush-100 text-xs py-1.5 focus:border-blush-500 focus:ring-blush-500">
                      {Array.from({ length: blockSize }).map((_, i) => (<option key={i} value={i}>{i}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Size</label>
                    <select value={selectedShape.size} onChange={(e) => updateShape(selectedShape.id, { size: Number(e.target.value) })}
                      className="w-full rounded-lg border-blush-100 text-xs py-1.5 focus:border-blush-500 focus:ring-blush-500">
                      {[1, 2, 3, 4].map(s => (<option key={s} value={s}>{s}x{s}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Rotation</label>
                    <select value={selectedShape.rotation} onChange={(e) => updateShape(selectedShape.id, { rotation: Number(e.target.value) })}
                      className="w-full rounded-lg border-blush-100 text-xs py-1.5 focus:border-blush-500 focus:ring-blush-500">
                      {[0, 90, 180, 270].map(r => (<option key={r} value={r}>{r}°</option>))}
                    </select>
                  </div>
                </div>

                {/* Fabric Color - Fabric Auditioning */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Fabric Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FABRIC_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateShape(selectedShape.id, { color: c })}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${
                          selectedShape.color === c ? 'border-blush-500 scale-110 ring-1 ring-blush-300' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Fabric Pattern */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Fabric Texture</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FABRIC_PATTERNS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => updateShape(selectedShape.id, { pattern: p.id })}
                        className={`p-2 rounded-lg border text-[10px] font-medium transition-all ${
                          selectedShape.pattern === p.id
                            ? 'border-blush-500 bg-blush-50 text-blush-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`h-4 w-full rounded mb-1 ${p.class}`} style={{ backgroundColor: selectedShape.color, color: selectedShape.color }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Info */}
            <div className="floral-card p-4">
              <h3 className="font-bold text-slate-700 text-xs flex items-center gap-2 mb-2">
                <Grid3X3 className="h-3.5 w-3.5 text-blush-500" />
                Block Info
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="text-slate-500">Grid Size</div>
                <div className="text-slate-700 font-bold text-right">{blockSize}x{blockSize}</div>
                <div className="text-slate-500">Shapes</div>
                <div className="text-slate-700 font-bold text-right">{shapes.length}</div>
                <div className="text-slate-500">Finished Size</div>
                <div className="text-slate-700 font-bold text-right">{blockSize * 2}" × {blockSize * 2}"</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};