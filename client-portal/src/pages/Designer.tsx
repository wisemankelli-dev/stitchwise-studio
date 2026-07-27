import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Download, Layers, Palette, RotateCcw,
  ArrowLeft,
  Scissors, Square, ZoomIn, ZoomOut, AlertTriangle,
  Copy, Eraser, Paintbrush, Pipette, FlipHorizontal, MousePointer2, Type, Ruler,
  RectangleHorizontal, Circle, Minus, PaintBucket, Hand, Shapes, Triangle
} from 'lucide-react';
import StitchGrid, { DmcLegend } from '../components/StitchGrid';
import type { StitchGridData, StitchCell } from '../components/StitchGrid';
import { FONTS, renderTextToGrid } from '../components/FontGlyphs';
import { stampShape, type ClipartShape } from '../data/shapes';
import ShapePicker from '../components/ShapePicker';

interface StitchStyle { id: string; name: string; description: string; }

type EditTool = 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint' | 'alphabet' | 'rectangle' | 'circle' | 'line' | 'fill' | 'pan' | 'shape' | 'half';

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
  { id: 'paint', icon: <Paintbrush className="h-3.5 w-3.5" />, label: 'Paint' },
  { id: 'rectangle', icon: <RectangleHorizontal className="h-3.5 w-3.5" />, label: 'Rect' },
  { id: 'circle', icon: <Circle className="h-3.5 w-3.5" />, label: 'Circle' },
  { id: 'line', icon: <Minus className="h-3.5 w-3.5" />, label: 'Line' },
  { id: 'fill', icon: <PaintBucket className="h-3.5 w-3.5" />, label: 'Fill' },
  { id: 'erase', icon: <Eraser className="h-3.5 w-3.5" />, label: 'Erase' },
  { id: 'eyedropper', icon: <Pipette className="h-3.5 w-3.5" />, label: 'Pick' },
  { id: 'clone', icon: <Copy className="h-3.5 w-3.5" />, label: 'Clone' },
  { id: 'mirror', icon: <FlipHorizontal className="h-3.5 w-3.5" />, label: 'Mirror' },
  { id: 'shape', icon: <Shapes className="h-3.5 w-3.5" />, label: 'Shape' },
  { id: 'alphabet', icon: <Type className="h-3.5 w-3.5" />, label: 'Text' },
  { id: 'pan', icon: <Hand className="h-3.5 w-3.5" />, label: 'Pan' },
  { id: 'half', icon: <Triangle className="h-3.5 w-3.5" />, label: 'Half' },
];

/** Canvas size presets for common project types */
const CANVAS_PRESETS: { name: string; width: number; height: number }[] = [
  { name: 'Bag Charm', width: 6, height: 6 },
  { name: 'Ornament', width: 8, height: 8 },
  { name: '5×7 Frame', width: 10, height: 14 },
  { name: '8×10 Frame', width: 16, height: 20 },
  { name: 'Pillow', width: 14, height: 14 },
  { name: 'Stocking', width: 12, height: 18 },
  { name: 'Large Pillow', width: 18, height: 18 },
  { name: 'Wall Hanging', width: 18, height: 36 },
];

/** Distance from point (px,py) to line segment (x1,y1)-(x2,y2) */
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Build a StitchGridData from the manual grid state (flat key-value records) */
function buildManualGridData(
  grid: Record<string, string>,
  stitchTypes: Record<string, string>,
  width: number,
  height: number,
): StitchGridData {
  // Note: AIPatternResponse type removed - buildManualGridData is used directly
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
  for (let r = 0; r < height; r++) {
    const row: StitchCell[] = [];
    for (let c = 0; c < width; c++) {
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
  return { grid: cells, width, height, dmcPalette, totalStitches };
}

export const Designer: React.FC = () => {
  const [gridWidth, setGridWidth] = useState(32);
  const [gridHeight, setGridHeight] = useState(32);
  const [showResizeWarning, setShowResizeWarning] = useState(false);
  const [pendingGridWidth, setPendingGridWidth] = useState(32);
  const [pendingGridHeight, setPendingGridHeight] = useState(32);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({});
  const [gridStitchTypes, setGridStitchTypes] = useState<Record<string, string>>({});
  const [cellFractions, setCellFractions] = useState<Record<string, number>>({});
  const lastSaved = useRef<Record<string, string>>({});

  // Editing Tools state
  const [activeTool, setActiveTool] = useState<EditTool>('select');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [cloneSource, setCloneSource] = useState<{ row: number; col: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Drawing tools state
  const [drawStart, setDrawStart] = useState<{ row: number; col: number } | null>(null);

  // Shape browser state
  const [selectedShape, setSelectedShape] = useState<ClipartShape | null>(null);

  // Material Estimator state
  const [fabricCount, setFabricCount] = useState(14);


  // Utility: stitches to inches based on fabric count
  const stitchesToInches = (stitches: number, count: number): number => stitches / count;

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
    const widthInches = gridWidth / fabricCount;
    const heightInches = gridHeight / fabricCount;
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
  }, [gridWidth, gridHeight, fabricCount, colorThreadEstimates]);

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
    renderTextToGrid(alphabetText, font, placeRow, placeCol, selectedColor, selectedStitch, gridWidth, gridHeight, setCell);
    setAlphabetText('');
  }, [alphabetText, selectedFontId, placeRow, placeCol, selectedColor, selectedStitch, gridWidth, gridHeight, setCell]);

  const mirrorCellEdit = useCallback((row: number, col: number, color: string, stitch: string) => {
    if (!mirrorEnabled) return;
    const mirroredRow = gridHeight - 1 - row;
    const mirroredCol = gridWidth - 1 - col;
    if (mirroredRow === row && mirroredCol === col) return;
    setCell(mirroredRow, mirroredCol, color, stitch);
  }, [mirrorEnabled, gridWidth, gridHeight, setCell]);

  const handleCellAction = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;

    switch (activeTool) {
      case 'erase': {
        clearCell(row, col);
        if (mirrorEnabled) {
          const mRow = gridHeight - 1 - row;
          const mCol = gridWidth - 1 - col;
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
      // ── Drawing Tools ──
      case 'rectangle':
      case 'circle':
      case 'line': {
        if (!drawStart) {
          setDrawStart({ row, col });
        } else {
          // Draw the shape
          const r1 = Math.min(drawStart.row, row);
          const r2 = Math.max(drawStart.row, row);
          const c1 = Math.min(drawStart.col, col);
          const c2 = Math.max(drawStart.col, col);
          const cx = (c1 + c2) / 2;
          const cy = (r1 + r2) / 2;
          const rx = Math.max(0.5, (c2 - c1) / 2);
          const ry = Math.max(0.5, (r2 - r1) / 2);

          const newFractions: Record<string, number> = {};
          for (let r = Math.floor(r1 - 1); r <= Math.ceil(r2 + 1); r++) {
            for (let c = Math.floor(c1 - 1); c <= Math.ceil(c2 + 1); c++) {
              if (activeTool === 'rectangle') {
                // Anti-aliased rectangle: sample 4 subpixel corners
                const onTop = r === r1, onBot = r === r2, onLeft = c === c1, onRight = c === c2;
                const isEdge = onTop || onBot || onLeft || onRight;
                if (!isEdge) {
                  // Interior cell: full fill
                  setCell(r, c, selectedColor, selectedStitch);
                } else {
                  // Edge cell: sample subpixel coverage
                  let hits = 0;
                  for (const [sr, sc] of [[0.25,0.25],[0.25,0.75],[0.75,0.25],[0.75,0.75]]) {
                    const pr = r + sr, pc = c + sc;
                    if (pr >= r1 && pr <= r2 && pc >= c1 && pc <= c2) hits++;
                  }
                  if (hits === 4) {
                    setCell(r, c, selectedColor, selectedStitch);
                  } else if (hits > 0) {
                    const frac = hits / 4;
                    newFractions[`${r},${c}`] = frac;
                    setCell(r, c, selectedColor, selectedStitch);
                  }
                }
              } else if (activeTool === 'circle') {
                // Compute fraction: sample 4 sub-pixel points per cell
                let hits = 0;
                for (const [sr, sc] of [[0.25,0.25],[0.25,0.75],[0.75,0.25],[0.75,0.75]]) {
                  const dx = (c + sc - cx) / rx;
                  const dy = (r + sr - cy) / ry;
                  if (dx * dx + dy * dy <= 1) hits++;
                }
                if (hits === 4) {
                  setCell(r, c, selectedColor, selectedStitch);
                } else if (hits > 0) {
                  newFractions[`${r},${c}`] = hits / 4;
                  setCell(r, c, selectedColor, selectedStitch);
                }
              } else if (activeTool === 'line') {
                const d = distToSegment(c + 0.5, r + 0.5, drawStart.col + 0.5, drawStart.row + 0.5, col + 0.5, row + 0.5);
                if (d < 1) {
                  setCell(r, c, selectedColor, selectedStitch);
                } else if (d < 1.5) {
                  newFractions[`${r},${c}`] = 0.5;
                  setCell(r, c, selectedColor, selectedStitch);
                }
              }
            }
          }
          setCellFractions(prev => ({ ...prev, ...newFractions }));
          setDrawStart(null);
        }
        break;
      }
      case 'fill': {
        // Flood fill
        const targetColor = grid[key] || '';
        const fillColor = selectedColor;
        if (targetColor === fillColor) break;
        const newGrid = { ...grid };
        const newStitchTypes = { ...gridStitchTypes };
        const stack = [{ row, col }];
        const visited = new Set<string>();
        visited.add(key);
        while (stack.length > 0) {
          const { row: r, col: c } = stack.pop()!;
          const k = `${r},${c}`;
          if ((grid[k] || '') !== targetColor) continue;
          newGrid[k] = fillColor;
          newStitchTypes[k] = selectedStitch;
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= gridHeight || nc < 0 || nc >= gridWidth) continue;
            const nk = `${nr},${nc}`;
            if (visited.has(nk)) continue;
            visited.add(nk);
            stack.push({ row: nr, col: nc });
          }
        }
        setGrid(newGrid);
        setGridStitchTypes(newStitchTypes);
        break;
      }
      case 'shape': {
        if (selectedShape) {
          const result = stampShape(grid, gridStitchTypes, selectedShape, row, col, selectedColor, selectedStitch, gridWidth, gridHeight);
          setGrid(result.grid);
          setGridStitchTypes(result.stitchTypes);
        }
        break;
      }
      case 'pan': {
        // Pan is handled by scroll — no-op on cell click
        break;
      }
      case 'half': {
        // Half-stitch: cycle empty → 0.5 fraction → full → empty
        const currentFrac = cellFractions[key];
        if (!grid[key]) {
          // Empty → half-fill
          setCell(row, col, selectedColor, selectedStitch);
          setCellFractions(prev => ({ ...prev, [key]: 0.5 }));
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              setCell(mRow, mCol, selectedColor, selectedStitch);
              setCellFractions(prev => ({ ...prev, [`${mRow},${mCol}`]: 0.5 }));
            }
          }
        } else if (currentFrac === 0.5) {
          // Half → full (remove fraction)
          setCellFractions(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              setCellFractions(prev => {
                const next = { ...prev };
                delete next[`${mRow},${mCol}`];
                return next;
              });
            }
          }
        } else {
          // Full → empty
          clearCell(row, col);
          setCellFractions(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          if (mirrorEnabled) {
            const mRow = gridHeight - 1 - row;
            const mCol = gridWidth - 1 - col;
            if (mRow !== row || mCol !== col) {
              clearCell(mRow, mCol);
              setCellFractions(prev => {
                const next = { ...prev };
                delete next[`${mRow},${mCol}`];
                return next;
              });
            }
          }
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
          const mRow = gridHeight - 1 - row;
          const mCol = gridWidth - 1 - col;
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
  }, [activeTool, clearCell, cloneSource, grid, gridStitchTypes, gridWidth, gridHeight, mirrorCellEdit, mirrorEnabled, selectedColor, selectedStitch, setCell, drawStart, selectedShape, cellFractions]);

  const handleCellHover = useCallback((row: number, col: number) => {
    if (!isMouseDown) return;
    if (activeTool === 'paint') {
      setCell(row, col, selectedColor, selectedStitch);
      if (mirrorEnabled) mirrorCellEdit(row, col, selectedColor, selectedStitch);
    } else if (activeTool === 'erase') {
      clearCell(row, col);
      if (mirrorEnabled) {
        const mRow = gridHeight - 1 - row;
        const mCol = gridWidth - 1 - col;
        if (mRow !== row || mCol !== col) clearCell(mRow, mCol);
      }
    } else if (activeTool === 'half') {
      // On drag: set half-fill if cell is empty
      const key = `${row},${col}`;
      if (!grid[key]) {
        setCell(row, col, selectedColor, selectedStitch);
        setCellFractions(prev => ({ ...prev, [key]: 0.5 }));
      }
    }
  }, [activeTool, clearCell, isMouseDown, mirrorCellEdit, mirrorEnabled, selectedColor, selectedStitch, setCell, grid, gridWidth, gridHeight]);

  const handleClearGrid = () => {
    setGrid({}); setGridStitchTypes({});
    setCloneSource(null);
  };

  // Canvas resize logic
  const hasStitchesOutside = (newW: number, newH: number): boolean => {
    for (const key of Object.keys(grid)) {
      if (!grid[key]) continue;
      const [r, c] = key.split(',').map(Number);
      if (r >= newH || c >= newW) return true;
    }
    return false;
  };

  const applyResize = (newW: number, newH: number) => {
    // Clip any stitches outside the new bounds
    const newGrid: Record<string, string> = {};
    const newStitchTypes: Record<string, string> = {};
    for (const key of Object.keys(grid)) {
      if (!grid[key]) continue;
      const [r, c] = key.split(',').map(Number);
      if (r < newH && c < newW) {
        newGrid[key] = grid[key];
        if (gridStitchTypes[key]) newStitchTypes[key] = gridStitchTypes[key];
      }
    }
    setGrid(newGrid);
    setGridStitchTypes(newStitchTypes);
    setGridWidth(newW);
    setGridHeight(newH);
    setShowResizeWarning(false);
  };

  const requestResize = (newW: number, newH: number) => {
    setPendingGridWidth(newW);
    setPendingGridHeight(newH);
    if (hasStitchesOutside(newW, newH)) {
      setShowResizeWarning(true);
    } else {
      applyResize(newW, newH);
    }
  };


  const stitchData: StitchGridData = buildManualGridData(grid, gridStitchTypes, gridWidth, gridHeight);

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

  // Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'bg-gradient-to-b from-white via-blush-50/30 to-white min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden'}`}>
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
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">Design perfect patterns stitch by stitch.</p>
        </div>


        {/* ==================== EXISTING GRID EDITOR ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT PANEL */}
          <div className="lg:col-span-4 space-y-6">

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

            {/* === CANVAS SIZE CONTROLS === */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 shadow-lg shadow-blush-100/50 border border-blush-100 space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Ruler className="h-5 w-5 text-blush-500" /> Canvas Size
              </h2>

              {/* Resize warning */}
              {showResizeWarning && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-800">Stitches will be lost</p>
                      <p className="text-[10px] text-amber-700">
                        Resizing to {pendingGridWidth}×{pendingGridHeight} will remove stitches outside the new bounds.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyResize(pendingGridWidth, pendingGridHeight)}
                      className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold py-1.5 transition-all"
                    >
                      Resize & Clip
                    </button>
                    <button
                      onClick={() => setShowResizeWarning(false)}
                      className="flex-1 rounded-lg bg-white border border-amber-200 text-amber-700 text-[10px] font-bold py-1.5 hover:bg-amber-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Preset sizes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Preset Sizes</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CANVAS_PRESETS.map((preset) => {
                    const isActive = gridWidth === preset.width && gridHeight === preset.height;
                    const physW = stitchesToInches(preset.width, fabricCount);
                    const physH = stitchesToInches(preset.height, fabricCount);
                    return (
                      <button
                        key={preset.name}
                        onClick={() => requestResize(preset.width, preset.height)}
                        className={`px-2.5 py-2 rounded-lg text-left border transition-all ${
                          isActive
                            ? 'bg-blush-500 text-white border-blush-500 shadow-sm'
                            : 'bg-white text-slate-700 border-blush-100 hover:bg-blush-50'
                        }`}
                      >
                        <div className="text-[10px] font-bold leading-tight">{preset.name}</div>
                        <div className={`text-[9px] ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                          {preset.width}×{preset.height} · {physW.toFixed(1)}″×{physH.toFixed(1)}″ on {fabricCount}ct
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual size inputs */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Custom Size</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">W:</span>
                    <input
                      type="number"
                      value={gridWidth}
                      onChange={(e) => {
                        const v = Math.max(6, Math.min(200, Number(e.target.value) || 6));
                        requestResize(v, gridHeight);
                      }}
                      className="w-14 rounded-lg border-blush-100 text-[11px] font-bold text-slate-700 px-2 py-1.5 border text-center focus:border-blush-500 focus:ring-blush-500"
                      min={6} max={200}
                    />
                  </div>
                  <span className="text-slate-300 font-bold">×</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">H:</span>
                    <input
                      type="number"
                      value={gridHeight}
                      onChange={(e) => {
                        const v = Math.max(6, Math.min(200, Number(e.target.value) || 6));
                        requestResize(gridWidth, v);
                      }}
                      className="w-14 rounded-lg border-blush-100 text-[11px] font-bold text-slate-700 px-2 py-1.5 border text-center focus:border-blush-500 focus:ring-blush-500"
                      min={6} max={200}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Physical size on {fabricCount}ct: {stitchesToInches(gridWidth, fabricCount).toFixed(1)}″ × {stitchesToInches(gridHeight, fabricCount).toFixed(1)}″
                  {gridWidth !== gridHeight && <span className="text-amber-500 ml-1">(non-square)</span>}
                </p>
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


            {/* === SHAPE BROWSER === */}
            <ShapePicker
              selectedShape={selectedShape}
              selectedColor={selectedColor}
              onSelectShape={(shape) => {
                setSelectedShape(shape);
                setActiveTool('shape');
              }}
            />

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
                  {activeTool === 'half' && (
                    <span className="text-[10px] text-slate-500 italic">Click to cycle: empty → ½ → full</span>
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
                          onChange={(e) => setPlaceRow(Math.max(0, Math.min(gridHeight - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridHeight - 1} />
                        <span className="text-[10px] text-slate-400">C:</span>
                        <input type="number" value={placeCol}
                          onChange={(e) => setPlaceCol(Math.max(0, Math.min(gridWidth - 1, Number(e.target.value))))}
                          className="w-10 rounded-lg border-blush-100 text-[10px] text-slate-700 px-1 py-1 border text-center" min={0} max={gridWidth - 1} />
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
                <div className="w-full">
                    <StitchGrid
                      data={stitchData}
                      zoom={zoom}
                      onCellClick={handleCellAction}
                      activeTool={activeTool}
                      isMouseDown={isMouseDown}
                      onCellHover={handleCellHover}
                      onZoomChange={setZoom}
                      isFullscreen={isFullscreen}
                      onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                      cellFractions={cellFractions}
                    />
                </div>
              </div>

              <div className="w-full mt-4 flex items-center justify-between p-3 bg-blush-50/50 border border-blush-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-blush-500" />
                  <span className="text-xs font-bold text-slate-700">{gridWidth}×{gridHeight} Grid</span>
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