import React, { useState } from 'react';
import { Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';

/**
 * StitchStyle interface
 */
interface StitchStyle {
  id: string;
  name: string;
  description: string;
}

/**
 * Interactive Designer Sandbox Component
 */
export const Designer: React.FC = () => {
  // Color palette for the custom stitcher
  const colors = [
    { name: 'Rose Red', hex: '#e11d48' },
    { name: 'Sunset Gold', hex: '#d97706' },
    { name: 'Forest Green', hex: '#16a34a' },
    { name: 'Ocean Blue', hex: '#0284c7' },
    { name: 'Royal Violet', hex: '#7c3aed' },
    { name: 'Warm Cream', hex: '#fef3c7' },
    { name: 'Pitch Black', hex: '#1e293b' },
  ];

  const stitchStyles: StitchStyle[] = [
    { id: 'cross', name: 'Cross Stitch', description: 'Traditional X-shaped intersection' },
    { id: 'satin', name: 'Satin Stitch', description: 'Flat, glossy parallel stitches' },
    { id: 'back', name: 'Back Stitch', description: 'Perfect for outlining fine borders' },
    { id: 'french', name: 'French Knot', description: 'Raised, textured point details' },
  ];

  // State for AI Generator
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [showDemoPattern, setShowDemoPattern] = useState(false);

  // State for Custom Paint Grid
  const [selectedColor, setSelectedColor] = useState(colors[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({}); // coordinates "x,y" -> color hex

  // Initialize a mock canvas size
  const gridSize = 16;

  // Handle cell click on the manual paint grid
  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    const newGrid = { ...grid };
    if (newGrid[key] === selectedColor) {
      delete newGrid[key]; // Toggle off if clicked with same color
    } else {
      newGrid[key] = selectedColor;
    }
    setGrid(newGrid);
  };

  // Clear manual painting
  const handleClearGrid = () => {
    setGrid({});
    setShowDemoPattern(false);
  };

  const [promptInput, setPromptInput] = useState('');

  const triggerGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsGenerating(true);
    setGeneratorProgress(10);
    setShowDemoPattern(false);

    // Simulate stepping through progress
    const interval = setInterval(() => {
      setGeneratorProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setShowDemoPattern(true);
          
          // Seed grid with a beautiful mock embroidery design pattern (a heart/rose shape)
          const mockPatternGrid: Record<string, string> = {};
          
          // Fill inside of the heart with rose color and gold details
          for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
              // Simple equations / bounds to fill heart
              if (r >= 3 && r <= 11 && c >= 3 && c <= 12) {
                const distFromCenterOfLeftLobe = Math.hypot(r - 5, c - 5);
                const distFromCenterOfRightLobe = Math.hypot(r - 5, c - 10);
                if (distFromCenterOfLeftLobe < 2.5 || distFromCenterOfRightLobe < 2.5 || (r >= 6 && r - c <= 5 && r + c <= 17)) {
                  mockPatternGrid[`${r},${c}`] = (r === 6 && c === 7) || (r === 7 && c === 8) ? '#d97706' : '#e11d48'; // warm rose and gold details
                }
              }
            }
          }
          setGrid(mockPatternGrid);
          return 100;
        }
        return prev + 15;
      });
    }, 350);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-brand-50 px-4 py-1 text-sm font-semibold leading-6 text-brand-600 ring-1 ring-inset ring-brand-100 mb-4">
            <Sparkles className="h-4 w-4 text-brand-500 animate-spin" />
            Empowering Serial Crafters
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            StitchWise AI Pattern Designer
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
            Bring your thoughts to life. Our upcoming **AI Digitizer** lets you describe any visual or upload a hand-drawn sketch, instantly outputting highly precise, stitch-ready embroidery patterns.
          </p>
        </div>

        {/* Sandbox Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Prompt & Settings */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Prompt Generator Box */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-brand-500" />
                Describe Your Vision
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Enter any design thought. If you can imagine the design, we will build a flawless pattern for it.
              </p>
              
              <form onSubmit={triggerGeneration} className="space-y-4">
                <textarea
                  rows={3}
                  disabled={isGenerating}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="e.g., A cozy miniature red cardinal perched on a birch branch covered in delicate winter snow"
                  className="w-full rounded-xl border-slate-200 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-brand-500 disabled:opacity-50"
                />
                
                {isGenerating ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-brand-700 font-semibold">
                      <span>Digitizing stitches...</span>
                      <span>{Math.min(generatorProgress, 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-600 h-full transition-all duration-300 ease-out" 
                        style={{ width: `${generatorProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={!promptInput.trim()}
                    className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all"
                  >
                    <Play className="h-4 w-4" />
                    Build Custom Pattern
                  </button>
                )}
              </form>

              {showDemoPattern && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <strong>Success!</strong> AI finished digitizing! See the simulated cross-stitch output on the canvas grid.
                  </p>
                </div>
              )}
            </div>

            {/* Pattern Settings Box */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Palette className="h-5 w-5 text-brand-500" />
                Designer Thread Box
              </h2>

              {/* Color Swatch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Active Thread Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => setSelectedColor(color.hex)}
                      title={color.name}
                      className={`h-8 w-8 rounded-full border transition-all duration-150 relative flex items-center justify-center`}
                      style={{ backgroundColor: color.hex, borderColor: selectedColor === color.hex ? '#000' : 'rgba(0,0,0,0.1)' }}
                    >
                      {selectedColor === color.hex && (
                        <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm invert" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stitch Type Selectors */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Active Stitch Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {stitchStyles.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStitch(style.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${selectedStitch === style.id ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="font-bold">{style.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Right panel: Active Sandbox Canvas Grid */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
              
              <div className="w-full flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-brand-500" />
                    Embroidery Fabric Canvas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click cells on the fine grid below to manual stitch or preview generated patterns.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleClearGrid}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200"
                    title="Clear Fabric Grid"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  
                  <button
                    disabled={Object.keys(grid).length === 0}
                    className="p-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    title="Export Pattern to Machine format"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export (.PES)
                  </button>
                </div>
              </div>

              {/* Grid Fabric Wrapper */}
              <div className="p-8 bg-amber-50/20 rounded-2xl border-4 border-dashed border-slate-200 relative shadow-inner max-w-full overflow-auto">
                {/* Simulated fabric texture lines */}
                <div className="grid grid-cols-16 gap-1 sm:gap-1.5 bg-amber-50/5 p-1 rounded">
                  {Array.from({ length: gridSize }).map((_, r) => (
                    <div key={r} className="flex gap-1 sm:gap-1.5">
                      {Array.from({ length: gridSize }).map((_, c) => {
                        const key = `${r},${c}`;
                        const color = grid[key];
                        return (
                          <button
                            key={c}
                            onClick={() => handleCellClick(r, c)}
                            className="h-5 w-5 sm:h-7 sm:w-7 rounded-md border flex items-center justify-center transition-all duration-100 hover:scale-105 active:scale-95 focus:outline-none"
                            style={{ 
                              backgroundColor: color || '#fafaf9', 
                              borderColor: color ? 'rgba(0,0,0,0.1)' : '#f3f4f6' 
                            }}
                          >
                            {/* If there is a stitch color, draw the cross thread mark */}
                            {color ? (
                              <span className="text-[10px] font-bold text-white opacity-60">X</span>
                            ) : (
                              <span className="block h-1 w-1 rounded-full bg-slate-300/40" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info/Gotcha disclaimer */}
              <div className="w-full mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 leading-relaxed">
                  <p className="font-semibold">Future AI Digitizer Integration</p>
                  <p className="mt-0.5">
                    StitchWise is currently building server-side integration pipelines. Describe a design above and click <strong>Build Custom Pattern</strong> to witness our automated stitch rendering system in action!
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
