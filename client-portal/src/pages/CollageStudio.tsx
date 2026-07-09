import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, FabricLayer, AICollageResponse } from '../services/api';
import {
  RotateCcw, ZoomIn, ZoomOut, Layers, Grid3X3,
  Palette, Scissors, Download, Save, Trash2, Plus,
  Flower2, Sparkles, UploadCloud,
  Image, Play, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';

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
  { id: 'bg', name: 'Base Fabric', color: '#fce7f3', pattern: 'solid', x: 100, y: 100, width: 300, height: 300, rotation: 0, opacity: 1, zIndex: 0 },
  { id: 'fabric-1', name: 'Petal Shape', color: '#f9a8d4', pattern: 'polka', x: 150, y: 130, width: 120, height: 100, rotation: 15, opacity: 0.9, zIndex: 1 },
  { id: 'fabric-2', name: 'Leaf Accent', color: '#86efac', pattern: 'stripe', x: 280, y: 180, width: 80, height: 60, rotation: -10, opacity: 0.8, zIndex: 2 },
  { id: 'fabric-3', name: 'Center Bloom', color: '#ec4899', pattern: 'solid', x: 200, y: 160, width: 60, height: 60, rotation: 0, opacity: 1, zIndex: 3 },
];

export const CollageStudio: React.FC = () => {
  const [layers, setLayers] = useState<FabricLayer[]>(DEFAULT_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('fabric-3');
  const [zoom, setZoom] = useState(1);

  // AI Generation state
  const [activeTab, setActiveTab] = useState<'prompt' | 'image'>('prompt');
  const [promptInput, setPromptInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; previewUrl: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState('');
  const [aiResult, setAiResult] = useState<AICollageResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState<'replace' | 'append'>('replace');

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

  const applyAiResult = () => {
    if (!aiResult?.layers) return;

    if (replaceMode === 'replace') {
      // Replace all layers with AI-generated ones
      setLayers(aiResult.layers);
      setSelectedLayerId(aiResult.layers[aiResult.layers.length - 1]?.id || 'bg');
    } else {
      // Append AI-generated layers to existing canvas
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
      const result = await api.generateCollageFromText(promptInput);
      clearInterval(interval);
      setGeneratorProgress(100);
      setProgressPhase('Collage complete!');
      setAiResult(result);
    } catch (err: any) {
      clearInterval(interval);
      setAiError(err.message || 'AI collage generation failed.');
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
    } catch (err: any) {
      clearInterval(interval);
      setAiError(err.message || 'Image collage generation failed.');
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
                  <button onClick={applyAiResult} className="btn-floral-primary text-xs py-1.5 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Apply to Canvas
                  </button>
                </>
              )}
              <button className="btn-floral-ghost text-xs py-1.5 px-3">
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
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
          {/* Left: Canvas (8 cols) */}
          <div className="lg:col-span-8">
            <div className="floral-card p-4">
              {/* Canvas Toolbar */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blush-100">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="btn-floral-ghost p-1.5"><ZoomIn className="h-4 w-4" /></button>
                  <span className="text-xs font-bold text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="btn-floral-ghost p-1.5"><ZoomOut className="h-4 w-4" /></button>
                  <button onClick={() => setZoom(1)} className="btn-floral-ghost p-1.5"><RotateCcw className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blush-500">
                  <Grid3X3 className="h-3.5 w-3.5" />
                  <span>{layers.length} layers</span>
                </div>
              </div>

              {/* Canvas Area */}
              <div
                className="relative bg-white rounded-2xl border-2 border-dashed border-blush-200 overflow-hidden"
                style={{ height: '500px' }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(#fce7f3 1px, transparent 1px), linear-gradient(90deg, #fce7f3 1px, transparent 1px)',
                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  {layers.sort((a, b) => a.zIndex - b.zIndex).map((layer) => (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`absolute cursor-move transition-shadow duration-200 ${
                        selectedLayerId === layer.id ? 'ring-2 ring-blush-500 ring-offset-2' : ''
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Inspector (4 cols) */}
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

              {/* Success message */}
              {aiResult && !isGenerating && (
                <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-[11px] text-emerald-800">
                    <strong>Success!</strong> {aiResult.totalLayers} layers generated. Click <strong>"Apply to Canvas"</strong> above to use them.
                  </p>
                </div>
              )}

              {/* Error message */}
              {aiError && (
                <div className="mt-3 p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  <p className="text-[11px] text-rose-800">{aiError}</p>
                </div>
              )}

              {/* Generated layers preview */}
              {aiResult && !isGenerating && aiResult.layers.length > 1 && (
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
                    onClick={() => setSelectedLayerId(layer.id)}
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
