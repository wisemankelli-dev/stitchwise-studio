import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, QuiltBlockDesign, QuiltBlockShape } from '../services/api';
import { ShareToCommunityModal } from '../components/ShareToCommunityModal';
import {
  ArrowLeft, ZoomIn, ZoomOut, Grid3X3,
  Palette, Download, Save, Trash2, Plus, Loader2,
  Square, Triangle, Minus,
  Grid, LayoutGrid, FolderOpen, ChevronDown, Share2, CheckCircle2
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

  // Save/Load state
  const [blockName, setBlockName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedBlocks, setSavedBlocks] = useState<QuiltBlockDesign[]>([]);
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Share to Community state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

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

  // Save/Load/Export handlers
  const handleSaveBlock = async () => {
    const name = blockName.trim() || `Block ${new Date().toLocaleDateString()}`;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const block = await api.saveQuiltBlock(name, shapes.map(s => ({
        id: s.id,
        type: s.type,
        color: s.color,
        pattern: s.pattern,
        gridX: s.gridX,
        gridY: s.gridY,
        size: s.size,
        rotation: s.rotation,
        zIndex: s.zIndex,
      })) as QuiltBlockShape[], blockSize);
      setBlockName('');
      setSavedBlocks(prev => [block, ...prev.filter(b => b.id !== block.id)]);
      setSaveMessage(`Saved "${block.name}"!`);
      setTimeout(() => setSaveMessage(null), 2500);
    } catch {
      setSaveMessage('Save failed. Will retry with mock backend.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadBlocks = async () => {
    try {
      const blocks = await api.listQuiltBlocks();
      setSavedBlocks(blocks);
    } catch { /* use stale */ }
    setShowLoadDropdown(prev => !prev);
  };

  const handleLoadBlock = async (id: string) => {
    const block = await api.loadQuiltBlock(id);
    if (block) {
      setShapes(block.shapes.map((s: QuiltBlockShape) => ({
        id: s.id,
        type: s.type,
        color: s.color,
        pattern: s.pattern,
        gridX: s.gridX,
        gridY: s.gridY,
        size: s.size,
        rotation: s.rotation,
        zIndex: s.zIndex,
      })) as BlockShape[]);
      setBlockSize(block.blockSize);
      setSelectedShapeId(block.shapes[block.shapes.length - 1]?.id || '');
      setSaveMessage(`Loaded "${block.name}"`);
      setTimeout(() => setSaveMessage(null), 2000);
    }
    setShowLoadDropdown(false);
  };

  const handleDeleteBlock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteQuiltBlock(id);
    setSavedBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const title = (blockName.trim() || 'quilt-block').replace(/\s+/g, '-');

      // Title
      doc.setFontSize(16);
      doc.setTextColor(139, 92, 118);
      doc.text(title, 20, 20);

      // Block diagram — draw a simple SVG grid
      const cellMm = 8;
      const ox = 20;
      const oy = 30;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Block Size: ${blockSize} x ${blockSize}`, 20, 28);

      // Draw grid lines
      doc.setDrawColor(220, 200, 210);
      for (let g = 0; g <= blockSize; g++) {
        doc.line(ox, oy + g * cellMm, ox + blockSize * cellMm, oy + g * cellMm);
        doc.line(ox + g * cellMm, oy, ox + g * cellMm, oy + blockSize * cellMm);
      }

      // Draw shapes
      const fabricColorMap: Record<string, { color: string; pattern: string }> = {};
      shapes.forEach(s => fabricColorMap[s.id] = { color: s.color, pattern: s.pattern });
      shapes.forEach(s => {
        const cx = ox + s.gridX * cellMm;
        const cy = oy + s.gridY * cellMm;
        const sz = s.size * cellMm;
        doc.setFillColor(hexToRgb(s.color)[0], hexToRgb(s.color)[1], hexToRgb(s.color)[2]);
        doc.rect(cx, cy, sz, sz, 'F');
        doc.setDrawColor(150, 150, 150);
        doc.rect(cx, cy, sz, sz);
      });

      // Fabric Key
      const keyY = oy + blockSize * cellMm + 15;
      doc.setFontSize(12);
      doc.setTextColor(139, 92, 118);
      doc.text('Fabric Key', 20, keyY);

      const keys = [...new Set(shapes.map(s => s.color))];
      keys.forEach((color, i) => {
        const ky = keyY + 8 + i * 7;
        doc.setFillColor(hexToRgb(color)[0], hexToRgb(color)[1], hexToRgb(color)[2]);
        doc.rect(20, ky - 3, 5, 5, 'F');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(color, 28, ky);
      });

      // Cutting Guide
      const cutY = keyY + 8 + keys.length * 7 + 10;
      doc.setFontSize(12);
      doc.setTextColor(139, 92, 118);
      doc.text('Cutting Guide', 20, cutY);
      const guideY = cutY + 8;
      // Table header
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      ['Shape', 'Type', 'Size', 'Qty'].forEach((h, i) => doc.text(h, 20 + i * 35, guideY));
      doc.setDrawColor(180, 180, 180);
      doc.line(20, guideY + 2, 20 + 140, guideY + 2);

      shapes.forEach((s, i) => {
        const ry = guideY + 6 + i * 6;
        doc.text(s.id.slice(-6), 20, ry);
        doc.text(s.type, 55, ry);
        doc.text(`${s.size}u`, 90, ry);
        doc.text('1', 125, ry);
      });

      doc.save(`${title}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      setSaveMessage('Export failed');
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  // Helper: hex to [r, g, b]
  function hexToRgb(hex: string): [number, number, number] {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
  }

  return (
    <div className="bg-gradient-to-b from-white via-blush-50/30 to-white min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <svg className="w-full h-full"><defs><pattern id="qb-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="12" fill="#f472b6" /><circle cx="30" cy="30" r="6" fill="#f9a8d4" />
          <circle cx="80" cy="80" r="16" fill="#f472b6" /><circle cx="80" cy="80" r="8" fill="#f9a8d4" />
          <circle cx="130" cy="30" r="12" fill="#f472b6" /><circle cx="130" cy="130" r="10" fill="#f472b6" />
        </pattern></defs><rect width="100%" height="100%" fill="url(#qb-floral)" /></svg>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-6 flex justify-between items-center">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-blush-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50/80 backdrop-blur-sm px-4 py-1 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-100 mb-4">
            <LayoutGrid className="h-4 w-4 text-blush-500" /> Quilt Block Studio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
            StitchWise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-400">Quilt Block Designer</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">Design geometric quilt blocks with snap-to-grid precision.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL — Canvas */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg shadow-blush-100/50 border border-blush-100 flex flex-col items-center">
              {/* ===== Merged Header + Controls Row ===== */}
              <div className="w-full flex flex-wrap items-center gap-3 mb-3 border-b border-blush-100 pb-3">
                {/* Title */}
                <div className="shrink-0 mr-1">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                    <Grid3X3 className="h-4 w-4 text-blush-500" /> Quilt Canvas
                  </h3>
                </div>
                {/* Block Size Selector */}
                <div className="flex items-center gap-0.5 bg-blush-50 p-0.5 rounded-lg border border-blush-100">
                  {BLOCK_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => setBlockSize(s)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                        blockSize === s
                          ? 'bg-blush-500 text-white border-blush-500'
                          : 'bg-white text-slate-600 border-transparent hover:border-blush-300'
                      }`}
                    >
                      {s}x{s}
                    </button>
                  ))}
                </div>
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-blush-50 p-0.5 rounded-lg border border-blush-100">
                  <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 rounded hover:bg-white text-slate-500"><ZoomOut className="h-3.5 w-3.5" /></button>
                  <span className="text-[10px] font-bold text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(2, z + 0.25))} className="p-1.5 rounded hover:bg-white text-slate-500"><ZoomIn className="h-3.5 w-3.5" /></button>
                </div>
                {/* Snap Toggle */}
                <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} className="h-3.5 w-3.5 accent-blush-500 rounded" />
                  Snap
                </label>
                {/* Shapes count + Add */}
                <span className="text-[10px] text-blush-500 font-semibold">{shapes.length} shapes</span>
                <button onClick={addShape} className="p-1 rounded bg-blush-50 text-blush-600 hover:bg-blush-100 border border-blush-100">
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="text"
                    value={blockName}
                    onChange={(e) => setBlockName(e.target.value)}
                    placeholder="Block name..."
                    className="w-28 rounded-lg border-blush-200 text-xs text-slate-700 px-2 py-1.5 border bg-white focus:border-blush-400 focus:ring-1 focus:ring-blush-400"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBlock(); }}
                  />
                  <button
                    onClick={handleSaveBlock}
                    disabled={isSaving}
                    className="p-1.5 rounded bg-blush-50 text-slate-600 text-[10px] font-semibold flex items-center gap-1 border border-blush-100 hover:bg-blush-100 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </button>
                  {/* Load dropdown */}
                  <div className="relative">
                    <button
                      onClick={handleLoadBlocks}
                      className="p-1.5 rounded bg-blush-50 text-slate-600 text-[10px] font-semibold flex items-center gap-1 border border-blush-100 hover:bg-blush-100"
                    >
                      <FolderOpen className="h-3 w-3" />
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                    {showLoadDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-blush-100 z-50 max-h-60 overflow-y-auto">
                        {savedBlocks.length === 0 ? (
                          <p className="p-3 text-[11px] text-slate-400 text-center">No saved blocks yet</p>
                        ) : (
                          savedBlocks.map(b => (
                            <div
                              key={b.id}
                              onClick={() => handleLoadBlock(b.id)}
                              className="flex items-center justify-between p-2 hover:bg-blush-50 cursor-pointer border-b border-blush-50 last:border-0"
                            >
                              <span className="text-xs text-slate-700 truncate flex-1">
                                {b.name}
                                <span className="text-[10px] text-slate-400 ml-2">{new Date(b.updatedAt).toLocaleDateString()}</span>
                              </span>
                              <button
                                onClick={(e) => handleDeleteBlock(b.id, e)}
                                className="text-slate-300 hover:text-red-500 p-1"
                                title="Delete block"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={handleExportPdf} className="p-1.5 rounded bg-blush-500 hover:bg-blush-600 text-white text-[10px] font-semibold flex items-center gap-1">
                    <Download className="h-3 w-3" /> PDF
                  </button>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="p-1.5 rounded bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-semibold flex items-center gap-1"
                  >
                    <Share2 className="h-3 w-3" /> Share
                  </button>
                </div>
              </div>
              {/* Save message flash */}
              {saveMessage && (
                <div className="w-full mb-3">
                  <p className={`text-[10px] px-2 py-1 rounded ${saveMessage.startsWith('Save failed') || saveMessage.startsWith('Export') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {saveMessage}
                  </p>
                </div>
              )}
              {/* Tool Mode Bar */}
              <div className="w-full flex flex-wrap items-center gap-2 mb-3">
                <div className="flex items-center gap-0.5 bg-blush-50 p-0.5 rounded-lg border border-blush-100">
                  {([
                    { mode: 'square' as const, icon: Square, label: 'Square' },
                    { mode: 'triangle' as const, icon: Triangle, label: 'Tri' },
                    { mode: 'hst' as const, icon: Minus, label: 'HST' },
                  ]).map(t => (
                    <button
                      key={t.mode}
                      onClick={() => setToolMode(t.mode)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition-all ${
                        toolMode === t.mode
                          ? 'bg-blush-500 text-white border-blush-500'
                          : 'bg-white text-slate-600 border-transparent hover:border-blush-300'
                      }`}
                    >
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>{/* Canvas Area */}
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

          
          {/* RIGHT PANEL — Controls */}
          <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-24 lg:overflow-y-auto lg:max-h-[calc(100vh-7rem)]">
            {/* Shapes List */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100">
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
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg shadow-blush-100/50 border border-blush-100">
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

      {/* Share to Community Modal */}
      {showShareModal && (
        <ShareToCommunityModal
          projectType="quilt-block"
          defaultTitle={blockName}
          onClose={() => setShowShareModal(false)}
          onSuccess={(entry) => {
            setShowShareModal(false);
            setShareMessage(`Shared "${entry.title}" to the community! 🎉`);
            setTimeout(() => setShareMessage(null), 4000);
          }}
          onError={(msg) => {
            setShareMessage(msg);
            setTimeout(() => setShareMessage(null), 4000);
          }}
        />
      )}

      {/* Share success/error toast */}
      {shareMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className="rounded-2xl shadow-floral border px-5 py-4 flex items-center gap-3 max-w-sm bg-white border-emerald-200">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-xs text-slate-700 font-medium">{shareMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};