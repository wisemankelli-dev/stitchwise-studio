import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, QuiltBlockDesign, QuiltBlockShape } from '../services/api';
import {
  RotateCcw, ZoomIn, ZoomOut, Grid3X3,
  Palette, Download, Save, Trash2, Loader2,
  Flower2, Square, Triangle, Circle, Octagon, RectangleHorizontal,
  Diamond, Pentagon, Hexagon, Copy, BringToFront, LayoutGrid, FolderOpen,
  ChevronDown, Image, Scissors,
} from 'lucide-react';

type ShapeType = 'square' | 'rectangle' | 'triangle' | 'circle' | 'diamond' | 'octagon' | 'pentagon' | 'hexagon' | 'hst' | 'qst';

interface BlockShape {
  id: string;
  type: ShapeType;
  color: string;
  pattern: string;
  /** Free-position model (owner redesign): top-left in canvas px, movable anywhere. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  scale: number; // 0.2 – 3.0 multiplier (kept in sync with width/height)
  zIndex: number;
  /** Legacy grid fields — populated only for pre-redesign saves. */
  gridX?: number;
  gridY?: number;
  size?: number;
}

const FABRIC_COLORS = [
  '#ffffff', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
  '#ec4899', '#db2777', '#86efac', '#fef3c7', '#bfdbfe',
  '#c4b5fd', '#fca5a5', '#d9f99d', '#fed7aa', '#e2e8f0',
  '#1e293b',
];

const FABRIC_PATTERNS = [
  { id: 'solid', name: 'Solid' },
  { id: 'polka', name: 'Polka Dot' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'plaid', name: 'Plaid' },
];

/** Owner spec: 6×6, 8×8, 10×10, 12×12 inch blocks ONLY. */
const BLOCK_SIZES = [6, 8, 10, 12];

/** Shapes library — click a shape to add it to the block (owner spec). */
const SHAPE_LIBRARY: { type: ShapeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'square', label: 'Square', icon: Square },
  { type: 'rectangle', label: 'Rectangle', icon: RectangleHorizontal },
  { type: 'triangle', label: 'Triangle', icon: Triangle },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'diamond', label: 'Diamond', icon: Diamond },
  { type: 'octagon', label: 'Octagon', icon: Octagon },
  { type: 'pentagon', label: 'Pentagon', icon: Pentagon },
  { type: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { type: 'hst', label: 'Half-Square Tri.', icon: Triangle },
  { type: 'qst', label: 'Quarter-Square Tri.', icon: Scissors },
];

const GRID_OFFSET = 20;

/** Adaptive cell size so the biggest block (12×12) still fits the canvas. */
const cellPxFor = (n: number) => Math.min(50, Math.floor(440 / n));

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Regular n-gon points in a w×h box (flat-bottomed, centered). */
const regularPolygon = (n: number, w: number, h: number): [number, number][] => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
};

/** Shape outline points in local (unrotated) coords. Circle is handled separately. */
const shapePoints = (type: ShapeType, w: number, h: number): [number, number][] => {
  switch (type) {
    case 'square':
      return [[0, 0], [w, 0], [w, h], [0, h]];
    case 'rectangle':
      return [[0, 0], [w, 0], [w, h], [0, h]];
    case 'triangle':
      return [[0, h], [w, h], [w / 2, 0]];
    case 'hst':
      return [[0, 0], [w, 0], [w, h]];
    case 'qst':
      return [[0, 0], [w, 0], [0, h]];
    case 'diamond':
      return [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]];
    case 'octagon': {
      const s = Math.min(w, h) * 0.293;
      return [[s, 0], [w - s, 0], [w, s], [w, h - s], [w - s, h], [s, h], [0, h - s], [0, s]];
    }
    case 'pentagon':
      return regularPolygon(5, w, h);
    case 'hexagon':
      return regularPolygon(6, w, h);
    default:
      return [[0, 0], [w, 0], [w, h], [0, h]];
  }
};

/** Rotate a point around (cx, cy). */
const rotatePoint = (px: number, py: number, cx: number, cy: number, rad: number): [number, number] => {
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
};

/** SVG pattern defs shared by all shapes (patterns render in the shape's own fabric color). */
const PatternDefs: React.FC = () => (
  <svg width={0} height={0} className="absolute" aria-hidden="true">
    <defs>
      <pattern id="pat-polka" width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2.5" cy="2.5" r="1.4" fill="currentColor" />
      </pattern>
      <pattern id="pat-stripe" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="3" height="10" fill="currentColor" />
      </pattern>
      <pattern id="pat-plaid" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="3" height="12" fill="currentColor" />
        <rect x="0" y="0" width="12" height="3" fill="currentColor" />
      </pattern>
    </defs>
  </svg>
);

/** Renders one quilt shape with fabric color + texture pattern. */
const ShapeSvg: React.FC<{ shape: BlockShape }> = ({ shape }) => {
  const { width: w, height: h, color, pattern, type } = shape;
  const patternFill = pattern !== 'solid' ? `url(#pat-${pattern})` : undefined;
  const stroke = { stroke: 'rgba(0,0,0,0.18)', strokeWidth: 1 };
  const showDiagonal = type === 'hst' || type === 'qst';
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="block select-none pointer-events-none"
      style={{ color }}
    >
      {type === 'circle' ? (
        <>
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 1} fill={color} {...stroke} />
          {patternFill && <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - 1} fill={patternFill} opacity={0.35} />}
        </>
      ) : (
        <>
          <polygon points={shapePoints(type, w, h).map(p => p.join(',')).join(' ')} fill={color} {...stroke} />
          {patternFill && <polygon points={shapePoints(type, w, h).map(p => p.join(',')).join(' ')} fill={patternFill} opacity={0.35} />}
        </>
      )}
      {showDiagonal && <line x1={0} y1={0} x2={w} y2={h} stroke="rgba(0,0,0,0.22)" strokeWidth="1" strokeDasharray="4,3" />}
    </svg>
  );
};

/** Migrate a shape loaded from the server (legacy grid model → free-position model). */
export const migrateShape = (s: any): BlockShape => {
  if (typeof s.x === 'number' && typeof s.width === 'number') {
    return {
      id: s.id, type: s.type, color: s.color, pattern: s.pattern,
      x: s.x, y: s.y, width: s.width, height: typeof s.height === 'number' ? s.height : s.width,
      rotation: s.rotation ?? 0, scale: s.scale ?? 1, zIndex: s.zIndex ?? 0,
    };
  }
  // Legacy: gridX/gridY/size (grid units @ fixed 50px cell)
  const cell = 50;
  const size = (s.size ?? 2) * cell;
  return {
    id: s.id, type: s.type as ShapeType, color: s.color, pattern: s.pattern,
    x: (s.gridX ?? 0) * cell, y: (s.gridY ?? 0) * cell,
    width: size, height: size,
    rotation: s.rotation ?? 0, scale: 1, zIndex: s.zIndex ?? 0,
  };
};

type DragOp =
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string; startX: number; startY: number; startW: number; startH: number }
  | { kind: 'rotate'; id: string; centerX: number; centerY: number; startAngle: number };

export const QuiltBlockStudio: React.FC = () => {
  const [shapes, setShapes] = useState<BlockShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string>('');
  const [blockSize, setBlockSize] = useState<number>(8);
  const [zoom, setZoom] = useState(1);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [dragOp, setDragOp] = useState<DragOp | null>(null);
  // Save/Load state
  const [blockName, setBlockName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedBlocks, setSavedBlocks] = useState<QuiltBlockDesign[]>([]);
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  const movedRef = useRef(false);

  const cellPx = cellPxFor(blockSize);
  const gridPx = blockSize * cellPx;
  const logicalW = gridPx + GRID_OFFSET * 2;
  const logicalH = gridPx + GRID_OFFSET * 2;
  const selectedShape = shapes.find(s => s.id === selectedShapeId) ?? null;

  const updateShape = useCallback((id: string, updates: Partial<BlockShape>) => {
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const deleteShape = useCallback((id: string) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    setSelectedShapeId(prev => (prev === id ? '' : prev));
  }, []);

  /** Map a client pointer position into the grid's logical coordinate space.
   *  Uses the zoomed grid element's own rect, so the math is correct at ANY zoom
   *  (this was the root cause of the old silent placement failure). */
  const toLogical = useCallback((clientX: number, clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / (rect.width / logicalW),
      y: (clientY - rect.top) / (rect.height / logicalH),
    };
  }, [logicalW, logicalH]);

  /** Add a shape from the library — centered on the block, immediately selected. */
  const addShape = useCallback((type: ShapeType) => {
    const size = Math.max(40, cellPxFor(blockSize) * 2);
    const cascade = (shapesRef.current.length % 6) * 14;
    const newId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setShapes(prev => {
      const s: BlockShape = {
        id: newId,
        type,
        color: '#fbcfe8',
        pattern: 'solid',
        x: Math.round((gridPx - size) / 2) + cascade,
        y: Math.round((gridPx - size) / 2) + cascade,
        width: size,
        height: type === 'rectangle' ? Math.round(size * 0.6) : size,
        rotation: 0,
        scale: 1,
        zIndex: prev.length + 1,
      };
      return [...prev, s];
    });
    setSelectedShapeId(newId);
  }, [blockSize, gridPx]);

  const duplicateShape = useCallback((id: string) => {
    const src = shapesRef.current.find(s => s.id === id);
    if (!src) return;
    const copyId = `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setShapes(prev => {
      const copy: BlockShape = { ...src, id: copyId, x: src.x + 16, y: src.y + 16, zIndex: prev.length + 1 };
      return [...prev, copy];
    });
    setSelectedShapeId(copyId);
  }, []);

  const bringToFront = useCallback((id: string) => {
    setShapes(prev => {
      const maxZ = prev.reduce((m, s) => Math.max(m, s.zIndex), 0);
      return prev.map(s => (s.id === id ? { ...s, zIndex: maxZ + 1 } : s));
    });
  }, []);

  const handleReset = useCallback(() => {
    setShapes([]);
    setSelectedShapeId('');
  }, []);

  // ── Pointer interactions (move / resize / rotate) ──
  const startMove = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedShapeId(id);
    movedRef.current = false;
    const pt = toLogical(e.clientX, e.clientY);
    const s = shapesRef.current.find(sh => sh.id === id);
    if (!pt || !s) return;
    setDragOp({ kind: 'move', id, dx: pt.x - s.x, dy: pt.y - s.y });
  };

  const startResize = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedShapeId(id);
    movedRef.current = false;
    const pt = toLogical(e.clientX, e.clientY);
    const s = shapesRef.current.find(sh => sh.id === id);
    if (!pt || !s) return;
    setDragOp({ kind: 'resize', id, startX: pt.x, startY: pt.y, startW: s.width, startH: s.height });
  };

  const startRotate = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedShapeId(id);
    movedRef.current = false;
    const s = shapesRef.current.find(sh => sh.id === id);
    if (!s) return;
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    // Rotated position of the top-center handle, in canvas space.
    const [hx, hy] = rotatePoint(s.x + s.width / 2, s.y, cx, cy, (s.rotation * Math.PI) / 180);
    const handleAngle = (Math.atan2(hy - cy, hx - cx) * 180) / Math.PI;
    setDragOp({ kind: 'rotate', id, centerX: cx, centerY: cy, startAngle: s.rotation - handleAngle });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragOp) return;
    movedRef.current = true;
    const pt = toLogical(e.clientX, e.clientY);
    if (!pt) return;
    if (dragOp.kind === 'move') {
      let nx = pt.x - dragOp.dx;
      let ny = pt.y - dragOp.dy;
      if (snapEnabled) {
        nx = Math.round(nx / cellPx) * cellPx;
        ny = Math.round(ny / cellPx) * cellPx;
      }
      updateShape(dragOp.id, { x: clamp(nx, -logicalW, logicalW), y: clamp(ny, -logicalH, logicalH) });
    } else if (dragOp.kind === 'resize') {
      const s = shapesRef.current.find(sh => sh.id === dragOp.id);
      if (!s) return;
      const rad = (s.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = pt.x - dragOp.startX;
      const dy = pt.y - dragOp.startY;
      // Inverse-rotate the pointer delta into the shape's local frame.
      const ldx = dx * cos + dy * sin;
      const ldy = -dx * sin + dy * cos;
      let nw = Math.max(16, dragOp.startW + ldx);
      let nh = Math.max(16, dragOp.startH + ldy);
      if (s.type !== 'rectangle') nh = nw; // keep aspect for fixed shapes
      updateShape(dragOp.id, {
        width: nw,
        height: nh,
        scale: s.scale * (nw / dragOp.startW),
      });
    } else if (dragOp.kind === 'rotate') {
      const s = shapesRef.current.find(sh => sh.id === dragOp.id);
      if (!s) return;
      const cx = s.x + s.width / 2;
      const cy = s.y + s.height / 2;
      const angle = dragOp.startAngle + (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI;
      updateShape(dragOp.id, { rotation: Math.round(angle) });
    }
  };

  const handlePointerUp = () => setDragOp(null);

  // Keyboard: Delete/Backspace removes selected shape, Escape deselects.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        e.preventDefault();
        deleteShape(selectedShapeId);
      } else if (e.key === 'Escape') {
        setSelectedShapeId('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedShapeId, deleteShape]);

  // ── Persistence ──
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
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        rotation: s.rotation,
        scale: s.scale,
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
      setShowLoadDropdown(prev => !prev);
    } catch {
      setSavedBlocks([]);
      setShowLoadDropdown(prev => !prev);
    }
  };

  const handleLoadBlock = async (id: string) => {
    try {
      const block = await api.loadQuiltBlock(id);
      if (!block) return;
      setShapes(block.shapes.map(migrateShape));
      setSelectedShapeId('');
      if (BLOCK_SIZES.includes(block.blockSize)) setBlockSize(block.blockSize);
      setBlockName(block.name);
      setShowLoadDropdown(false);
    } catch {
      setSaveMessage('Load failed.');
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  const handleDeleteBlock = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteQuiltBlock(id);
    setSavedBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleBlockSizeChange = (s: number) => {
    if (s === blockSize) return;
    const newCell = cellPxFor(s);
    const factor = newCell / cellPx;
    setBlockSize(s);
    setShapes(prev => prev.map(sh => ({
      ...sh,
      x: sh.x * factor,
      y: sh.y * factor,
      width: Math.max(16, sh.width * factor),
      height: Math.max(16, sh.height * factor),
    })));
  };

  // ── Export helpers ──
  const hexToRgb = (hex: string): [number, number, number] => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
  };

  /** Trace the shape's outline as a canvas 2D path (local coords). */
  const traceShapePath = (ctx: CanvasRenderingContext2D, s: BlockShape) => {
    ctx.beginPath();
    if (s.type === 'circle') {
      ctx.arc(s.width / 2, s.height / 2, Math.min(s.width, s.height) / 2 - 1, 0, Math.PI * 2);
    } else {
      const pts = shapePoints(s.type, s.width, s.height);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    }
  };

  const drawCanvasPattern = (ctx: CanvasRenderingContext2D, s: BlockShape) => {
    if (s.pattern === 'solid') return;
    const { width: w, height: h } = s;
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = s.color;
    if (s.pattern === 'polka') {
      for (let y = 0; y <= h; y += 10) {
        for (let x = 0; x <= w; x += 10) {
          ctx.beginPath();
          ctx.arc(x + 2.5, y + 2.5, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (s.pattern === 'stripe') {
      for (let x = 0; x <= w; x += 10) ctx.fillRect(x, 0, 3, h);
    } else if (s.pattern === 'plaid') {
      for (let x = 0; x <= w; x += 12) ctx.fillRect(x, 0, 3, h);
      for (let y = 0; y <= h; y += 12) ctx.fillRect(0, y, w, 3);
    }
    ctx.restore();
  };

  const handleExportPng = () => {
    const scale = 4; // crisp print resolution
    const canvas = document.createElement('canvas');
    canvas.width = logicalW * scale;
    canvas.height = logicalH * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.translate(GRID_OFFSET, GRID_OFFSET);
    // Grid lines
    ctx.strokeStyle = '#fce7f3';
    ctx.lineWidth = 1;
    for (let i = 0; i <= blockSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellPx, 0);
      ctx.lineTo(i * cellPx, gridPx);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellPx);
      ctx.lineTo(gridPx, i * cellPx);
      ctx.stroke();
    }
    // Block border
    ctx.strokeStyle = '#f9a8d4';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, gridPx, gridPx);
    // Shapes (top-left origin → local coords; rotation around center)
    shapes.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(s => {
      ctx.save();
      ctx.translate(s.x + s.width / 2, s.y + s.height / 2);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.translate(-s.width / 2, -s.height / 2);
      traceShapePath(ctx, s);
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawCanvasPattern(ctx, s);
      if (s.type === 'hst' || s.type === 'qst') {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s.width, s.height);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    });
    const a = document.createElement('a');
    a.download = `${(blockName.trim() || 'quilt-block').replace(/\s+/g, '-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const title = (blockName.trim() || 'quilt-block').replace(/\s+/g, '-');
      doc.setFontSize(16);
      doc.setTextColor(139, 92, 118);
      doc.text(title, 20, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Block Size: ${blockSize} x ${blockSize} (finished ${blockSize * 2}" x ${blockSize * 2}")`, 20, 28);

      // Block diagram
      const cellMm = Math.min(140 / blockSize, 16);
      const ox = 35;
      const oy = 40;
      const k = cellMm / cellPx; // logical px → mm
      doc.setDrawColor(220, 200, 210);
      for (let g = 0; g <= blockSize; g++) {
        doc.line(ox, oy + g * cellMm, ox + blockSize * cellMm, oy + g * cellMm);
        doc.line(ox + g * cellMm, oy, ox + g * cellMm, oy + blockSize * cellMm);
      }
      const drawPoly = (pts: [number, number][], style: 'F' | 'FD' = 'F') => {
        const flat = pts.flat();
        if (typeof (doc as any).polygon === 'function') {
          (doc as any).polygon(...flat, style);
          return;
        }
        const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]] as [number, number]);
        doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, true);
      };
      shapes.slice().sort((a, b) => a.zIndex - b.zIndex).forEach(s => {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        const rad = (s.rotation * Math.PI) / 180;
        const [r, g, b] = hexToRgb(s.color);
        doc.setFillColor(r, g, b);
        doc.setDrawColor(150, 150, 150);
        if (s.type === 'circle') {
          doc.circle(ox + cx * k, oy + cy * k, (Math.min(s.width, s.height) / 2 - 1) * k, 'FD');
        } else {
          const local = shapePoints(s.type, s.width, s.height);
          const world = local.map(([px, py]) => {
            const [wx, wy] = rotatePoint(px, py, cx, cy, rad);
            return [ox + wx * k, oy + wy * k] as [number, number];
          });
          drawPoly(world, 'FD');
          if (s.type === 'hst' || s.type === 'qst') {
            doc.setDrawColor(120, 120, 120);
            doc.setLineDashPattern([1.5, 1], 0);
            doc.line(ox + s.x * k, oy + s.y * k, ox + (s.x + s.width) * k, oy + (s.y + s.height) * k);
            doc.setLineDashPattern([], 0);
          }
        }
      });

      // Fabric Key
      const keyY = oy + blockSize * cellMm + 14;
      doc.setFontSize(12);
      doc.setTextColor(139, 92, 118);
      doc.text('Fabric Key', 20, keyY);
      const keys = [...new Set(shapes.map(s => s.color))];
      keys.forEach((color, i) => {
        const ky = keyY + 8 + i * 7;
        const [r, g, b] = hexToRgb(color);
        doc.setFillColor(r, g, b);
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
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      ['Shape', 'Type', 'Size', 'Qty'].forEach((h, i) => doc.text(h, 20 + i * 35, guideY));
      doc.setDrawColor(180, 180, 180);
      doc.line(20, guideY + 2, 20 + 140, guideY + 2);
      const inchPerPx = 2 / cellPx;
      const sizeLabel = (s: BlockShape) => `${(s.width * inchPerPx).toFixed(1)}" x ${(s.height * inchPerPx).toFixed(1)}"`;
      shapes.forEach((s, i) => {
        const ry = guideY + 6 + i * 6;
        doc.text(String(i + 1), 20, ry);
        doc.text(s.type.replace(/-/g, ' '), 55, ry);
        doc.text(sizeLabel(s), 90, ry);
        doc.text('1', 125, ry);
      });
      doc.save(`${title}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      setSaveMessage('Export failed');
      setTimeout(() => setSaveMessage(null), 2000);
    }
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
              {/* Save/Load/Export controls */}
              <div className="flex items-center gap-2 relative">
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
                  className="btn-floral-ghost text-xs py-1.5 px-3 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <div className="relative">
                  <button
                    onClick={handleLoadBlocks}
                    className="btn-floral-ghost text-xs py-1.5 px-3 flex items-center"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Load
                    <ChevronDown className="h-3 w-3 ml-1" />
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
                <button onClick={handleExportPng} className="btn-floral-ghost text-xs py-1.5 px-3 flex items-center" title="Download PNG image">
                  <Image className="h-3.5 w-3.5 mr-1" />
                  PNG
                </button>
                <button onClick={handleExportPdf} className="btn-floral-primary text-xs py-1.5 px-3" title="Download PDF pattern">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  PDF
                </button>
              </div>
              {saveMessage && (
                <p className={`text-[10px] px-2 py-0.5 rounded ${saveMessage.startsWith('Save failed') || saveMessage.startsWith('Export') || saveMessage.startsWith('Load') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Canvas (7 cols) */}
          <div className="lg:col-span-7">
            <div className="floral-card p-4">
              {/* Shapes Library (owner spec: click a shape to add it) */}
              <div className="mb-4 pb-3 border-b border-blush-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Shapes Library</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {SHAPE_LIBRARY.map(s => (
                    <button
                      key={s.type}
                      onClick={() => addShape(s.type)}
                      title={`Add ${s.label} to the block`}
                      className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border border-blush-100 bg-white text-slate-600 hover:border-blush-400 hover:bg-blush-50 hover:text-blush-700 transition-all"
                    >
                      <s.icon className="h-4 w-4" />
                      <span className="text-[9px] font-semibold leading-none">{s.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Click a shape to add it — then drag it anywhere, use the corner handle to resize, the top handle to rotate. Double-click a shape to duplicate it. Press Delete to remove.
                </p>
              </div>

              {/* Canvas Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="btn-floral-ghost p-1.5" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
                  <span className="text-xs font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="btn-floral-ghost p-1.5" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
                  <button onClick={() => setZoom(1)} className="btn-floral-ghost p-1.5" title="Reset zoom"><RotateCcw className="h-4 w-4" /></button>
                  <span className="mx-1 text-blush-200">|</span>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={snapEnabled}
                      onChange={(e) => setSnapEnabled(e.target.checked)}
                      className="rounded text-blush-500 focus:ring-blush-400 h-3 w-3"
                    />
                    Snap to Grid
                  </label>
                  <span className="mx-2 text-blush-200">|</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Block:</span>
                  {BLOCK_SIZES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleBlockSizeChange(s)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        blockSize === s
                          ? 'bg-blush-500 text-white border-blush-500'
                          : 'bg-white text-slate-600 border-blush-100 hover:border-blush-300'
                      }`}
                      title={`${s}" x ${s}" block`}
                    >
                      {s}x{s}
                    </button>
                  ))}
                  <span className="mx-2 text-blush-200">|</span>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 transition-all flex items-center gap-1"
                    title="Clear all shapes and start fresh"
                  >
                    <Trash2 className="h-3 w-3" /> Reset
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blush-500">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span>{shapes.length} shapes</span>
                </div>
              </div>

              {/* Canvas Area — blank grid sheet; shapes are added from the library */}
              <div
                className="relative bg-white rounded-2xl border-2 border-dashed border-blush-200 overflow-auto"
                style={{ height: 520 }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={() => {
                  if (movedRef.current) { movedRef.current = false; return; }
                  setSelectedShapeId('');
                }}
              >
                <div
                  ref={gridRef}
                  className="relative"
                  id="quilt-grid-canvas"
                  style={{
                    width: logicalW,
                    height: logicalH,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <PatternDefs />
                  {/* Grid background */}
                  <svg
                    className="absolute"
                    style={{ left: GRID_OFFSET, top: GRID_OFFSET }}
                    width={gridPx}
                    height={gridPx}
                  >
                    {Array.from({ length: blockSize + 1 }).map((_, i) => (
                      <React.Fragment key={i}>
                        <line x1={i * cellPx} y1={0} x2={i * cellPx} y2={gridPx} stroke="#fce7f3" strokeWidth="1" />
                        <line x1={0} y1={i * cellPx} x2={gridPx} y2={i * cellPx} stroke="#fce7f3" strokeWidth="1" />
                      </React.Fragment>
                    ))}
                    <rect x="0" y="0" width={gridPx} height={gridPx} fill="none" stroke="#f9a8d4" strokeWidth="2" rx="4" />
                  </svg>
                  {/* Shapes — free movement, rotation, resize */}
                  {shapes.slice().sort((a, b) => a.zIndex - b.zIndex).map(shape => {
                    const isSelected = selectedShapeId === shape.id;
                    return (
                      <div
                        key={shape.id}
                        data-shape-id={shape.id}
                        onPointerDown={(e) => startMove(e, shape.id)}
                        onDoubleClick={() => duplicateShape(shape.id)}
                        onClick={(e) => { e.stopPropagation(); setSelectedShapeId(shape.id); }}
                        className={`absolute rounded-sm ${isSelected ? 'cursor-move' : 'cursor-move hover:ring-2 hover:ring-blush-300 hover:ring-offset-1'}`}
                        style={{
                          left: shape.x,
                          top: shape.y,
                          width: shape.width,
                          height: shape.height,
                          transform: `rotate(${shape.rotation}deg)`,
                          zIndex: 50 + shape.zIndex,
                          filter: dragOp?.id === shape.id ? 'drop-shadow(0 3px 6px rgba(190,24,93,0.35))' : undefined,
                        }}
                      >
                        <ShapeSvg shape={shape} />
                        {isSelected && (
                          <>
                            <div className="absolute inset-0 ring-2 ring-blush-500 rounded-sm pointer-events-none" />
                            {/* Rotate handle (top-center, rotates with the shape) */}
                            <div
                              onPointerDown={(e) => startRotate(e, shape.id)}
                              title="Drag to rotate"
                              className="absolute -top-5 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white border-2 border-blush-500 cursor-grab hover:scale-110 transition-transform"
                            />
                            {/* Resize handle (bottom-right corner) */}
                            <div
                              onPointerDown={(e) => startResize(e, shape.id)}
                              title="Drag to resize"
                              className="absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 rounded-full bg-blush-500 border-2 border-white cursor-nwse-resize hover:scale-110 transition-transform"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Inspector (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Inspector Panel */}
            <div className="floral-card p-5 space-y-4">
              {selectedShape ? (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                      <Palette className="h-4 w-4 text-blush-500" />
                      <span className="capitalize">{selectedShape.type.replace(/-/g, ' ')} Shape</span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button onClick={() => duplicateShape(selectedShape.id)} title="Duplicate shape" className="p-1.5 rounded-lg text-slate-400 hover:text-blush-600 hover:bg-blush-50">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => bringToFront(selectedShape.id)} title="Bring to front" className="p-1.5 rounded-lg text-slate-400 hover:text-blush-600 hover:bg-blush-50">
                        <BringToFront className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteShape(selectedShape.id)} title="Delete shape" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Position */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">X (px)</label>
                      <input
                        type="number"
                        value={Math.round(selectedShape.x)}
                        onChange={(e) => updateShape(selectedShape.id, { x: Number(e.target.value) })}
                        className="w-full rounded-lg border-blush-100 text-xs py-1.5 px-2 focus:border-blush-500 focus:ring-blush-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Y (px)</label>
                      <input
                        type="number"
                        value={Math.round(selectedShape.y)}
                        onChange={(e) => updateShape(selectedShape.id, { y: Number(e.target.value) })}
                        className="w-full rounded-lg border-blush-100 text-xs py-1.5 px-2 focus:border-blush-500 focus:ring-blush-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Width (px)</label>
                      <input
                        type="number"
                        value={Math.round(selectedShape.width)}
                        onChange={(e) => updateShape(selectedShape.id, { width: Math.max(16, Number(e.target.value)) })}
                        className="w-full rounded-lg border-blush-100 text-xs py-1.5 px-2 focus:border-blush-500 focus:ring-blush-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Height (px)</label>
                      <input
                        type="number"
                        value={Math.round(selectedShape.height)}
                        onChange={(e) => updateShape(selectedShape.id, { height: Math.max(16, Number(e.target.value)) })}
                        className="w-full rounded-lg border-blush-100 text-xs py-1.5 px-2 focus:border-blush-500 focus:ring-blush-500"
                      />
                    </div>
                  </div>
                  {/* Size */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex justify-between">
                      <span>Size</span>
                      <span className="text-blush-500">{Math.round(selectedShape.scale * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.05}
                      value={selectedShape.scale}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const factor = v / selectedShape.scale;
                        updateShape(selectedShape.id, {
                          scale: v,
                          width: clamp(selectedShape.width * factor, 16, 2000),
                          height: clamp(selectedShape.height * factor, 16, 2000),
                        });
                      }}
                      className="w-full accent-blush-500"
                    />
                  </div>
                  {/* Rotation */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block flex justify-between">
                      <span>Rotation</span>
                      <span className="text-blush-500">{Math.round(selectedShape.rotation)}°</span>
                    </label>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      value={clamp(Math.round(selectedShape.rotation), -180, 180)}
                      onChange={(e) => updateShape(selectedShape.id, { rotation: Number(e.target.value) })}
                      className="w-full accent-blush-500"
                    />
                  </div>
                  {/* Fabric Color */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Fabric Color</label>
                    <div className="flex flex-wrap gap-1.5">
                      {FABRIC_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => updateShape(selectedShape.id, { color: c })}
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                            selectedShape.color === c ? 'border-blush-500 scale-110 ring-1 ring-blush-300' : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Fabric Texture */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Fabric Texture</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FABRIC_PATTERNS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => updateShape(selectedShape.id, { pattern: p.id })}
                          className={`p-2 rounded-lg border text-[10px] font-medium transition-all ${
                            selectedShape.pattern === p.id
                              ? 'border-blush-500 bg-blush-50 text-blush-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <ShapeSvg shape={{ ...selectedShape, width: 64, height: 48, pattern: p.id }} />
                          <span className="mt-1 block">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Palette className="h-8 w-8 text-blush-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Select a shape to edit its fabric color, texture, size and rotation.</p>
                </div>
              )}
            </div>

            {/* Block Info */}
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
