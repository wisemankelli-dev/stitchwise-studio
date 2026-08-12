import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api, FabricLayer, AICollageResponse, CollageProject, CollagePiece, PlacedCollagePiece } from '../services/api';
import { describeAiGenerationError } from '../utils/aiGenerationErrors';
import html2canvas from 'html2canvas';
import {
  RotateCcw, ZoomIn, ZoomOut, Layers, Grid3X3,
  Palette, Scissors, Download, Save, Trash2, Plus,
  Flower2, Sparkles, UploadCloud, Loader2,
  Image, Play, CheckCircle2, AlertTriangle, RefreshCw,
  Copy, Eraser, Paintbrush, Pipette, FlipHorizontal, MousePointer2,
  FolderOpen, ChevronDown, FileText, Move, GripVertical
} from 'lucide-react';

type CollageTool = 'select' | 'mirror' | 'erase' | 'clone' | 'eyedropper' | 'paint';

const FABRIC_TEXTURES = [
  { id: 'solid', name: 'Solid Cotton', class: 'bg-current' },
  { id: 'linen', name: 'Linen Weave', class: 'bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,currentColor_2px,currentColor_3px)]' },
  { id: 'polka', name: 'Polka Dot', class: 'bg-[radial-gradient(circle,currentColor_1px,transparent_1px)] bg-[length:6px_6px]' },
  { id: 'stripe', name: 'Striped', class: 'bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,currentColor_4px,currentColor_5px)]' },
  { id: 'plaid', name: 'Plaid', class: 'bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,currentColor_3px,currentColor_4px),repeating-linear-gradient(90deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)]' },
];

const FABRIC_COLORS = [
  '#ffffff', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
  '#ec4899', '#db2777', '#86efac', '#fef3c7', '#bfdbfe',
  '#c4b5fd', '#fca5a5', '#d9f99d', '#fed7aa', '#e2e8f0',
];

const DEFAULT_LAYERS: FabricLayer[] = [
  { id: 'bg', name: 'Base Fabric', color: '#ffffff', pattern: 'solid', x: 100, y: 100, width: 300, height: 300, rotation: 0, opacity: 1, zIndex: 0 },
];

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;

const TOOLS: { id: CollageTool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="h-3.5 w-3.5" />, label: 'Select' },
  { id: 'mirror', icon: <FlipHorizontal className="h-3.5 w-3.5" />, label: 'Mirror' },
  { id: 'erase', icon: <Eraser className="h-3.5 w-3.5" />, label: 'Erase' },
  { id: 'clone', icon: <Copy className="h-3.5 w-3.5" />, label: 'Clone' },
  { id: 'eyedropper', icon: <Pipette className="h-3.5 w-3.5" />, label: 'Pick' },
  { id: 'paint', icon: <Paintbrush className="h-3.5 w-3.5" />, label: 'Paint' },
];

export const CollageStudio: React.FC = () => {
  const [layers, setLayers] = useState<FabricLayer[]>(DEFAULT_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('bg');
  const [zoom, setZoom] = useState(1);

  // AI Generation state
  const [activeTab, setActiveTab] = useState<'prompt' | 'image'>('prompt');
  const [promptInput, setPromptInput] = useState('');
  // Premium art model toggle (Design Studio only; server enforces the tier gate).
  const [premiumModel, setPremiumModel] = useState(false);
  const isStudioTier = (typeof window !== 'undefined' && localStorage.getItem('stitchwise_tier')) === 'Design Studio';
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; previewUrl: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');
  const [aiResult, setAiResult] = useState<AICollageResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState<'replace' | 'append'>('replace');

  // Editing Tools state
  const [activeTool, setActiveTool] = useState<CollageTool>('select');
  const [mirrorEnabled, setMirrorEnabled] = useState(false);

  // Save/Load state
  const [collageName, setCollageName] = useState('');
  const [blockSize, setBlockSize] = useState(12); // quilt block size in inches (12–24, 2" steps) — full-scale PDF prints at this real size
  const [isSaving, setIsSaving] = useState(false);
  const [savedProjects, setSavedProjects] = useState<CollageProject[]>([]);
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pieceSpaceRef = useRef<HTMLDivElement>(null);

  // Scrapbook piece workspace state (owner direction: cutout pieces of the actual art image)
  const [availablePieces, setAvailablePieces] = useState<CollagePiece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<PlacedCollagePiece[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [referenceArt, setReferenceArt] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [trayDragId, setTrayDragId] = useState<string | null>(null);

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  const updateLayer = useCallback((id: string, updates: Partial<FabricLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const addLayer = () => {
    const newLayer: FabricLayer = {
      id: `fabric-${Date.now()}`,
      name: `Layer ${layers.length}`,
      color: '#fbcfe8',
      pattern: 'solid',
      x: 150 + Math.random() * 100,
      y: 150 + Math.random() * 100,
      width: 80,
      height: 60,
      rotation: 0,
      opacity: 1,
      zIndex: layers.length,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(layers[layers.length - 2]?.id || '');
    }
  };

  const handleReset = () => {
    if (!window.confirm('Reset canvas? This will clear all layers and unsaved work.')) return;
    setLayers(DEFAULT_LAYERS.map(l => ({ ...l })));
    setSelectedLayerId('bg');
    setAiResult(null);
    setAiError(null);
    setAvailablePieces([]);
    setPlacedPieces([]);
    setSelectedPieceId(null);
    setReferenceArt(null);
  };

  const applyAiResult = () => {
    if (!aiResult?.layers) return;

    // Scrapbook piece flow: if the backend emitted cutout pieces, adopt them instead of layers.
    if (aiResult.pieces && aiResult.pieces.length > 0) {
      adoptPiecesFromResult(aiResult);
      return;
    }

    if (replaceMode === 'replace') {
      setLayers(aiResult.layers);
      setSelectedLayerId(aiResult.layers[aiResult.layers.length - 1]?.id || 'bg');
    } else {
      const maxZ = layers.reduce((max, l) => Math.max(max, l.zIndex), 0);
      const newLayers = aiResult.layers.filter(l => l.id !== 'bg').map(l => ({
        ...l,
        id: `ai-${Date.now()}-${l.id}`,
        zIndex: maxZ + l.zIndex + 1,
        x: l.x + 20,
        y: l.y + 20,
      }));
      setLayers(prev => [...prev, ...newLayers]);
      setSelectedLayerId(newLayers[newLayers.length - 1]?.id || 'bg');
    }
  };

  // Save/Load/Export handlers
  const handleSaveCollage = async () => {
    const name = collageName.trim() || `Collage ${new Date().toLocaleDateString()}`;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const project = await api.saveCollage(
        name,
        layers,
        placedPieces.length > 0 ? placedPieces : undefined,
        referenceArt ?? undefined
      );
      setCollageName('');
      setSavedProjects(prev => [project, ...prev.filter(p => p.id !== project.id)]);
      setSaveMessage(`Saved "${project.name}"!`);
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err) {
      setSaveMessage('Save failed. Will retry with mock backend.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProjects = async () => {
    try {
      const projects = await api.listCollageProjects();
      setSavedProjects(projects);
    } catch { /* use stale state */ }
    setShowLoadDropdown(prev => !prev);
  };

  const handleLoadCollage = async (id: string) => {
    const project = await api.loadCollageProject(id);
    if (project) {
      setLayers(project.layers);
      setSelectedLayerId(project.layers[project.layers.length - 1]?.id || 'bg');
      // Restore scrapbook piece workspace state when the project has pieces.
      if (project.pieces && project.pieces.length > 0) {
        setPlacedPieces(project.pieces);
        setAvailablePieces(project.pieces.map(p => p.piece));
        setSelectedPieceId(null);
      }
      if (project.referenceArt) setReferenceArt(project.referenceArt);
      setSaveMessage(`Loaded "${project.name}"`);
      setTimeout(() => setSaveMessage(null), 2000);
    }
    setShowLoadDropdown(false);
  };

  const handleDeleteCollage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteCollageProject(id);
    setSavedProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleExportPng = async () => {
    if (!canvasRef.current) return;
    const canvas = await html2canvas(canvasRef.current, {
      backgroundColor: '#fdf2f8',
      scale: 2,
    });
    const link = document.createElement('a');
    link.download = `${collageName.trim() || 'collage'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  };

  /** PDF export: outline pattern with numbered cutout pieces + color guide + reference art. */
  const handleExportPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const title = (collageName.trim() || 'collage').replace(/\s+/g, '-');
      const pieces = placedPieces.length > 0 ? placedPieces : availablePieces.map((piece, i) => ({
        instanceId: `tray-${i}`, pieceId: piece.id, piece,
        x: piece.bounds.x * 500, y: piece.bounds.y * 500, scale: 1, rotation: 0, zIndex: i,
      }));
      const hasPieces = pieces.length > 0;

      // ── Full-scale pattern pages: complete assembled pattern at REAL size ──
      // Canvas is 500px square → blockSize inches. 1 canvas px = blockSize*25.4/500 mm.
      const blockMm = blockSize * 25.4;                       // e.g. 12" → 304.8 mm, 24" → 609.6 mm
      const usableMm = 190;                                   // A4 (210mm) minus ~10mm side margins
      const tilesPerAxis = Math.max(1, Math.ceil(blockMm / usableMm));
      const tileMm = blockMm / tilesPerAxis;                  // e.g. 304.8/2 = 152.4 mm per tile
      const mmPerPx = blockMm / 500;
      const pageW = 210;
      const tileTop = 36;                                     // header area on each tile page
      const tileX0 = (pageW - tileMm) / 2;                    // center the tile horizontally
      /** Rotate a normalized outline point (0..1) into pattern-mm coords (rotation around the piece center, matching the canvas). */
      const piecePointMm = (p: PlacedCollagePiece, ox: number, oy: number): [number, number] => {
        const w = p.piece.bounds.width * 500 * p.scale;
        const h = p.piece.bounds.height * 500 * p.scale;
        const rad = (p.rotation * Math.PI) / 180;
        const px = ox * w, py = oy * h;
        const cxr = w / 2, cyr = h / 2;
        const rx = cxr + (px - cxr) * Math.cos(rad) - (py - cyr) * Math.sin(rad);
        const ry = cyr + (px - cxr) * Math.sin(rad) + (py - cyr) * Math.cos(rad);
        return [(p.x + rx) * mmPerPx, (p.y + ry) * mmPerPx];
      };
      const pieceCentroidMm = (p: PlacedCollagePiece): [number, number] => {
        const o = p.piece.outline || [];
        let sx = 0, sy = 0;
        for (const [ox, oy] of o) { const [mx, my] = piecePointMm(p, ox, oy); sx += mx; sy += my; }
        return o.length ? [sx / o.length, sy / o.length] : [0, 0];
      };
      const drawPatternPiece = (p: PlacedCollagePiece, idx: number) => {
        const outline = (p.piece.outline || []).map(([ox, oy]) => piecePointMm(p, ox, oy));
        if (outline.length < 3) return;
        doc.setDrawColor(17, 17, 17);
        doc.setLineWidth(0.5);
        for (let k = 0; k < outline.length - 1; k++) doc.line(outline[k][0], outline[k][1], outline[k + 1][0], outline[k + 1][1]);
        doc.line(outline[outline.length - 1][0], outline[outline.length - 1][1], outline[0][0], outline[0][1]);
        const [cxr, cyr] = pieceCentroidMm(p);
        doc.setFontSize(7);
        doc.setTextColor(17, 17, 17);
        doc.text(String(idx + 1), cxr, cyr, { align: 'center', baseline: 'middle' });
      };
      if (hasPieces) {
        const n = tilesPerAxis;
        for (let tj = 0; tj < n; tj++) {
          for (let ti = 0; ti < n; ti++) {
            if (ti > 0 || tj > 0) doc.addPage();
            doc.setFontSize(14);
            doc.setTextColor(139, 92, 118);
            doc.text('Collage Quilt Pattern — Print & Cut', pageW / 2, 14, { align: 'center' });
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Tile ${tj * n + ti + 1} of ${n * n} · ${blockSize}" × ${blockSize}" block · ${pieces.length} pieces`, pageW / 2, 20, { align: 'center' });
            doc.setFontSize(7);
            doc.setTextColor(160, 60, 80);
            doc.text('PRINT AT 100% / ACTUAL SIZE — printer scaling: None / "Actual size" (do not auto-fit)', pageW / 2, 26, { align: 'center' });

            const tLeft = tileX0, tTop = tileTop, tRight = tileX0 + tileMm, tBottom = tileTop + tileMm;
            doc.setDrawColor(190, 190, 200);
            doc.setLineWidth(0.2);
            doc.rect(tLeft, tTop, tileMm, tileMm);
            // draw the pattern clipped to this tile (pieces crossing seams continue on the neighbour page)
            doc.saveGraphicsState();
            doc.rect(tLeft, tTop, tileMm, tileMm);
            doc.clip();
            doc.discardPath();
            pieces.forEach((p, idx) => drawPatternPiece(p, idx));
            doc.restoreGraphicsState();
            // crop/alignment "+" marks at the tile corners
            doc.setDrawColor(60, 60, 70);
            doc.setLineWidth(0.3);
            const arm = 7;
            doc.line(tLeft - arm, tTop, tLeft + arm, tTop); doc.line(tLeft, tTop - arm, tLeft, tTop + arm);
            doc.line(tRight - arm, tTop, tRight + arm, tTop); doc.line(tRight, tTop - arm, tRight, tTop + arm);
            doc.line(tLeft - arm, tBottom, tLeft + arm, tBottom); doc.line(tLeft, tBottom - arm, tLeft, tBottom + arm);
            doc.line(tRight - arm, tBottom, tRight + arm, tBottom); doc.line(tRight, tBottom - arm, tRight, tBottom + arm);
            doc.setFontSize(6.5);
            doc.setTextColor(120, 120, 130);
            doc.text('Trim along the seam lines and match the "+" corner marks. Pieces crossing a seam continue on the neighbouring tile.', tLeft, tBottom + 6);
          }
        }
      }
      // Page 2: Reference art (if any)
      if (referenceArt) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(139, 92, 118);
        doc.text('Reference Art', 20, 20);
        try {
          const img = new window.Image();
          img.src = referenceArt;
          await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
          const aspect = img.width && img.height ? img.height / img.width : 1;
          const wMm = 150;
          const hMm = wMm * aspect;
          doc.addImage(referenceArt, 'PNG', 30, 30, wMm, Math.min(hMm, 200));
        } catch { /* image may not embed */ }
      }

      // Page 2/3: Cutting guide with numbered piece outlines + colors
      if (hasPieces) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(139, 92, 118);
        doc.text('Piece Cutting Guide', 20, 20);
        const keyY = 32;
        pieces.forEach((p, i) => {
          const row = Math.floor(i / 2);
          const col = i % 2;
          const px = 20 + col * 95;
          const py = keyY + row * 62;
          // outline preview (scaled to ~34mm box)
          const box = 34;
          const w = Math.max(40, p.piece.bounds.width * 500) * p.scale;
          const h = Math.max(40, p.piece.bounds.height * 500) * p.scale;
          const s = Math.min(box / w, box / h);
          const ox = px + (box - w * s) / 2;
          const oy = py + (box - h * s) / 2;
          const outline = (p.piece.outline || []).map(([ox2, oy2]) => [ox + ox2 * w * s, oy + oy2 * h * s] as [number, number]);
          if (outline.length >= 3) {
            const [r, g, b] = hexToRgb(p.piece.color || '#f472b6');
            doc.setFillColor(r, g, b);
            doc.setDrawColor(120, 90, 110);
            doc.triangle(outline[0][0], outline[0][1], outline[1][0], outline[1][1], outline[2][0], outline[2][1], 'FD');
            for (let k = 2; k < outline.length; k++) doc.line(outline[k - 1][0], outline[k - 1][1], outline[k][0], outline[k][1]);
            doc.line(outline[outline.length - 1][0], outline[outline.length - 1][1], outline[0][0], outline[0][1]);
          }
          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          doc.text(`#${i + 1} ${p.piece.label || 'Piece'}`, px + box + 6, py + 8);
          doc.setFontSize(8);
          doc.setTextColor(130, 130, 130);
          doc.text(`${p.piece.color || ''} · ${Math.round(w)}×${Math.round(h)}px`, px + box + 6, py + 16);
        });
      }

      doc.save(`${title}.pdf`);
      setSaveMessage('PDF exported!');
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (err) {
      console.error('PDF export failed:', err);
      setSaveMessage('PDF export failed');
      setTimeout(() => setSaveMessage(null), 2500);
    }
  };

  const handleCanvasClick = (layerId: string) => {
    switch (activeTool) {
      case 'erase': {
        if (layerId === 'bg') return;
        deleteLayer(layerId);
        break;
      }
      case 'clone': {
        const source = layers.find(l => l.id === layerId);
        if (!source || layerId === 'bg') return;
        const newLayer: FabricLayer = {
          ...source,
          id: `fabric-${Date.now()}`,
          name: `${source.name} (copy)`,
          x: source.x + 20,
          y: source.y + 20,
          zIndex: layers.length,
        };
        setLayers(prev => [...prev, newLayer]);
        setSelectedLayerId(newLayer.id);
        break;
      }
      case 'eyedropper': {
        const source = layers.find(l => l.id === layerId);
        if (source) {
          updateLayer(selectedLayerId, { color: source.color });
        }
        break;
      }
      case 'paint': {
        const activeColor = selectedLayer?.color || '#fbcfe8';
        const nextColor = FABRIC_COLORS[(FABRIC_COLORS.indexOf(activeColor) + 1) % FABRIC_COLORS.length];
        updateLayer(layerId, { color: nextColor });
        break;
      }
      case 'mirror': {
        if (!mirrorEnabled || layerId === 'bg') {
          setSelectedLayerId(layerId);
          return;
        }
        const source = layers.find(l => l.id === layerId);
        if (!source) return;
        // Mirror position across center
        const mirroredX = CANVAS_WIDTH - source.x - source.width;
        const mirroredY = CANVAS_HEIGHT - source.y - source.height;
        updateLayer(layerId, {
          x: Math.max(0, Math.min(CANVAS_WIDTH - source.width, mirroredX)),
          y: Math.max(0, Math.min(CANVAS_HEIGHT - source.height, mirroredY)),
          rotation: -source.rotation,
        });
        break;
      }
      default: {
        setSelectedLayerId(layerId);
        break;
      }
    }
  };

  // === Scrapbook piece workspace (cutout pieces of the actual art image) ===
  /** Build a CSS clip-path polygon from a piece's normalized outline (0..1 coords). */
  const outlineClipPath = (outline: [number, number][]): string => {
    if (!outline || outline.length < 3) return 'none';
    return `polygon(${outline.map(([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`).join(',')})`;
  };

  /** Adopt pieces + reference art from an AI response (text or image generation). */
  const adoptPiecesFromResult = (result: AICollageResponse | null) => {
    if (result?.pieces && result.pieces.length > 0) {
      setAvailablePieces(result.pieces);
      if (result.referenceArt) setReferenceArt(result.referenceArt);
      // Never auto-assemble a fallback/placeholder layout as if it were the real
      // artwork: the backend flags mock pieces (isFallback) when the AI image
      // service hiccuped, and those scattered blobs are NOT the user's design.
      // The honest UX is a warning banner + a manual Apply if they want it.
      if (result.isFallback) {
        setPlacedPieces([]);
        setSelectedPieceId(null);
        return;
      }
      // A "background piece" is the artwork's backdrop (e.g. the white area of a
      // "red octopus on a white background" prompt). Watershed segments it as one
      // or more huge near-white regions that touch the canvas edges. In a collage
      // quilt the background is the BASE FABRIC, not a cutout piece — rendering
      // those giant regions as pieces covers the subject and looks "scrambled".
      // Detect them (near-white + touching >=2 canvas edges) and exclude them
      // from the pattern; the white canvas becomes the base fabric underneath.
      const hexBrightness = (hex?: string): number => {
        if (!hex) return 0;
        const h = hex.replace('#', '');
        if (h.length !== 6) return 0;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return (r + g + b) / 3;
      };
      const isBackgroundPiece = (p: CollagePiece): boolean => {
        const b = p.bounds;
        const touchesLeft = b.x <= 0.005;
        const touchesTop = b.y <= 0.005;
        const touchesRight = b.x + b.width >= 0.995;
        const touchesBottom = b.y + b.height >= 0.995;
        const edgeCount = (touchesLeft ? 1 : 0) + (touchesTop ? 1 : 0) + (touchesRight ? 1 : 0) + (touchesBottom ? 1 : 0);
        return edgeCount >= 2 && hexBrightness(p.color) >= 200;
      };
      const subjectPieces = result.pieces.filter(p => !isBackgroundPiece(p));
      // Assemble ONLY the subject pieces at their ORIGINAL artwork positions so
      // the cutouts reconstruct the artwork shape (bounds are normalized 0..1).
      const placed: PlacedCollagePiece[] = subjectPieces.map((piece, i) => {
        return {
          instanceId: `placed-${Date.now()}-${i}`,
          pieceId: piece.id,
          piece,
          x: piece.bounds.x * 500,
          y: piece.bounds.y * 500,
          scale: 1,
          rotation: 0,
          zIndex: i + 1,
        };
      });
      setAvailablePieces(subjectPieces);
      setPlacedPieces(placed);
      setSelectedPieceId(null);
    }
  };

  const addPieceToCanvas = (piece: CollagePiece) => {
    const w = Math.max(40, piece.bounds.width * 500);
    const h = Math.max(40, piece.bounds.height * 500);
    const instance: PlacedCollagePiece = {
      instanceId: `placed-${Date.now()}`,
      pieceId: piece.id,
      piece,
      x: Math.max(0, Math.min(CANVAS_WIDTH - w, 20 + Math.random() * 60)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - h, 20 + Math.random() * 60)),
      scale: 1,
      rotation: 0,
      zIndex: placedPieces.length + 1,
    };
    setPlacedPieces(prev => [...prev, instance]);
    setSelectedPieceId(instance.instanceId);
  };

  const updatePlacedPiece = (instanceId: string, updates: Partial<PlacedCollagePiece>) => {
    setPlacedPieces(prev => prev.map(p => p.instanceId === instanceId ? { ...p, ...updates } : p));
  };

  const removePlacedPiece = (instanceId: string) => {
    setPlacedPieces(prev => prev.filter(p => p.instanceId !== instanceId));
    if (selectedPieceId === instanceId) setSelectedPieceId(null);
  };

  const duplicatePlacedPiece = (instanceId: string) => {
    const src = placedPieces.find(p => p.instanceId === instanceId);
    if (!src) return;
    const copy: PlacedCollagePiece = {
      ...src,
      instanceId: `placed-${Date.now()}`,
      x: src.x + 24,
      y: src.y + 24,
      zIndex: placedPieces.length + 1,
    };
    setPlacedPieces(prev => [...prev, copy]);
    setSelectedPieceId(copy.instanceId);
  };

  const bringPieceToFront = (instanceId: string) => {
    const maxZ = placedPieces.reduce((m, p) => Math.max(m, p.zIndex), 0);
    updatePlacedPiece(instanceId, { zIndex: maxZ + 1 });
  };

  /** Canvas mouse handlers for dragging placed pieces. */
  const pieceSpaceRect = (): DOMRect | null => pieceSpaceRef.current?.getBoundingClientRect() ?? canvasRef.current?.getBoundingClientRect() ?? null;

  const handlePiecePointerDown = (e: React.PointerEvent, instanceId: string) => {
    if (activeTool !== 'select') return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedPieceId(instanceId);
    const rect = pieceSpaceRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / (rect.width / 500);
    const py = (e.clientY - rect.top) / (rect.height / 500);
    const placed = placedPieces.find(p => p.instanceId === instanceId);
    if (!placed) return;
    setDragState({ id: instanceId, offsetX: px - placed.x, offsetY: py - placed.y });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const rect = pieceSpaceRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / (rect.width / 500);
    const py = (e.clientY - rect.top) / (rect.height / 500);
    updatePlacedPiece(dragState.id, { x: px - dragState.offsetX, y: py - dragState.offsetY });
  };

  const handleCanvasPointerUp = () => {
    setDragState(null);
  };

  /** Drop a piece from the tray onto the canvas. */
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData('text/piece-id');
    const piece = availablePieces.find(p => p.id === pieceId);
    if (!piece) return;
    const rect = pieceSpaceRect();
    if (!rect) return;
    const w = Math.max(40, piece.bounds.width * 500);
    const h = Math.max(40, piece.bounds.height * 500);
    const px = (e.clientX - rect.left) / (rect.width / 500) - w / 2;
    const py = (e.clientY - rect.top) / (rect.height / 500) - h / 2;
    const instance: PlacedCollagePiece = {
      instanceId: `placed-${Date.now()}`,
      pieceId: piece.id,
      piece,
      x: Math.max(0, Math.min(CANVAS_WIDTH - w, px)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - h, py)),
      scale: 1,
      rotation: 0,
      zIndex: placedPieces.length + 1,
    };
    setPlacedPieces(prev => [...prev, instance]);
    setSelectedPieceId(instance.instanceId);
    setTrayDragId(null);
  };

  // === Text-to-Collage ===
  const triggerTextGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    setGeneratorProgress(5);
    setProgressPhase('Interpreting your design vision...');
    setAiResult(null);
    setAiError(null);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(95, Math.round(((Date.now() - startTime) / 3000) * 95));
      setGeneratorProgress(p);
      setProgressPhase(
        p < 20 ? 'Interpreting your design vision...'
          : p < 40 ? 'Detecting fabric patterns and colors...'
          : p < 60 ? 'Arranging fabric layers...'
          : p < 80 ? 'Applying textures...'
          : 'Finalizing collage design...'
      );
    }, 100);
    try {
      const result = await api.generateCollageFromText(promptInput, {
        premiumModel: premiumModel && isStudioTier ? true : undefined,
      });
      clearInterval(interval);
      setGeneratorProgress(100);
      setProgressPhase('Collage complete!');
      setAiResult(result);
      adoptPiecesFromResult(result);
    } catch (err: any) {
      clearInterval(interval);
      setAiError(describeAiGenerationError(err, 'AI collage generation failed. Please try again.'));
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  };

  // === Image-to-Collage ===
  const triggerImageGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;
    setIsGenerating(true);
    setGeneratorProgress(5);
    setProgressPhase('Analyzing image composition...');
    setAiResult(null);
    setAiError(null);
    const resp = await fetch(uploadedFile.previewUrl);
    const blob = await resp.blob();
    const file = new File([blob], uploadedFile.name, { type: blob.type });
    const startTime = Date.now();
    const interval = setInterval(() => {
      const p = Math.min(95, Math.round(((Date.now() - startTime) / 3500) * 95));
      setGeneratorProgress(p);
      setProgressPhase(
        p < 20 ? 'Analyzing image composition...'
          : p < 40 ? 'Detecting color regions...'
          : p < 60 ? 'Mapping to fabric patches...'
          : p < 80 ? 'Arranging radial layout...'
          : 'Finalizing collage design...'
      );
    }, 100);
    try {
      const result = await api.generateCollageFromImage(file);
      clearInterval(interval);
      setGeneratorProgress(100);
      setProgressPhase('Collage complete!');
      setAiResult(result);
      adoptPiecesFromResult(result);
    } catch (err: any) {
      clearInterval(interval);
      setAiError(describeAiGenerationError(err, 'Image collage generation failed. Please try again.'));
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
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
                  <Scissors className="h-5 w-5 text-blush-500 -rotate-45" />
                  Collage Studio
                </h1>
                <p className="text-[10px] text-blush-400">Floral Fabric Collage Designer</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiResult && !isGenerating && (
                <>
                  {!(aiResult.pieces && aiResult.pieces.length > 0) && (
                    <div className="flex bg-blush-50 p-0.5 rounded-lg border border-blush-100 mr-1">
                      <button
                        onClick={() => setReplaceMode('replace')}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${replaceMode === 'replace' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                      >
                        <RefreshCw className="h-3 w-3 inline mr-0.5" /> Replace
                      </button>
                      <button
                        onClick={() => setReplaceMode('append')}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${replaceMode === 'append' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                      >
                        <Plus className="h-3 w-3 inline mr-0.5" /> Append
                      </button>
                    </div>
                  )}
                  <button onClick={applyAiResult} className="btn-floral-primary text-xs py-1.5 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {aiResult.pieces && aiResult.pieces.length > 0 ? 'Apply Pieces' : 'Apply to Canvas'}
                  </button>
                </>
              )}
              {/* Save/Load/Export controls */}
              <div className="flex items-center gap-2 relative">
                {/* Name input */}
                <input
                  type="text"
                  value={collageName}
                  onChange={(e) => setCollageName(e.target.value)}
                  placeholder="Project name..."
                  className="w-28 rounded-lg border-blush-200 text-xs text-slate-700 px-2 py-1.5 border bg-white focus:border-blush-400 focus:ring-1 focus:ring-blush-400"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCollage(); }}
                />
                {/* Save */}
                <button
                  onClick={handleSaveCollage}
                  disabled={isSaving}
                  className="btn-floral-ghost text-xs py-1.5 px-3 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                {/* Load dropdown */}
                <div className="relative">
                  <button
                    onClick={handleLoadProjects}
                    className="btn-floral-ghost text-xs py-1.5 px-3 flex items-center"
                  >
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Load
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </button>
                  {showLoadDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-blush-100 z-50 max-h-60 overflow-y-auto">
                      {savedProjects.length === 0 ? (
                        <p className="p-3 text-[11px] text-slate-400 text-center">No saved projects yet</p>
                      ) : (
                        savedProjects.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleLoadCollage(p.id)}
                            className="flex items-center justify-between p-2 hover:bg-blush-50 cursor-pointer border-b border-blush-50 last:border-0"
                          >
                            <span className="text-xs text-slate-700 truncate flex-1">
                              {p.name}
                              <span className="text-[10px] text-slate-400 ml-2">{new Date(p.updatedAt).toLocaleDateString()}</span>
                            </span>
                            <button
                              onClick={(e) => handleDeleteCollage(p.id, e)}
                              className="text-slate-300 hover:text-red-500 p-1"
                              title="Delete project"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {/* Export */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={blockSize}
                    onChange={(e) => setBlockSize(Number(e.target.value))}
                    className="rounded-lg border border-blush-200 text-xs text-slate-700 px-2 py-1.5 bg-white focus:border-blush-400 focus:ring-1 focus:ring-blush-400"
                    title="Quilt block size (inches) — the full-scale PDF pattern prints at this real size"
                  >
                    {[12, 14, 16, 18, 20, 22, 24].map((n) => (
                      <option key={n} value={n}>{n}&quot; block</option>
                    ))}
                  </select>
                  <button onClick={handleExportPng} className="btn-floral-primary text-xs py-1.5 px-3">
                    <Download className="h-3.5 w-3.5 mr-1" />
                    PNG
                  </button>
                  <button onClick={handleExportPdf} className="btn-floral-ghost text-xs py-1.5 px-3">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    PDF
                  </button>
                </div>
              </div>
              {/* Save message flash */}
              {saveMessage && (
                <p className={`text-[10px] px-2 py-0.5 rounded ${saveMessage.startsWith('Save failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Persistent Artwork panel (top on mobile, beside the pattern on lg) */}
          <div className="lg:col-span-4">
            <div className="floral-card p-5 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Image className="h-4 w-4 text-blush-500" />
                  Artwork
                </h2>
                <span className="text-[9px] font-bold text-blush-500 uppercase tracking-wider bg-blush-50 border border-blush-100 px-2 py-0.5 rounded-full">Reference</span>
              </div>
              {referenceArt ? (
                <div className="flex-1 rounded-2xl bg-white border border-blush-100 overflow-hidden relative flex items-center justify-center p-3"
                  style={{ minHeight: '340px' }}>
                  <img
                    src={referenceArt}
                    alt="Generated reference artwork"
                    draggable={false}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-sm select-none pointer-events-none"
                  />
                  <p className="absolute bottom-1.5 inset-x-0 text-center text-[9px] text-slate-400">
                    Reference artwork — your pattern pieces are cut from this image
                  </p>
                </div>
              ) : (
                <div className="flex-1 rounded-2xl bg-blush-50/60 border-2 border-dashed border-blush-200 flex flex-col items-center justify-center text-center p-8"
                  style={{ minHeight: '340px' }}>
                  <Sparkles className="h-8 w-8 text-blush-300 mb-3" />
                  <p className="text-xs font-semibold text-blush-600">Your artwork will appear here</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[220px]">
                    Generate a collage below and the reference art will show up in this panel, beside your pattern.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Right: Pattern canvas (8 cols) */}
          <div className="lg:col-span-8">
            <div className="floral-card p-4">
              {/* Canvas Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-700 mr-1 flex items-center gap-1.5">
                    <Grid3X3 className="h-4 w-4 text-blush-500" />
                    Pattern
                  </span>
                  <span className="mx-0.5 text-blush-200">|</span>
                  <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="btn-floral-ghost p-1.5"><ZoomIn className="h-4 w-4" /></button>
                  <span className="text-xs font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="btn-floral-ghost p-1.5"><ZoomOut className="h-4 w-4" /></button>
                  <button onClick={() => setZoom(1)} className="btn-floral-ghost p-1.5"><RotateCcw className="h-4 w-4" /></button>
                  <span className="mx-1 text-blush-200">|</span>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:text-red-700 transition-all flex items-center gap-1"
                    title="Clear all layers and start fresh"
                  >
                    <Trash2 className="h-3 w-3" /> Reset
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blush-500">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span>{placedPieces.length > 0 ? `${placedPieces.length} pieces · ` : ''}{layers.length} layers</span>
                </div>
              </div>

              {/* Editing Tools Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setActiveTool(tool.id);
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
                  {activeTool === 'erase' && (
                    <span className="text-[10px] text-slate-500 italic">Click a layer to erase</span>
                  )}
                  {activeTool === 'clone' && (
                    <span className="text-[10px] text-slate-500 italic">Click a layer to duplicate</span>
                  )}
                  {activeTool === 'eyedropper' && (
                    <span className="text-[10px] text-slate-500 italic">Pick color from a layer</span>
                  )}
                  {activeTool === 'paint' && (
                    <span className="text-[10px] text-slate-500 italic">Cycle colors on click</span>
                  )}
                </div>
              </div>

              {/* Canvas Area */}
              <div
                ref={canvasRef}
                className="relative bg-white rounded-2xl border-2 border-dashed border-blush-200 overflow-hidden mx-auto"
                style={{ height: '500px', width: '500px', maxWidth: '100%' }}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
                onDragOver={(e) => { if (trayDragId) e.preventDefault(); }}
                onDrop={handleCanvasDrop}
              >
                <div
                  ref={pieceSpaceRef}
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(#fce7f3 1px, transparent 1px), linear-gradient(90deg, #fce7f3 1px, transparent 1px)',
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {/* Reference art lives in its own persistent Artwork panel — no underlay here */}
                  {layers.sort((a, b) => a.zIndex - b.zIndex).map((layer) => {
                    const isEraseTool = activeTool === 'erase' && layer.id !== 'bg';
                    const isCloneTool = activeTool === 'clone' && layer.id !== 'bg';
                    const isPickTool = activeTool === 'eyedropper' && layer.id !== 'bg';
                    const isPaintTool = activeTool === 'paint';
                    const isMirrorTool = activeTool === 'mirror' && mirrorEnabled && layer.id !== 'bg';
                    const isInteractable = isEraseTool || isCloneTool || isPickTool || isPaintTool || isMirrorTool;

                    return (
                      <div
                        key={layer.id}
                        onClick={() => handleCanvasClick(layer.id)}
                        className={`absolute transition-shadow duration-200 ${
                          selectedLayerId === layer.id && activeTool === 'select'
                            ? 'ring-2 ring-blush-500 ring-offset-2'
                            : isInteractable
                            ? 'cursor-pointer hover:ring-2 hover:ring-blush-400 hover:ring-offset-1'
                            : activeTool === 'select' || activeTool === 'mirror'
                            ? 'cursor-move'
                            : 'cursor-default'
                        }`}
                        style={{
                          left: layer.x,
                          top: layer.y,
                          width: layer.width,
                          height: layer.height,
                          transform: `rotate(${layer.rotation}deg)`,
                          opacity: layer.opacity,
                          zIndex: layer.zIndex,
                          backgroundColor: layer.color,
                          backgroundSize: layer.pattern === 'polka' ? '6px 6px' : layer.pattern === 'stripe' || layer.pattern === 'plaid' ? '' : '',
                          borderRadius: layer.id === 'bg' ? '0' : '12px',
                        }}
                      >
                        {layer.id !== 'bg' && (
                          <div className="absolute -top-6 left-0 text-[9px] text-blush-500 font-medium whitespace-nowrap bg-white/80 px-1.5 py-0.5 rounded">
                            {layer.name}
                          </div>
                        )}
                        {/* Tool indicator badge */}
                        {isEraseTool && (
                          <div className="absolute inset-0 flex items-center justify-center bg-rose-500/20 rounded-xl">
                            <Eraser className="h-6 w-6 text-rose-500 opacity-70" />
                          </div>
                        )}
                        {isCloneTool && (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-xl">
                            <Copy className="h-6 w-6 text-emerald-500 opacity-70" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Scrapbook cutout pieces — rendered as a COMPLETE coloring-book pattern:
                      blank interiors + numbered contour outlines, assembled edge-to-edge at
                      their original artwork positions (no interior art on the pattern page). */}
                  {placedPieces.sort((a, b) => a.zIndex - b.zIndex).map((placed, placedIdx) => {
                    const w = placed.piece.bounds.width * 500 * placed.scale;
                    const h = placed.piece.bounds.height * 500 * placed.scale;
                    const isSelected = selectedPieceId === placed.instanceId && activeTool === 'select';
                    const placedOutline = placed.piece.outline || [];
                    const cxPct = placedOutline.length ? (placedOutline.reduce((s, [ox]) => s + ox, 0) / placedOutline.length) * 100 : 50;
                    const cyPct = placedOutline.length ? (placedOutline.reduce((s, [, oy]) => s + oy, 0) / placedOutline.length) * 100 : 50;
                    return (
                      <div
                        key={placed.instanceId}
                        onPointerDown={(e) => handlePiecePointerDown(e, placed.instanceId)}
                        onDoubleClick={() => duplicatePlacedPiece(placed.instanceId)}
                        className={`absolute ${activeTool === 'select' ? 'cursor-move' : 'cursor-default'}`}
                        style={{
                          left: placed.x,
                          top: placed.y,
                          width: w,
                          height: h,
                          transform: `rotate(${placed.rotation}deg)`,
                          zIndex: 500 + placed.zIndex,
                          filter: dragState?.id === placed.instanceId ? 'drop-shadow(0 4px 8px rgba(190,24,93,0.35))' : undefined,
                        }}
                      >
                        {placed.piece.image ? (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none select-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polygon
                              points={(placed.piece.outline || []).map(([ox, oy]) => `${(ox * 100).toFixed(2)},${(oy * 100).toFixed(2)}`).join(' ')}
                              fill="#ffffff"
                              stroke="#111111"
                              strokeWidth={2}
                              strokeLinejoin="round"
                              style={{ vectorEffect: 'non-scaling-stroke' }}
                            />
                          </svg>
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: '#ffffff', clipPath: outlineClipPath(placed.piece.outline) }}
                          />
                        )}
                        {/* Piece number (coloring-book numbering) */}
                        <span
                          className="absolute text-[10px] font-bold text-black pointer-events-none select-none"
                          style={{ left: `${cxPct}%`, top: `${cyPct}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          {placedIdx + 1}
                        </span>
                        {/* Selection ring + label */}
                        {isSelected && (
                          <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 ring-2 ring-blush-500 rounded-sm" />
                            <span className="absolute -top-5 left-0 text-[9px] font-bold text-white bg-blush-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {placed.piece.label || 'Piece'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tools row: AI generator · piece tray · layers */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            {/* AI Generation Panel */}
            <div className="floral-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blush-500" />
                  AI Collage Generator
                </h3>
              </div>

              <div className="flex border-b border-blush-100 mb-4">
                <button onClick={() => setActiveTab('prompt')} disabled={isGenerating}
                  className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all ${
                    activeTab === 'prompt' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400'
                  }`}>
                  <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Text-to-Collage
                </button>
                <button onClick={() => setActiveTab('image')} disabled={isGenerating}
                  className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all ${
                    activeTab === 'image' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400'
                  }`}>
                  <Image className="h-3.5 w-3.5 inline mr-1" /> Image-to-Collage
                </button>
              </div>

              {activeTab === 'prompt' ? (
                <div>
                  <p className="text-[11px] text-slate-500 mb-3">Describe your collage quilt design and AI will generate fabric layers.</p>
                  <form onSubmit={triggerTextGeneration} className="space-y-3">
                    <textarea rows={3} disabled={isGenerating} value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      placeholder="e.g., A floral garden with pink roses and green leaves on a white background"
                      className="w-full rounded-xl border-blush-100 text-sm text-slate-800 shadow-sm focus:border-blush-500 focus:ring-blush-500 disabled:opacity-50 placeholder:text-blush-300" />
                    {isStudioTier && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={premiumModel}
                          onClick={() => setPremiumModel(v => !v)}
                          disabled={isGenerating}
                          title="Higher-quality pro model (~2x image cost)."
                          className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full border border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${premiumModel ? 'bg-purple-500' : 'bg-slate-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${premiumModel ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        <span className="text-[10px] text-slate-500">
                          Premium art model
                          <span className="text-slate-400"> — Higher-quality pro model (~2x image cost)</span>
                        </span>
                      </div>
                    )}
                    {isGenerating ? (
                      <div className="space-y-2 p-3 bg-blush-50 rounded-xl border border-blush-100">
                        <div className="flex items-center gap-2 text-[11px] text-blush-700 font-semibold">
                          <div className="h-2 w-2 rounded-full bg-blush-500 animate-pulse" />
                          <span className="flex-1">{progressPhase}</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blush-400 to-blush-500 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${generatorProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-blush-500">{premiumModel && isStudioTier ? 'Generating your collage art with the premium art model — this can take 1–3 minutes…' : 'Generating your collage art — this usually takes about a minute…'}</p>
                      </div>
                    ) : (
                      <button type="submit" disabled={!promptInput.trim()}
                        className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-blush-600 hover:to-blush-500 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Play className="h-3.5 w-3.5" /> Generate Collage
                      </button>
                    )}
                  </form>
                  {aiResult && !isGenerating && activeTab === 'prompt' && (
                    <button onClick={triggerTextGeneration as any}
                      className="w-full mt-2 rounded-xl border border-blush-200 px-4 py-2 text-[10px] font-semibold text-blush-600 hover:bg-blush-50 flex items-center justify-center gap-2 transition-all">
                      <RefreshCw className="h-3 w-3" /> Regenerate
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500">Upload an image to convert into a fabric collage layout.</p>
                  {!uploadedFile ? (
                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                        isDraggingOver ? 'border-blush-500 bg-blush-50/50' : 'border-blush-200 hover:bg-blush-50/50'
                      }`}>
                      <input type="file" id="collage-file-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                      <label htmlFor="collage-file-upload" className="cursor-pointer block space-y-2">
                        <UploadCloud className="h-7 w-7 mx-auto text-blush-400" />
                        <span className="block text-xs font-bold text-slate-700">Drag & drop here</span>
                        <span className="block text-[10px] text-slate-400">or click to browse (PNG, JPG)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-3 bg-blush-50/50 rounded-xl border border-blush-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded bg-blush-100 flex items-center justify-center text-blush-600 shrink-0 font-bold text-xs uppercase">IMG</div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate">{uploadedFile.name}</p>
                          <p className="text-[10px] text-slate-500">{uploadedFile.size}</p>
                        </div>
                      </div>
                      <button onClick={handleRemoveFile} disabled={isGenerating}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <form onSubmit={triggerImageGeneration} className="space-y-3">
                    {isGenerating ? (
                      <div className="space-y-2 p-3 bg-blush-50 rounded-xl border border-blush-100">
                        <div className="flex items-center gap-2 text-[11px] text-blush-700 font-semibold">
                          <div className="h-2 w-2 rounded-full bg-blush-500 animate-pulse" />
                          <span className="flex-1">{progressPhase}</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blush-400 to-blush-500 h-full transition-all duration-300 ease-out rounded-full" style={{ width: `${generatorProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-blush-500">Generating your collage art — this usually takes about a minute…</p>
                      </div>
                    ) : (
                      <button type="submit" disabled={!uploadedFile}
                        className="w-full rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-blush-600 hover:to-blush-500 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all">
                        <Play className="h-3.5 w-3.5" /> Convert to Collage
                      </button>
                    )}
                  </form>
                </div>
              )}

              {aiResult && !isGenerating && (
                aiResult.isFallback ? (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-800">
                      <strong>AI service hiccup — placeholder shown.</strong>{' '}
                      The image service didn't return artwork this time, so the pieces below are a
                      temporary placeholder, not your real design. Please try generating again.
                    </p>
                  </div>
                ) : (
                <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-800">
                    <strong>Success!</strong>{' '}
                    {aiResult.pieces && aiResult.pieces.length > 0
                      ? `${aiResult.pieces.length} fabric pieces assembled into your collage. Drag any piece to fine-tune, or use the tray below.`
                      : `${aiResult.totalLayers} layers generated. Click "Apply to Canvas" above to use them.`}
                  </p>
                </div>
                )
              )}

              {aiError && (
                <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  <p className="text-[11px] text-rose-800">{aiError}</p>
                </div>
              )}

              {aiResult && !isGenerating && aiResult.pieces && aiResult.pieces.length > 0 && (
                <div className="mt-3 pt-3 border-t border-blush-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Generated Pieces ({aiResult.pieces.length})</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {aiResult.pieces.map((piece) => (
                      <div key={piece.id} className="flex items-center gap-2 text-[10px] text-slate-600">
                        <div className="w-3 h-3 rounded border border-blush-100 shrink-0" style={{ backgroundColor: piece.color }} />
                        <span className="font-medium truncate">{piece.label}</span>
                        <span className="text-slate-400 ml-auto">{Math.round(piece.bounds.width * 500)}×{Math.round(piece.bounds.height * 500)}px</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiResult && !isGenerating && aiResult.layers.length > 1 && !(aiResult.pieces && aiResult.pieces.length > 0) && (
                <div className="mt-3 pt-3 border-t border-blush-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Generated Layers</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {aiResult.layers.filter(l => l.id !== 'bg').map((layer) => (
                      <div key={layer.id} className="flex items-center gap-2 text-[10px] text-slate-600">
                        <div className="w-3 h-3 rounded border border-blush-100 shrink-0" style={{ backgroundColor: layer.color }} />
                        <span className="font-medium truncate">{layer.name}</span>
                        <span className="text-slate-400 ml-auto">{layer.pattern}, {Math.round(layer.width)}×{Math.round(layer.height)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">

            {/* Scrapbook Piece Tray */}
            {availablePieces.length > 0 && (
              <div className="floral-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <Scissors className="h-4 w-4 text-blush-500 -rotate-45" />
                    Scrapbook Pieces
                  </h3>
                  <span className="text-[10px] text-slate-400">{availablePieces.length} cutouts</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-3">
                  Drag a piece onto the canvas (or click to add). Double-click a placed piece to duplicate it.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {availablePieces.map((piece) => (
                    <div
                      key={piece.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/piece-id', piece.id);
                        e.dataTransfer.effectAllowed = 'copy';
                        setTrayDragId(piece.id);
                      }}
                      onDragEnd={() => setTrayDragId(null)}
                      onClick={() => addPieceToCanvas(piece)}
                      className={`group relative aspect-square rounded-xl border overflow-hidden cursor-grab hover:ring-2 hover:ring-blush-400 transition-all bg-blush-50 ${
                        trayDragId === piece.id ? 'opacity-60 ring-2 ring-blush-500' : ''
                      }`}
                      title={`${piece.label} — drag to canvas or click to add`}
                    >
                      {piece.image ? (
                        <img
                          src={piece.image}
                          alt={piece.label || 'piece'}
                          draggable={false}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          style={{ clipPath: outlineClipPath(piece.outline) }}
                        />
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: piece.color, clipPath: outlineClipPath(piece.outline) }} />
                      )}
                      <span className="absolute bottom-0 inset-x-0 text-[8px] font-semibold text-white bg-slate-900/50 backdrop-blur-sm px-1 py-0.5 text-center truncate">
                        {piece.label || 'Piece'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Piece Inspector */}
            {(() => {
              const sel = placedPieces.find(p => p.instanceId === selectedPieceId);
              if (!sel) return null;
              return (
                <div className="floral-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                      <Move className="h-4 w-4 text-blush-500" />
                      {sel.piece.label || 'Piece'}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button onClick={() => duplicatePlacedPiece(sel.instanceId)} className="p-1.5 rounded-lg text-slate-400 hover:text-blush-600 hover:bg-blush-50" title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => bringPieceToFront(sel.instanceId)} className="p-1.5 rounded-lg text-slate-400 hover:text-blush-600 hover:bg-blush-50" title="Bring to front">
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removePlacedPiece(sel.instanceId)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete piece">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Scale</label>
                      <input type="range" min="20" max="300" value={Math.round(sel.scale * 100)}
                        onChange={(e) => updatePlacedPiece(sel.instanceId, { scale: Number(e.target.value) / 100 })}
                        className="w-full accent-blush-500" />
                      <span className="text-[9px] text-slate-400">{Math.round(sel.scale * 100)}%</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Rotate</label>
                      <input type="range" min="-180" max="180" value={Math.round(sel.rotation)}
                        onChange={(e) => updatePlacedPiece(sel.instanceId, { rotation: Number(e.target.value) })}
                        className="w-full accent-blush-500" />
                      <span className="text-[9px] text-slate-400">{Math.round(sel.rotation)}°</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <div className="w-4 h-4 rounded border border-blush-100" style={{ backgroundColor: sel.piece.color }} />
                    <span>{sel.piece.color} · {Math.round(Math.max(40, sel.piece.bounds.width * 500) * sel.scale)}×{Math.round(Math.max(40, sel.piece.bounds.height * 500) * sel.scale)}px</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="lg:col-span-4 space-y-6">

            {/* Layers Panel */}
            <div className="floral-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blush-500" />
                  Layers
                </h3>
                <button onClick={addLayer} className="btn-floral-ghost p-1">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {layers.sort((a, b) => b.zIndex - a.zIndex).map((layer) => (
                  <div
                    key={layer.id}
                    onClick={() => {
                      if (activeTool === 'select' || activeTool === 'mirror') {
                        setSelectedLayerId(layer.id);
                      }
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all text-xs ${
                      selectedLayerId === layer.id
                        ? 'bg-blush-50 border border-blush-200'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="w-6 h-6 rounded border border-blush-100" style={{ backgroundColor: layer.color }} />
                    <span className="font-medium text-slate-700 flex-1">{layer.name}</span>
                    <span className="text-[10px] text-slate-400">z:{layer.zIndex}</span>
                    {layer.id !== 'bg' && (
                      <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} className="text-slate-300 hover:text-rose-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Inspector Panel */}
            {selectedLayer && (
              <div className="floral-card p-5 space-y-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-blush-500" />
                  {selectedLayer.name}
                </h3>

                {/* Color */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FABRIC_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateLayer(selectedLayer.id, { color: c })}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${
                          selectedLayer.color === c ? 'border-blush-500 scale-110' : 'border-transparent hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Texture */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Texture</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {FABRIC_TEXTURES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => updateLayer(selectedLayer.id, { pattern: t.id })}
                        className={`p-2 rounded-lg border text-[10px] font-medium transition-all ${
                          selectedLayer.pattern === t.id
                            ? 'border-blush-500 bg-blush-50 text-blush-700'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`h-4 w-full rounded mb-1 ${t.class}`} style={{ color: selectedLayer.color }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transform */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Width</label>
                    <input type="range" min="30" max="300" value={selectedLayer.width}
                      onChange={(e) => updateLayer(selectedLayer.id, { width: Number(e.target.value) })}
                      className="w-full accent-blush-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Height</label>
                    <input type="range" min="30" max="300" value={selectedLayer.height}
                      onChange={(e) => updateLayer(selectedLayer.id, { height: Number(e.target.value) })}
                      className="w-full accent-blush-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Rotate</label>
                    <input type="range" min="-180" max="180" value={selectedLayer.rotation}
                      onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                      className="w-full accent-blush-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Opacity</label>
                    <input type="range" min="0" max="100" value={selectedLayer.opacity * 100}
                      onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) / 100 })}
                      className="w-full accent-blush-500" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
