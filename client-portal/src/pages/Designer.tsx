import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, AIPatternResponse } from '../services/api';
import {
  Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw,
  UploadCloud, Image, Eye, Trash2, ArrowLeft,
  Scissors, Square, ZoomIn, ZoomOut, RefreshCw, AlertTriangle,
  Copy, Eraser, Paintbrush, Pipette, FlipHorizontal, MousePointer2, Type, Ruler
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

const GRID_SIZES = [50, 75, 100, 150, 200];

/** Standard embroidery hoop diameters (inches) */
const HOOP_SIZES = [4, 5, 6, 7, 8, 10, 12];
const LARGE_HOOP_THRESHOLD = 8;   // warn if design exceeds 8"
const MAX_HOOP_THRESHOLD = 12;    // strongly warn if design exceeds 12"

/** Calculate physical inches from stitch count and fabric count */
function stitchesToInches(stitches: number, fabricCount: number): number {
  return stitches / fabricCount;
}

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

  // Material Estimator state
  const [fabricCount, setFabricCount] = useState(14);

  // ==================== GENERATE MODULE STATE ====================
  const [genFile, setGenFile] = useState<{ name: string; previewUrl: string } | null>(null);
  const [genImagePreview, setGenImagePreview] = useState<string | null>(null);
  const [selectedGenGridSize, setSelectedGenGridSize] = useState<number>(100);
  const [genResult, setGenResult] = useState<AIPatternResponse | null>(null);
  const [isGenUploading, setIsGenUploading] = useState(false);
  const [isDraggingGen, setIsDraggingGen] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // --- Material Estimation Calculations ---
  const threadPerStitchCm = 0.5;
  const threadPerStitchAdjustment = fabricCount / 14;

  const colorThreadEstimates = React.useMemo(() => {
    const counts: Record<string, { count: number; hex: string }> = {};
    Object.entries(grid).forEach(([, hex]) => {
      if (!hex) return;
      if (!counts[hex]) counts[hex] = { count: 0, hex };
      counts[hex].count++;
    });
    return Object.entries(counts).map(([hex, data]) => {
      const meters = data.count * threadPerStitchCm * threadPerStitchAdjustment / 100;
      const colorName = COLORS.find(c => c.hex === hex)?.name || hex;
      return { hex, colorName, stitchCount: data.count, meters: Math.round(meters * 100) / 100 };
    }).sort((a, b) => b.stitchCount - a.stitchCount);
  }, [grid, fabricCount]);

  const fabricEstimates = React.useMemo(() => {
    const widthInches = gridSize / fabricCount;
    const heightInches = gridSize / fabricCount;
    const fabricWidthInches = widthInches + 4;
    const fabricHeightInches = heightInches + 4;
    return {
      designWidthInches: Math.round(widthInches * 100) / 100,
      designHeightInches: Math.round(heightInches * 100) / 100,
      designWidthCm: Math.round(widthInches * 2.54 * 100) / 100,
      designHeightCm: Math.round(heightInches * 2.54 * 100) / 100,
      fabricWidthInches: Math.round(fabricWidthInches * 100) / 100,
      fabricHeightInches: Math.round(fabricHeightInches * 100) / 100,
      totalSkeins: Math.max(1, Math.ceil(colorThreadEstimates.reduce((sum, c) => sum + c.meters, 0) / 8.7)),
    };
  }, [gridSize, fabricCount, colorThreadEstimates]);

  const FABRIC_COUNTS = [11, 14, 18, 22, 25, 28, 32, 36];

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

  const handlePlaceText = useCallback(() => {
    if (!alphabetText.trim()) return;
    const font = FONTS.find(f => f.id === selectedFontId) || FONTS[0];
    renderTextToGrid(alphabetText, font, placeRow, placeCol, selectedColor, selectedStitch, gridSize, setCell);
    setAlphabetText('');
  }, [alphabetText, selectedFontId, placeRow, placeCol, selectedColor, selectedStitch, gridSize, setCell]);

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
        if (mirrorEnabled) mirrorCellEdit(row, col, selectedColor, selectedStitch);
        break;
      }
      case 'eyedropper': {
        const existingColor = grid[key];
        if (existingColor) { setSelectedColor(existingColor); setActiveTool('paint'); }
        break;
      }
      case 'clone': {
        if (!cloneSource) {
          if (grid[key]) setCloneSource({ row, col });
        } else {
          const srcKey = `${cloneSource.row},${cloneSource.col}`;
          const srcColor = grid[srcKey];
          const srcStitch = gridStitchTypes[srcKey];
          if (srcColor) {
            setCell(row, col, srcColor, srcStitch || 'cross');
            if (mirrorEnabled) mirrorCellEdit(row, col, srcColor, srcStitch || 'cross');
          }
          setCloneSource(null);
        }
        break;
      }
      default: {
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
      const result = await api.generatePatternFromText(promptInput, selectedGenGridSize, fabricCount, selectedGenGridSize / fabricCount);
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

  // ==================== GENERATE MODULE HANDLERS ====================

  const handleGenDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDraggingGen(false);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      const url = URL.createObjectURL(f);
      setGenFile({ name: f.name, previewUrl: url });
      setGenImagePreview(url);
      setGenResult(null);
      setGenError(null);
    }
  };

  const handleGenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const f = e.target.files[0];
      const url = URL.createObjectURL(f);
      setGenFile({ name: f.name, previewUrl: url });
      setGenImagePreview(url);
      setGenResult(null);
      setGenError(null);
    }
  };

  const handleGenRemove = () => {
    if (genFile?.previewUrl) URL.revokeObjectURL(genFile.previewUrl);
    setGenFile(null);
    setGenImagePreview(null);
    setGenResult(null);
    setGenError(null);
  };

  const handleGenerate = async () => {
    if (!genFile) return;
    setIsGenUploading(true);
    setGenError(null);
    setGenResult(null);
    try {
      const resp = await fetch(genFile.previewUrl);
      const blob = await resp.blob();
      const file = new File([blob], genFile.name, { type: blob.type });
      const result = await api.uploadImageToPattern(file, selectedGenGridSize);
      setGenResult(result);
    } catch (err: any) {
      setGenError(err.message || 'Generation failed');
    } finally {
      setIsGenUploading(false);
    }
  };

  const handleResize = async (newSize: number) => {
    setSelectedGenGridSize(newSize);
    if (genResult && genFile) {
      setIsGenUploading(true);
      setGenError(null);
      try {
        const resp = await fetch(genFile.previewUrl);
        const blob = await resp.blob();
        const file = new File([blob], genFile.name, { type: blob.type });
        const result = await api.uploadImageToPattern(file, newSize);
        setGenResult(result);
      } catch (err: any) {
        setGenError(err.message || 'Resize failed');
      } finally {
        setIsGenUploading(false);
      }
    }
  };

  const handleSendToCanvas = () => {
    if (genResult) {
      setAiResult(genResult);
      setGrid({});
      setGridStitchTypes({});
      // Scroll to canvas
      canvasRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

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

        {/* ==================== GENERATE MODULE: Upload + Grid Preview ==================== */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <UploadCloud className="h-5 w-5 text-blush-500" />
            <h2 className="text-lg font-bold text-slate-800">Generate from Image</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Upload clean artwork, then convert to a stitch grid. Each pixel = one stitch.</p>

          {/* Upload Drop Zone */}
          {!genFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingGen(true); }}
              onDragLeave={() => setIsDraggingGen(false)}
              onDrop={handleGenDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${isDraggingGen ? 'border-blush-500 bg-blush-50/50' : 'border-blush-200 hover:bg-blush-50/50'}`}
            >
              <input type="file" id="gen-file-upload" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleGenFileChange} />
              <label htmlFor="gen-file-upload" className="cursor-pointer block space-y-3">
                <UploadCloud className="h-10 w-10 mx-auto text-blush-400" />
                <span className="block text-sm font-bold text-slate-700">Drag & drop your artwork here</span>
                <span className="block text-xs text-slate-400">or click to browse (PNG, JPEG, WebP, GIF)</span>
              </label>
            </div>
          ) : (
            <div className="space-y-5">
              {/* File info + remove */}
              <div className="flex items-center justify-between p-3 bg-blush-50/50 rounded-xl border border-blush-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-blush-100 flex items-center justify-center text-blush-600 shrink-0 font-bold text-xs uppercase">IMG</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{genFile.name}</p>
                  </div>
                </div>
                <button onClick={handleGenRemove} disabled={isGenUploading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Grid Size Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-slate-700">Grid Size (each cell = one stitch)</label>
                  <select
                    value={fabricCount}
                    onChange={(e) => setFabricCount(Number(e.target.value))}
                    className="rounded-lg border-blush-100 text-[10px] font-bold text-slate-600 px-2 py-1 border bg-white focus:border-blush-500 focus:ring-blush-500"
                  >
                    {FABRIC_COUNTS.map((count) => (
                      <option key={count} value={count}>{count}ct fabric</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GRID_SIZES.map((size) => {
                    const physicalInches = stitchesToInches(size, fabricCount);
                    const isLarge = physicalInches > LARGE_HOOP_THRESHOLD;
                    const isTooBig = physicalInches > MAX_HOOP_THRESHOLD;
                    return (
                      <button
                        key={size}
                        onClick={() => { setSelectedGenGridSize(size); }}
                        className={`relative px-4 py-2.5 rounded-lg text-sm font-bold border transition-all group ${
                          selectedGenGridSize === size
                            ? 'bg-blush-500 text-white border-blush-500 shadow-md'
                            : isTooBig
                            ? 'bg-amber-50 text-slate-700 border-amber-200 hover:bg-amber-100'
                            : isLarge
                            ? 'bg-amber-50/50 text-slate-700 border-amber-100 hover:bg-amber-50'
                            : 'bg-white text-slate-700 border-blush-100 hover:bg-blush-50'
                        }`}
                      >
                        <div className="flex flex-col items-center leading-tight">
                          <span>{size}×{size}</span>
                          <span className={`text-[9px] font-medium ${selectedGenGridSize === size ? 'text-white/80' : isTooBig ? 'text-amber-600' : isLarge ? 'text-amber-500' : 'text-slate-400'}`}>
                            ~{physicalInches.toFixed(1)}″
                          </span>
                        </div>
                        {isTooBig && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none shadow-sm">
                            !
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Hoop-size warning */}
                {(() => {
                  const selectedInches = stitchesToInches(selectedGenGridSize, fabricCount);
                  if (selectedInches > MAX_HOOP_THRESHOLD) {
                    return (
                      <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-800">Too large for standard hoops</p>
                          <p className="text-[10px] text-amber-700">
                            {selectedGenGridSize}×{selectedGenGridSize} on {fabricCount}ct = {selectedInches.toFixed(1)}″. 
                            Largest standard hoop is {MAX_HOOP_THRESHOLD}″. Consider a smaller grid or finer fabric ({'>'}{Math.ceil(selectedGenGridSize / MAX_HOOP_THRESHOLD)}ct).
                          </p>
                        </div>
                      </div>
                    );
                  }
                  if (selectedInches > LARGE_HOOP_THRESHOLD) {
                    return (
                      <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700">
                          {selectedInches.toFixed(1)}″ design — requires a large ({'>'}{LARGE_HOOP_THRESHOLD}″) hoop.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenUploading}
                className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 text-white font-semibold text-sm px-6 py-3 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenUploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Generate Stitch Grid
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {genError && (
            <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <p className="text-xs text-rose-800">{genError}</p>
            </div>
          )}
        </div>

        {/* ==================== SPLIT VIEW: Artwork + Stitch Grid ==================== */}
        {genResult && genImagePreview && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg shadow-blush-100/50 border border-blush-100 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Layers className="h-5 w-5 text-blush-500" /> Preview
              </h3>
              <div className="flex items-center gap-3">
                {/* Re-size buttons */}
                <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                  {GRID_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => handleResize(size)}
                      disabled={isGenUploading}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        selectedGenGridSize === size
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSendToCanvas}
                  className="rounded-xl bg-blush-500 hover:bg-blush-600 text-white text-xs font-bold px-4 py-2 shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Paintbrush className="h-3.5 w-3.5" /> Edit in Canvas
                </button>
              </div>
            </div>

            {isGenUploading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="h-8 w-8 text-blush-400 animate-spin" />
                  <p className="text-sm text-slate-500 font-semibold">Generating stitch grid...</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: Clean Artwork */}
                <div className="bg-blush-50/30 rounded-xl border border-blush-100 p-4">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-blush-500" /> Clean Artwork
                  </h4>
                  <div className="flex items-center justify-center bg-white rounded-lg border border-blush-100 p-4 min-h-[200px]">
                    <img
                      src={genImagePreview}
                      alt="Uploaded artwork"
                      className="max-w-full max-h-[300px] object-contain rounded-lg shadow-sm"
                    />
                  </div>
                </div>

                {/* RIGHT: Stitch Grid */}
                <div className="bg-blush-50/30 rounded-xl border border-blush-100 p-4">
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-blush-500" /> Stitch Grid ({selectedGenGridSize}×{selectedGenGridSize})
                  </h4>
                  <div className="flex items-center justify-center bg-white rounded-lg border border-blush-100 p-4 min-h-[200px]">
                    {genResult && (
                      <StitchGrid
                        data={toGridData(genResult)}
                        zoom={Math.min(1, 300 / selectedGenGridSize)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Stats row */}
            {genResult && !isGenUploading && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-4 p-3 bg-blush-50/50 rounded-xl border border-blush-100">
                  <span className="text-xs text-slate-600">
                    Total stitches: <strong className="text-blush-600">{genResult.totalStitches.toLocaleString()}</strong>
                  </span>
                  <span className="text-xs text-slate-600">
                    Grid: <strong className="text-slate-700">{genResult.width}×{genResult.height}</strong>
                  </span>
                  <span className="text-xs text-slate-600">
                    Colors: <strong className="text-slate-700">{genResult.dmcPalette.length}</strong>
                  </span>
                  <span className="text-xs text-slate-600">
                    Size on {genResult.fabric?.count || fabricCount}ct:{' '}
                    <strong className="text-blush-600">
                      {(genResult.fabric?.inches || stitchesToInches(selectedGenGridSize, fabricCount)).toFixed(1)}″ × {(genResult.fabric?.inches || stitchesToInches(selectedGenGridSize, fabricCount)).toFixed(1)}″
                    </strong>
                  </span>
                  <DmcLegend palette={genResult.dmcPalette} />
                </div>

                {/* Scale reference bar */}
                <div className="p-3 bg-white rounded-xl border border-blush-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Ruler className="h-3.5 w-3.5 text-blush-500" /> Scale Reference ({fabricCount}ct fabric)
                  </p>
                  <div className="space-y-2">
                    {/* Hoop sizes comparison */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 w-16 shrink-0">Hoop sizes:</span>
                      <div className="flex-1 relative h-8 bg-slate-100 rounded-md overflow-hidden">
                        {HOOP_SIZES.map((hoop, i) => {
                          const pct = (hoop / Math.max(MAX_HOOP_THRESHOLD, stitchesToInches(selectedGenGridSize, fabricCount))) * 100;
                          return (
                            <div
                              key={hoop}
                              className="absolute top-0 h-full border-r border-white/60 flex items-end justify-center pb-0.5"
                              style={{ left: `${i === 0 ? 0 : (HOOP_SIZES[i - 1] / Math.max(MAX_HOOP_THRESHOLD, stitchesToInches(selectedGenGridSize, fabricCount))) * 100}%`, width: `${pct - (i === 0 ? 0 : (HOOP_SIZES[i - 1] / Math.max(MAX_HOOP_THRESHOLD, stitchesToInches(selectedGenGridSize, fabricCount))) * 100)}%` }}
                            >
                              <span className="text-[8px] text-slate-400 font-medium">{hoop}″</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Design size bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-500 w-16 shrink-0 font-bold">Your design:</span>
                      <div className="flex-1 relative h-6 bg-slate-100 rounded-md overflow-hidden">
                        <div
                          className="absolute top-0 h-full bg-blush-400/60 rounded-md flex items-center justify-center"
                          style={{ width: `${Math.min(100, (stitchesToInches(selectedGenGridSize, fabricCount) / Math.max(MAX_HOOP_THRESHOLD, stitchesToInches(selectedGenGridSize, fabricCount))) * 100)}%` }}
                        >
                          <span className="text-[9px] font-bold text-blush-800">
                            {stitchesToInches(selectedGenGridSize, fabricCount).toFixed(1)}″
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 italic">
                    Scale bar shows hoop sizes (4″–12″) vs your design on {fabricCount}-count fabric. One stitch = {stitchesToInches(1, fabricCount).toFixed(3)}″.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== EXISTING GRID EDITOR ==================== */}
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

            {genResult?.fabricPiece && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-blush-500" /> Fabric Piece
                </h2>

                {/* Pattern vs Fabric Piece box-in-box diagram */}
                <div className="flex items-center justify-center py-2">
                  <div className="relative flex items-center justify-center"
                    style={{ width: 140, height: 140 }}>
                    {/* Outer box: fabric piece */}
                    <div className="absolute inset-0 rounded-lg border-2 border-dashed border-blush-300 bg-blush-50/30 flex items-end justify-center pb-1">
                      <span className="text-[9px] font-bold text-blush-400">
                        {genResult.fabricPiece.fabricInches}″ × {genResult.fabricPiece.fabricInches}″
                      </span>
                    </div>
                    {/* Inner box: pattern */}
                    <div className="relative rounded-md border-2 border-blush-500 bg-blush-400/20 flex items-center justify-center"
                      style={{
                        width: `${Math.max(30, (genResult.fabricPiece.patternInches / genResult.fabricPiece.fabricInches) * 120)}px`,
                        height: `${Math.max(30, (genResult.fabricPiece.patternInches / genResult.fabricPiece.fabricInches) * 120)}px`,
                      }}>
                      <span className="text-[9px] font-bold text-blush-700 text-center leading-tight">
                        Pattern<br/>{genResult.fabricPiece.patternInches}″
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dimensions summary */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-blush-50/50 rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Pattern Size</span>
                    <p className="font-bold text-slate-800">{genResult.fabricPiece.patternInches}″ × {genResult.fabricPiece.patternInches}″</p>
                    <p className="text-slate-400">{genResult.width}×{genResult.height} stitches</p>
                  </div>
                  <div className="bg-blush-50/50 rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Fabric Needed</span>
                    <p className="font-bold text-slate-800">{genResult.fabricPiece.fabricInches}″ × {genResult.fabricPiece.fabricInches}″</p>
                    <p className="text-slate-400">{genResult.fabricPiece.fabricStitches}×{genResult.fabricPiece.fabricStitches} stitches</p>
                  </div>
                </div>

                {/* Margin explanation */}
                <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                  <p className="text-[10px] text-amber-800">
                    <strong>{genResult.fabricPiece.marginInches}″ margin</strong> on all sides included.
                    This gives you room for hooping, framing, or finishing. Total fabric = pattern + {genResult.fabricPiece.marginInches * 2}″.
                  </p>
                </div>
              </div>
            )}

            {/* === MATERIAL ESTIMATOR === */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Ruler className="h-5 w-5 text-blush-500" /> Material Estimator
              </h2>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Fabric Count (stitches/inch)</label>
                <select
                  value={fabricCount}
                  onChange={(e) => setFabricCount(Number(e.target.value))}
                  className="w-full rounded-xl border-blush-100 text-sm text-slate-700 font-semibold px-3 py-2 bg-white shadow-sm focus:border-blush-500 focus:ring-blush-500"
                >
                  {FABRIC_COUNTS.map((count) => (
                    <option key={count} value={count}>{count} count — {count === 11 ? 'Coarse' : count === 14 ? 'Standard' : count === 18 ? 'Fine' : count >= 28 ? 'Extra Fine' : 'Medium'}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blush-50/50 rounded-xl p-4 border border-blush-100 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Square className="h-3.5 w-3.5 text-blush-500" /> Design Size
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Width</span>
                    <p className="font-bold text-slate-800">{fabricEstimates.designWidthInches}″ / {fabricEstimates.designWidthCm} cm</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-blush-100">
                    <span className="text-slate-400">Height</span>
                    <p className="font-bold text-slate-800">{fabricEstimates.designHeightInches}″ / {fabricEstimates.designHeightCm} cm</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  Fabric needed (with 2″ margins): {fabricEstimates.fabricWidthInches}″ × {fabricEstimates.fabricHeightInches}″
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-blush-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
                  Thread Estimate
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {colorThreadEstimates.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Add stitches to see thread estimates</p>
                  ) : (
                    colorThreadEstimates.map((c) => (
                      <div key={c.hex} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-blush-100">
                        <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="flex-1 text-[10px] font-semibold text-slate-700 truncate">{c.colorName}</span>
                        <span className="text-[10px] text-slate-500">{c.stitchCount} st</span>
                        <span className="text-[10px] font-bold text-blush-700">{c.meters}m</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-blush-100 flex justify-between text-[10px] text-slate-600">
                  <span>Total thread</span>
                  <span className="font-bold text-blush-700">{colorThreadEstimates.reduce((s, c) => s + c.meters, 0).toFixed(2)}m</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>DMC skeins needed (8.7m/skein)</span>
                  <span className="font-bold text-blush-700">~{fabricEstimates.totalSkeins} skein{fabricEstimates.totalSkeins > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
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
                      <input type="text" value={alphabetText}
                        onChange={(e) => setAlphabetText(e.target.value.toUpperCase())}
                        placeholder="TYPE TEXT"
                        className="w-28 rounded-lg border-blush-100 text-[10px] font-mono font-bold text-slate-800 uppercase px-2 py-1 border focus:border-blush-500 focus:ring-blush-500"
                        maxLength={12}
                      />
                      <select value={selectedFontId}
                        onChange={(e) => setSelectedFontId(e.target.value)}
                        className="rounded-lg border-blush-100 text-[10px] font-bold text-slate-600 px-2 py-1 border bg-white"
                      >
                        {FONTS.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                      </select>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">R:</span>
                        <input type="number" value={placeRow}
                          onChange={(e) => setPlaceRow(Math.max(0, Math.min(gridSize - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridSize - 1} />
                        <span className="text-[10px] text-slate-400">C:</span>
                        <input type="number" value={placeCol}
                          onChange={(e) => setPlaceCol(Math.max(0, Math.min(gridSize - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridSize - 1} />
                      </div>
                      <button onClick={handlePlaceText} disabled={!alphabetText.trim()}
                        className="rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-[10px] font-bold px-3 py-1.5 disabled:opacity-50 transition-all">
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
                      onZoomChange={setZoom}
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