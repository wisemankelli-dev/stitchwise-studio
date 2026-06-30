import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw, ZoomIn, ZoomOut, Layers, Grid3X3,
  Palette, Scissors, Download, Save, Trash2, Plus,
  ArrowLeft
} from 'lucide-react';

interface FabricLayer {
  id: string;
  name: string;
  color: string;
  pattern: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}

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

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* Header */}
      <div className="bg-white border-b border-blush-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-blush-500 hover:text-blush-600 transition-colors">
                <ArrowLeft className="h-5 w-5" />
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