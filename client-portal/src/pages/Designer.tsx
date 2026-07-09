import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, AIPatternResponse } from '../services/api';
import {
  Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw,
  UploadCloud, Image, Eye, Trash2, ArrowLeft,
  Scissors, Square, ZoomIn, ZoomOut, RefreshCw, AlertTriangle,
  Copy, Eraser, Paintbrush, Pipette, FlipHorizontal, MousePointer2, Type
} from 'lucide-react';
import StitchGrid, { DmcLegend } from '../components/StitchGrid';
import type { StitchGridData, StitchCell } from '../components/StitchGrid';
import { FONTS, renderTextToGrid } from '../components/FontGlyphs';

interface StitchStyle { id: string; name: string; description: string; }

type EditTool = 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet';

const COLORS = [
  { name: 'Rose Red', hex: '#e11d48' }, { name: 'Sunset Gold', hex: '#d97706' },
  { name: 'Forest Green', hex: '#16a34a' }, { name: 'Ocean Blue', hex: '#0284c7' },
  { name: 'Royal Violet', hex: '#7c3aed' }, { name: 'Warm Cream', hex: '#fef3c7' },
  { name: 'Pitch Black', hex: '#1e293b' },
];

const STITCH_STYLES: StitchStyle[] = [
  { id: 'cross', name: 'Cross Stitch', description: 'Traditional X-shaped intersection' },
  { id: 'satin', name: 'Satin Stitch', description: 'Flat, glossy parallel stitches' },
  { id: 'back', name: 'Back Stitch', description: 'Perfect for outlining fine borders' },
  { id: 'french', name: 'French Knot', description: 'Raised, textured point details' },
];

const TOOLS: { id: EditTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="h-3.5 w-3.5" />, label: 'Select' },
  { id: 'mirror', icon: <FlipHorizontal className="h-3.5 w-3.5" />, label: 'Mirror' },
  { id: 'erase', icon: <Eraser className="h-3.5 w-3.5" />, label: 'Erase' },
  { id: 'clone', icon: <Copy className="h-3.5 w-3.5" />, label: 'Clone' },
  { id: 'eyedropper', icon: <Pipette className="h-3.5 w-3.5" />, label: 'Pick' },
  { id: 'paint', icon: <Paintbrush className="h-3.5 w-3.5" />, label: 'Paint' },
  { id: 'alphabet', icon: <Type className="h-3.5 w-3.5" />, label: 'Text' },
];

function toGridData(ai: AIPatternResponse): StitchGridData {
  const cells = ai.grid.map((row, r) =>
    row.map((color, c) => ({
      row: r, col: c,
      color: color === '#fafaf9' ? '' : color,
      dmcCode: ai.dmcPalette.find(p => p.hex === color)?.code,
      stitchType: (ai.stitchTypes[r]?.[c] as any) || 'cross',
    }))
  );
  return { grid: cells, width: ai.width, height: ai.height, dmcPalette: ai.dmcPalette, totalStitches: ai.totalStitches };
}

/** Build a StitchGridData from the manual grid state (flat key-value records) */
function buildManualGridData(
  grid: Record<string, string>,
  stitchTypes: Record<string, string>,
  size: number
): StitchGridData {
  const dmcColorCounts: Record<string, number> = {};
  Object.values(grid).forEach(color => {
    if (color) dmcColorCounts[color] = (dmcColorCounts[color] || 0) + 1;
  });
  const dmcPalette = Object.entries(dmcColorCounts).map(([hex, count], i) => ({
    code: `MAN-${i + 1}`,
    name: hex,
    hex,
    count,
  }));

  const cells: StitchCell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < size; c++) {
      const key = `${r},${c}`;
      const color = grid[key] || '';
      row.push({
        row: r,
        col: c,
        color,
        stitchType: (stitchTypes[key] as StitchCell['stitchType']) || 'cross',
      });
    }
    cells.push(row);
  }

  const totalStitches = Object.values(grid).filter(Boolean).length;
  return { grid: cells, width: size, height: size, dmcPalette, totalStitches };
}

export const Designer: React.FC = () => {
  const gridSize = 32;
  const [activeTab, setActiveTab] = useState<'prompt' | 'image'>('prompt');
  const [promptInput, setPromptInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; previewUrl: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');
  const [aiResult, setAiResult] = useState<AIPatternResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [gridStitchTypes, setGridStitchTypes] = useState<Record<string, string>>({});
  const [previewMode, setPreviewMode] = useState<'pattern' | 'original'>('pattern');
  const lastSaved = useRef<Record<string, string>>({});

  // Editing Tools state
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [cloneSource, setCloneSource] = useState<{ row: number; col: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Alphabet tool state
  const [alphabetText, setAlphabetText] = useState('');
  const [selectedFontId, setSelectedFontId] = useState('block');
  const [placeRow, setPlaceRow] = useState(4);
  const [placeCol, setPlaceCol] = useState(2);

  const setCell = useCallback((row: number, col: number, color: string, stitch: string) => {
    const key = `${row},${col}`;
    setGrid(prev => ({ ...prev, [key]: color }));
    setGridStitchTypes(prev => ({ ...prev, [key]: stitch }));
  }, []);

  const clearCell = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;
    setGrid(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setGridStitchTypes(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const mirrorCellEdit = useCallback((row: number, col: number, color: string, stitch: string) => {
    if (!mirrorEnabled) return;
    const mirroredRow = gridSize - 1 - row;
    const mirroredCol = gridSize - 1 - col;
    if (mirroredRow === row && mirroredCol === col) return;
    setCell(mirroredRow, mirroredCol, color, stitch);
  }, [mirrorEnabled, gridSize, setCell]);

  const handleCellAction = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;

    switch (activeTool) {
      case 'erase': {
        clearCell(row, col);
        if (mirrorEnabled) {
          const mRow = gridSize - 1 - row;
          const mCol = gridSize - 1 - col;
          if (mRow !== row || mCol !== col) clearCell(mRow, mCol);
        }
        break;
      }
      case 'paint': {
        setCell(row, col, selectedColor, selectedStitch);
        if (mirrorEnabled) {
          mirrorCellEdit(row, col, selectedColor, selectedStitch);
        }
        break;
      }
      case 'eyedropper': {
        const existingColor = grid[key];
        if (existingColor) {
          setSelectedColor(existingColor);
          setActiveTool('paint');
        }
        break;
      }
      case 'clone': {
        if (!cloneSource) {
          // First click: select source
          if (grid[key]) {
            setCloneSource({ row, col });
          }
        } else {
          // Second click: paste to destination
          const srcKey = `${cloneSource.row},${cloneSource.col}`;
          const srcColor = grid[srcKey];
          const srcStitch = gridStitchTypes[srcKey];
          if (srcColor) {
            setCell(row, col, srcColor, srcStitch || 'cross');
            if (mirrorEnabled) {
              mirrorCellEdit(row, col, srcColor, srcStitch || 'cross');
            }
          }
          setCloneSource(null);
        }
        break;
      }
      default: {
        // Select tool: normal toggle behavior
        const newGrid = { ...grid };
        const newStitchTypes = { ...gridStitchTypes };
        if (newGrid[key] === selectedColor) {
          delete newGrid[key];
          delete newStitchTypes[key];
        } else {
          newGrid[key] = selectedColor;
          newStitchTypes[key] = selectedStitch;
        }
        setGrid(newGrid);
        setGridStitchTypes(newStitchTypes);

        if (mirrorEnabled) {
          const mRow = gridSize - 1 - row;
          const mCol = gridSize - 1 - col;
          if (mRow !== row || mCol !== col) {
            const mKey = `${mRow},${mCol}`;
            if (newGrid[key] === selectedColor) {
              newGrid[mKey] = selectedColor;
              newStitchTypes[mKey] = selectedStitch;
            } else {
              delete newGrid[mKey];
              delete newStitchTypes[mKey];
            }
            setGrid({ ...newGrid });
            setGridStitchTypes({ ...newStitchTypes });
          }
        }
        break;
      }
    }
  }, [activeTool, clearCell, cloneSource, grid, gridStitchTypes, gridSize, mirrorCellEdit, mirrorEnabled, selectedColor, selectedStitch, setCell]);

  const handleCellHover = useCallback((row: number, col: number) => {
    if (!isMouseDown) return;
    if (activeTool === 'paint') {
      setCell(row, col, selectedColor, selectedStitch);
      if (mirrorEnabled) mirrorCellEdit(row, col, selectedColor, selectedStitch);
    } else if (activeTool === 'erase') {
      clearCell(row, col);
      if (mirrorEnabled) {
        const mRow = gridSize - 1 - row;
        const mCol = gridSize - 1 - col;
        if (mRow !== row || mCol !== col) clearCell(mRow, mCol);
      }
    }
  }, [activeTool, clearCell, isMouseDown, mirrorCellEdit, mirrorEnabled, selectedColor, selectedStitch, setCell]);

  const handleClearGrid = () => {
    setGrid({}); setGridStitchTypes({}); setAiResult(null); setAiError(null);
    setCloneSource(null);
  };

  const triggerTextGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    setIsGenerating(true); setGeneratorProgress(5); setProgressPhase('Interpreting your design vision...');
    setAiResult(null); setAiError(null);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(95, Math.round(((Date.now() - startTime) / 3000) * 95));
      setGeneratorProgress(p);
      setProgressPhase(p < 20 ? 'Interpreting your design vision...' : p < 45 ? 'Mapping colors to DMC thread palette...' : p < 70 ? 'Plotting stitch coordinates...' : p < 90 ? 'Optimizing stitch density...' : 'Finalizing pattern...');
    }, 100);
    try {
      const result = await api.generatePatternFromText(promptInput, gridSize);
      clearInterval(interval); setGeneratorProgress(100); setProgressPhase('Pattern complete!');
      setAiResult(result); setGrid({}); setGridStitchTypes({});
    } catch (err: any) {
      clearInterval(interval); setAiError(err.message || 'AI generation failed.');
    } finally { setTimeout(() => setIsGenerating(false), 500); }
  };

  const triggerImageGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;
    setIsGenerating(true); setGeneratorProgress(5); setProgressPhase('Analyzing image...');
    setAiResult(null); setAiError(null); setPreviewMode('pattern');
    const resp = await fetch(uploadedFile.previewUrl);
    const blob = await resp.blob();
    const file = new File([blob], uploadedFile.name, { type: blob.type });
    const startTime = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(95, Math.round(((Date.now() - startTime) / 3500) * 95));
      setGeneratorProgress(p);
      setProgressPhase(p < 25 ? 'Analyzing image color channels...' : p < 50 ? 'Tracing outlines...' : p < 75 ? 'Mapping to DMC colors...' : 'Generating embroidery grid...');
    }, 100);
    try {
      const result = await api.generatePatternFromImage(file, gridSize, selectedStitch);
      clearInterval(interval); setGeneratorProgress(100); setProgressPhase('Pattern complete!');
      setAiResult(result); setGrid({}); setGridStitchTypes({});
    } catch (err: any) {
      clearInterval(interval); setAiError(err.message || 'Image digitization failed.');
    } finally { setTimeout(() => setIsGenerating(false), 500); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingOver(false);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      setUploadedFile({ name: f.name, size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`, previewUrl: URL.createObjectURL(f) });
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      setUploadedFile({ name: f.name, size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`, previewUrl: URL.createObjectURL(f) });
    }
  };
  const handleRemoveFile = () => { setUploadedFile(null); setAiResult(null); };

<<<<<<< HEAD
  const handlePlaceText = () => {
    if (!alphabetText.trim()) return;
    const font = FONTS.find(f => f.id === selectedFontId) || FONTS[0];
    // Clear the area first
    const width = alphabetText.length * (font.charWidth + font.spacing);
    for (let r = placeRow; r < placeRow + font.charHeight; r++) {
      for (let c = placeCol; c < placeCol + width; c++) {
        if (r < gridSize && c < gridSize) clearCell(r, c);
      }
    }
    renderTextToGrid(
      alphabetText, font, placeRow, placeCol,
      selectedColor, selectedStitch, gridSize, setCell
    );
  };

=======
>>>>>>> origin/main
  const stitchData: StitchGridData = aiResult
    ? toGridData(aiResult)
    : buildManualGridData(grid, gridStitchTypes, gridSize);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('stitchwise_designer_save', JSON.stringify({ grid, stitchTypes: gridStitchTypes }));
      lastSaved.current = grid;
    }, 2000);
    return () => clearTimeout(timeout);
  }, [grid, gridStitchTypes]);

  useEffect(() => {
    const saved = localStorage.getItem('stitchwise_designer_save');
    if (saved) {
      try { const p = JSON.parse(saved); if (p.grid) setGrid(p.grid); if (p.stitchTypes) setGridStitchTypes(p.stitchTypes); } catch {}
    }
  }, []);

  return (
    <div className="bg-gradient-to-b from-white via-blush-50/30 to-white min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <svg className="w-full h-full"><defs><pattern id="des-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
          <circle cx="30" cy="30" r="12" fill="#f472b6" /><circle cx="30" cy="30" r="6" fill="#f9a8d4" />
          <circle cx="80" cy="80" r="16" fill="#f472b6" /><circle cx="80" cy="80" r="8" fill="#f9a8d4" />
          <circle cx="130" cy="30" r="12" fill="#f472b6" /><circle cx="130" cy="130" r="10" fill="#f472b6" />
        </pattern></defs><rect width="100%" height="100%" fill="url(#des-floral)" /></svg>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-6 flex justify-between items-center">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-blush-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50/80 backdrop-blur-sm px-4 py-1 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-100 mb-4">
            <Scissors className="h-4 w-4 text-blush-500" /> Solo Designer Studio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
            StitchWise <span className="text-transparent bg-clip-text bg-gradient-to-r from-blush-500 to-blush-400">Pattern Designer</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">Design perfect patterns stitch by stitch using AI.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100">
              <div className="flex border-b border-blush-100 mb-6">
                <button onClick={() => setActiveTab('prompt')} disabled={isGenerating}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${activeTab === 'prompt' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400'}`}>
                  <div className="flex items-center justify-center gap-1.5"><Sparkles className="h-4 w-4" /> AI Vision Prompt</div>
                </button>
                <button onClick={() => setActiveTab('image')} disabled={isGenerating}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${activeTab === 'image' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400'}`}>
                  <div className="flex items-center justify-center gap-1.5"><Image className="h-4 w-4" /> Digitize Image</div>
                </button>
              </div>

              {activeTab === 'prompt' ? (
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-blush-500" /> Describe Your Vision
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">Enter a text description and AI will generate a stitch pattern.</p>
                  <form onSubmit={triggerTextGeneration} className="space-y-4">
                    <textarea rows={3} disabled={isGenerating} value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder="e.g., A red rose with green leaves on a white background"
                      className="w-full rounded-xl border-blush-100 text-sm text-slate-800 shadow-sm focus:border-blush-500 focus:ring-blush-500 disabled:opacity-50 placeholder:text-blush-300" />
                    {isGenerating ? (
                      <div className="space-y-2 p-4 bg-blush-50 rounded-xl border border-blush-100">
                        <div className="flex items-center gap-2 text-xs text-blush-700 font-semibold">
                          <div className="h-2 w-2 rounded-full bg-blush-500 animate-pulse" />
                          <span className="flex-1">{progressPhase}</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blush-400 to-blush-500 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${generatorProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <button type="submit" disabled={!promptInput.trim()}
                        className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-blush-600 hover:to-blush-500 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Play className="h-4 w-4" /> Generate Pattern
                      </button>
                    )}
                  </form>
                  {aiResult && !isGenerating && (
                    <button onClick={triggerTextGeneration as any}
                      className="w-full mt-3 rounded-xl border border-blush-200 px-4 py-2 text-xs font-semibold text-blush-600 hover:bg-blush-50 flex items-center justify-center gap-2 transition-all">
                      <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-blush-500" /> Upload Craft Sketch
                  </h2>
                  <p className="text-xs text-slate-500">Transform images into optimized stitch grids.</p>
                  {!uploadedFile ? (
                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDraggingOver ? 'border-blush-500 bg-blush-50/50' : 'border-blush-200 hover:bg-blush-50/50'}`}>
                      <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                      <label htmlFor="file-upload" className="cursor-pointer block space-y-2">
                        <UploadCloud className="h-8 w-8 mx-auto text-blush-400" />
                        <span className="block text-xs font-bold text-slate-700">Drag & drop here</span>
                        <span className="block text-[10px] text-slate-400">or click to browse (PNG, JPG)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-4 bg-blush-50/50 rounded-xl border border-blush-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-blush-100 flex items-center justify-center text-blush-600 shrink-0 font-bold text-xs uppercase">IMG</div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</p>
                          <p className="text-[10px] text-slate-500">{uploadedFile.size}</p>
                        </div>
                      </div>
                      <button onClick={handleRemoveFile} disabled={isGenerating}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={triggerImageGeneration} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Stitch Type</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['cross', 'back', 'satin'].map((type) => (
                          <button key={type} type="button" disabled={isGenerating} onClick={() => setSelectedStitch(type)}
                            className={`py-1.5 rounded-lg text-[10px] font-bold text-center border capitalize transition-all ${selectedStitch === type ? 'bg-blush-50 border-blush-500 text-blush-700' : 'bg-white border-blush-100 text-slate-500 hover:bg-blush-50'}`}>
                            {type === 'cross' ? 'Cross' : type === 'back' ? 'Back' : 'Satin'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isGenerating ? (
                      <div className="space-y-2 p-4 bg-blush-50 rounded-xl border border-blush-100">
                        <div className="flex items-center gap-2 text-xs text-blush-700 font-semibold">
                          <div className="h-2 w-2 rounded-full bg-blush-500 animate-pulse" />
                          <span className="flex-1">{progressPhase}</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blush-400 to-blush-500 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${generatorProgress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <button type="submit" disabled={!uploadedFile}
                        className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-blush-600 hover:to-blush-500 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Play className="h-4 w-4" /> Digitize & Generate
                      </button>
                    )}
                  </form>
                </div>
              )}

              {aiResult && !isGenerating && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800"><strong>Success!</strong> {aiResult.totalStitches} stitches, {aiResult.dmcPalette.length} DMC colors.</p>
                </div>
              )}
              {aiError && (
                <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  <p className="text-xs text-rose-800">{aiError}</p>
                </div>
              )}
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Palette className="h-5 w-5 text-blush-500" /> Designer Thread Box
              </h2>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Active Thread Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c.name} onClick={() => setSelectedColor(c.hex)} title={c.name}
                      className="h-8 w-8 rounded-full border transition-all relative flex items-center justify-center"
                      style={{ backgroundColor: c.hex, borderColor: selectedColor === c.hex ? '#000' : 'rgba(0,0,0,0.1)' }}>
                      {selectedColor === c.hex && <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Stitch Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {STITCH_STYLES.map((s) => (
                    <button key={s.id} onClick={() => setSelectedStitch(s.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${selectedStitch === s.id ? 'border-blush-600 bg-blush-50 text-blush-800 ring-1 ring-blush-500' : 'border-blush-100 bg-white hover:bg-blush-50 text-slate-700'}`}>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {stitchData && stitchData.dmcPalette.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100">
                <DmcLegend palette={stitchData.dmcPalette} />
                <div className="mt-3 pt-3 border-t border-blush-100 text-[10px] text-slate-500 space-y-0.5">
                  <p>Total stitches: <span className="font-bold text-blush-600">{stitchData.totalStitches}</span></p>
                  <p>Grid: <span className="font-bold text-slate-700">{stitchData.width}×{stitchData.height}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 flex flex-col items-center">
              <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-blush-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blush-500" /> Embroidery Canvas
                  </h3>
                  <p className="text-xs text-slate-500">Click cells to stitch or preview AI-generated patterns.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                    <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="p-1.5 rounded-lg hover:bg-white text-slate-500"><ZoomOut className="h-4 w-4" /></button>
                    <span className="text-[10px] font-bold text-slate-600 w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(z + 0.2, 3))} className="p-1.5 rounded-lg hover:bg-white text-slate-500"><ZoomIn className="h-4 w-4" /></button>
                  </div>
                  {(aiResult || uploadedFile) && (
                    <div className="flex bg-blush-50 p-1 rounded-xl border border-blush-100">
                      <button onClick={() => setPreviewMode('pattern')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${previewMode === 'pattern' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                        <Layers className="h-3.5 w-3.5 inline text-blush-500" /> Pattern
                      </button>
                      <button onClick={() => setPreviewMode('original')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${previewMode === 'original' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>
                        <Eye className="h-3.5 w-3.5 inline text-blush-500" /> Original
                      </button>
                    </div>
                  )}
                  <button onClick={handleClearGrid} className="p-2 rounded-lg hover:bg-blush-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 border border-blush-100">
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <button className="p-2 rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-xs font-semibold flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id);
                        if (tool.id !== 'clone') setCloneSource(null);
                        if (tool.id !== 'mirror') setMirrorEnabled(false);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                        activeTool === tool.id
                          ? 'bg-white text-slate-800 shadow-sm ring-1 ring-blush-500'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title={tool.label}
                    >
                      {tool.icon}
                      <span className="hidden sm:inline">{tool.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {activeTool === 'mirror' && (
                    <button
                      onClick={() => setMirrorEnabled(!mirrorEnabled)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        mirrorEnabled ? 'bg-blush-500 text-white shadow-sm' : 'bg-blush-50 text-slate-500 border border-blush-100'
                      }`}
                    >
                      <FlipHorizontal className="h-3 w-3 inline mr-1" />
                      {mirrorEnabled ? 'Mirror ON' : 'Mirror OFF'}
                    </button>
                  )}
                  {activeTool === 'clone' && cloneSource && (
                    <span className="text-[10px] font-bold text-blush-600 bg-blush-50 px-2 py-1 rounded-lg">
                      Source: ({cloneSource.row},{cloneSource.col}) — click to paste
                    </span>
                  )}
                  {activeTool === 'eyedropper' && (
                    <span className="text-[10px] text-slate-500 italic">Click a cell to pick its color</span>
                  )}
                  {activeTool === 'paint' && (
                    <span className="text-[10px] text-slate-500 italic">Click & drag to paint</span>
                  )}
                  {activeTool === 'erase' && (
                    <span className="text-[10px] text-slate-500 italic">Click or drag to erase</span>
                  )}
                  {activeTool === 'alphabet' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={alphabetText}
                        onChange={(e) => setAlphabetText(e.target.value.toUpperCase())}
                        placeholder="TYPE TEXT"
                        className="w-28 rounded-lg border-blush-100 text-[10px] font-mono font-bold text-slate-800 uppercase px-2 py-1 border focus:border-blush-500 focus:ring-blush-500"
                        maxLength={12}
                      />
                      <select
                        value={selectedFontId}
                        onChange={(e) => setSelectedFontId(e.target.value)}
                        className="rounded-lg border-blush-100 text-[10px] font-bold text-slate-600 px-2 py-1 border bg-white"
                      >
                        {FONTS.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">R:</span>
                        <input
                          type="number"
                          value={placeRow}
                          onChange={(e) => setPlaceRow(Math.max(0, Math.min(gridSize - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center"
                          min={0}
                          max={gridSize - 1}
                        />
                        <span className="text-[10px] text-slate-400">C:</span>
                        <input
                          type="number"
                          value={placeCol}
                          onChange={(e) => setPlaceCol(Math.max(0, Math.min(gridSize - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center"
                          min={0}
                          max={gridSize - 1}
                        />
                      </div>
                      <button
                        onClick={handlePlaceText}
                        disabled={!alphabetText.trim()}
                        className="rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-[10px] font-bold px-3 py-1.5 disabled:opacity-50 transition-all"
                      >
                        <Type className="h-3 w-3 inline mr-1" /> Place
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={canvasRef}
                className="w-full p-6 bg-amber-50/20 rounded-2xl border-4 border-dashed border-blush-100 shadow-inner min-h-[360px] flex items-center justify-center overflow-auto"
                onMouseDown={() => setIsMouseDown(true)}
                onMouseUp={() => { setIsMouseDown(false); }}
                onMouseLeave={() => { setIsMouseDown(false); }}
              >
                {previewMode === 'original' && aiResult ? (
                  <div className="flex flex-col items-center p-8 bg-white/90 rounded-2xl shadow-sm border border-blush-100 max-w-sm mx-auto text-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-blush-600 mb-4">Generated Concept</span>
                    <div className="p-4 bg-blush-50/50 rounded-2xl border border-blush-100 shadow-inner">
                      <svg className="w-48 h-48" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="30" fill="#f472b6" opacity="0.3" stroke="#db2777" strokeWidth="2" />
                        <circle cx="50" cy="50" r="15" fill="#f9a8d4" opacity="0.5" stroke="#db2777" strokeWidth="1.5" />
                        <path d="M30 50 L70 50 M50 30 L50 70" stroke="#db2777" strokeWidth="2" opacity="0.6" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800 mt-4 truncate max-w-full">{aiResult.promptUsed || 'AI Generated'}</span>
                  </div>
                ) : (
                  <div className="w-full">
                    <StitchGrid
                      data={stitchData}
                      zoom={zoom}
                      onCellClick={handleCellAction}
                      activeTool={activeTool}
                      isMouseDown={isMouseDown}
                      onCellHover={handleCellHover}
                    />
                  </div>
                )}
              </div>

              <div className="w-full mt-4 flex items-center justify-between p-3 bg-blush-50/50 border border-blush-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-blush-500" />
                  <span className="text-xs font-bold text-slate-700">{gridSize}x{gridSize} Grid</span>
                </div>
                <span className="text-xs text-slate-500">
                  {stitchData.totalStitches} stitches
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
