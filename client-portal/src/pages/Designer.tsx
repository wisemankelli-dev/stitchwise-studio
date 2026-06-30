import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw, 
  UploadCloud, Image, Sliders, Eye, Trash2, ArrowLeft,
  Scissors, Square
} from 'lucide-react';

/**
 * StitchStyle interface
 */
interface StitchStyle {
  id: string;
  name: string;
  description: string;
}

/**
 * Interactive Solo Designer Sandbox Component
 * A single-user pattern design workspace with AI generation and manual tools.
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

  const gridSize = 16;

  // Canvas & AI state
  const [activeTab, setActiveTab] = useState<'prompt' | 'image'>('prompt');
  const [uploadedFile, setUploadedFile] = useState<{name: string, size: string, previewUrl: string} | null>(null);
  const [digitizeStitchCount, setDigitizeStitchCount] = useState<number>(1500);
  const [digitizeColorsCount, setDigitizeColorsCount] = useState<number>(8);
  const [digitizeStitchType, setDigitizeStitchType] = useState<string>('cross');
  const [digitizeStepText, setDigitizeStepText] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'pattern' | 'original'>('pattern');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [showDemoPattern, setShowDemoPattern] = useState(false);

  // Custom Paint Grid (coordinates "x,y" -> color hex)
  const [selectedColor, setSelectedColor] = useState(colors[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({}); 
  const [gridStitchTypes, setGridStitchTypes] = useState<Record<string, string>>({});

  // Last saved ref for autosave
  const lastSaved = useRef<Record<string, string>>({});

  const [promptInput, setPromptInput] = useState('');

  // Handle cell click on the manual paint grid
  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    const newGrid = { ...grid };
    const newStitchTypes = { ...gridStitchTypes };
    if (newGrid[key] === selectedColor) {
      delete newGrid[key]; // Toggle off if clicked with same color
      delete newStitchTypes[key];
    } else {
      newGrid[key] = selectedColor;
      newStitchTypes[key] = selectedStitch;
    }
    setGrid(newGrid);
    setGridStitchTypes(newStitchTypes);
  };

  // Clear manual painting
  const handleClearGrid = () => {
    setGrid({});
    setGridStitchTypes({});
    setShowDemoPattern(false);
  };

  // AI Generation simulation
  const triggerGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsGenerating(true);
    setGeneratorProgress(10);
    setShowDemoPattern(false);

    // Trigger API call
    const apiPromise = api.generateStitches(promptInput, 'DST', { fillType: digitizeStitchType });

    // Simulate stepping through progress
    const interval = setInterval(() => {
      setGeneratorProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          
          apiPromise.then(() => {
            setIsGenerating(false);
            setShowDemoPattern(true);
            
            // Seed grid with a beautiful rose heart
            const mockPatternGrid: Record<string, string> = {};
            const mockStitchTypes: Record<string, string> = {};
            for (let r = 0; r < gridSize; r++) {
              for (let c = 0; c < gridSize; c++) {
                if (r >= 3 && r <= 11 && c >= 3 && c <= 12) {
                  const distFromCenterOfLeftLobe = Math.hypot(r - 5, c - 5);
                  const distFromCenterOfRightLobe = Math.hypot(r - 5, c - 10);
                  if (distFromCenterOfLeftLobe < 2.5 || distFromCenterOfRightLobe < 2.5 || (r >= 6 && r - c <= 5 && r + c <= 17)) {
                    const key = `${r},${c}`;
                    mockPatternGrid[key] = (r === 6 && c === 7) || (r === 7 && c === 8) ? '#d97706' : '#e11d48'; 
                    mockStitchTypes[key] = digitizeStitchType;
                  }
                }
              }
            }
            setGrid(mockPatternGrid);
            setGridStitchTypes(mockStitchTypes);
          });
          
          return 100;
        }
        return prev + 15;
      });
    }, 350);
  };

  // Pre-compiled Mock Sunflower Cross-Stitch Grid for Image Digitizer simulation
  const mockSunflowerGrid: Record<string, string> = {
    '10,8': '#16a34a', '11,8': '#16a34a', '12,8': '#16a34a', '13,8': '#16a34a', '14,8': '#16a34a',
    '11,7': '#16a34a', '12,9': '#16a34a', '7,7': '#1e293b', '7,8': '#1e293b', '8,7': '#1e293b',
    '8,8': '#1e293b', '6,6': '#d97706', '6,7': '#d97706', '6,8': '#d97706', '6,9': '#d97706',
    '7,6': '#d97706', '7,9': '#d97706', '8,6': '#d97706', '8,9': '#d97706', '9,6': '#d97706',
    '9,7': '#d97706', '9,8': '#d97706', '9,9': '#d97706', '5,7': '#d97706', '5,8': '#d97706',
    '7,5': '#d97706', '8,5': '#d97706', '7,10': '#d97706', '8,10': '#d97706', '9,5': '#d97706',
    '9,10': '#d97706', '10,7': '#d97706', '5,6': '#fef3c7', '5,9': '#fef3c7',
    '6,5': '#fef3c7', '6,10': '#fef3c7'
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadedFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        previewUrl: URL.createObjectURL(file)
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        previewUrl: URL.createObjectURL(file)
      });
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setShowDemoPattern(false);
  };

  const triggerImageDigitization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;

    setIsGenerating(true);
    setGeneratorProgress(5);
    setDigitizeStepText('Analyzing color channels...');
    setShowDemoPattern(false);

    // Trigger API conversion
    const apiPromise = api.convertStitches(new File([], uploadedFile.name), 'DST', { fillType: digitizeStitchType });

    const steps = [
      { threshold: 25, text: 'Mapping colors to DMC standard threads...' },
      { threshold: 50, text: 'Tracing stitch outline coordinates...' },
      { threshold: 75, text: 'Calculating satin fill density & thread yields...' },
      { threshold: 100, text: 'Compiling machine-readable stitch paths...' }
    ];

    const interval = setInterval(() => {
      setGeneratorProgress((prev) => {
        const next = prev + 12;
        if (next >= 100) {
          clearInterval(interval);
          
          apiPromise.then(() => {
            setIsGenerating(false);
            setShowDemoPattern(true);
            setPreviewMode('pattern');
            
            const mockStitchTypes: Record<string, string> = {};
            Object.keys(mockSunflowerGrid).forEach((key) => {
              mockStitchTypes[key] = digitizeStitchType;
            });
            setGrid(mockSunflowerGrid);
            setGridStitchTypes(mockStitchTypes);
          });
          
          return 100;
        }
        
        const currentStep = steps.find(s => next < s.threshold);
        if (currentStep) {
          setDigitizeStepText(currentStep.text);
        }
        
        return next;
      });
    }, 400);
  };

  const renderOriginalImage = () => {
    if (uploadedFile?.name.includes('sunflower') || showDemoPattern) {
      return (
        <svg className="w-48 h-48 mx-auto animate-fade-in" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="18" fill="#78350f" stroke="#451a03" strokeWidth="2" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 360) / 12;
            return (
              <path
                key={i}
                d="M 50 15 C 45 30, 45 40, 50 50 C 55 40, 55 30, 50 15"
                fill="#fbbf24"
                stroke="#d97706"
                strokeWidth="1"
                transform={`rotate(${angle} 50 50)`}
              />
            );
          })}
          <path d="M 50 68 L 50 95" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
          <path d="M 50 80 Q 40 75, 35 80 Q 42 85, 50 82" fill="#10b981" stroke="#047857" strokeWidth="1" />
          <path d="M 50 85 Q 60 82, 65 87 Q 58 90, 50 87" fill="#10b981" stroke="#047857" strokeWidth="1" />
        </svg>
      );
    } else {
      return (
        <svg className="w-48 h-48 mx-auto animate-fade-in" viewBox="0 0 100 100">
          <path
            d="M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z"
            fill="#f43f5e"
            stroke="#be123c"
            strokeWidth="3"
          />
          <circle cx="50" cy="45" r="8" fill="#e11d48" />
          <circle cx="50" cy="45" r="4" fill="#fb7185" />
        </svg>
      );
    }
  };

  // Autosave grid state locally
  const saveToLocalStorage = () => {
    const dataToSave = { grid, stitchTypes: gridStitchTypes };
    localStorage.setItem('stitchwise_designer_save', JSON.stringify(dataToSave));
    lastSaved.current = grid;
  };

  // Save when grid changes (debounced)
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      saveToLocalStorage();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [grid, gridStitchTypes]);

  // Load saved state on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('stitchwise_designer_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.grid) setGrid(parsed.grid);
        if (parsed.stitchTypes) setGridStitchTypes(parsed.stitchTypes);
      } catch (e) {
        console.error('Failed to restore saved design', e);
      }
    }
  }, []);

  return (
    <div className="bg-floral-soft min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden">

      <div className="max-w-7xl mx-auto">
        
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex justify-between items-center">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-blush-600 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50 px-4 py-1 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-100 mb-4">
            <Scissors className="h-4 w-4 text-blush-500" />
            Solo Designer Studio
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
            StitchWise <span className="text-gradient-floral">Pattern Designer</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
            Design perfect patterns stitch by stitch. Use AI to generate patterns from text or images, 
            then refine every detail on your personal canvas.
          </p>
        </div>

        {/* Sandbox Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Prompt & Settings */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Tabbed Design Panel */}
            <div className="floral-card p-6">
              
              {/* Segments Tab Bar */}
              <div className="flex border-b border-blush-100 mb-6">
                <button
                  onClick={() => setActiveTab('prompt')}
                  disabled={isGenerating}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${activeTab === 'prompt' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    AI Vision Prompt
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('image')}
                  disabled={isGenerating}
                  className={`flex-1 pb-3 text-xs font-bold text-center border-b-2 transition-all ${activeTab === 'image' ? 'border-blush-600 text-blush-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Image className="h-4 w-4" />
                    Digitize Image
                  </div>
                </button>
              </div>

              {activeTab === 'prompt' ? (
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-blush-500" />
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
                      placeholder="e.g., A cozy miniature red cardinal perched on a birch branch covered in winter snow"
                      className="w-full rounded-xl border-blush-100 text-sm text-slate-800 shadow-sm focus:border-blush-500 focus:ring-blush-500 disabled:opacity-50 placeholder:text-blush-300"
                    />
                    
                    {isGenerating ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-blush-700 font-semibold">
                          <span>Digitizing stitches...</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blush-500 h-full transition-all duration-300 ease-out" 
                            style={{ width: `${generatorProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={!promptInput.trim()}
                        className="w-full rounded-xl bg-blush-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blush-600 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all"
                      >
                        <Play className="h-4 w-4" />
                        Build Custom Pattern
                      </button>
                    )}
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-blush-500" />
                    Upload Craft Sketch
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Transform hand-drawn diagrams, scans, or pictures directly into optimized needlepoint grids.
                  </p>

                  {/* Drag-and-Drop Area */}
                  {!uploadedFile ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDraggingOver ? 'border-blush-500 bg-blush-50/50' : 'border-blush-200 bg-garden-cream hover:bg-blush-50/50'}`}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer block space-y-2">
                        <UploadCloud className="h-8 w-8 mx-auto text-blush-400" />
                        <span className="block text-xs font-bold text-slate-700">Drag & drop sketch file here</span>
                        <span className="block text-[10px] text-slate-400">or click to browse local files (PNG, JPG, SVG)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-4 bg-garden-cream rounded-xl border border-blush-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-blush-100 flex items-center justify-center text-blush-600 shrink-0 font-bold text-xs uppercase">
                          IMG
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate" title={uploadedFile.name}>
                            {uploadedFile.name}
                          </p>
                          <p className="text-[10px] text-slate-500">{uploadedFile.size}</p>
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveFile}
                        disabled={isGenerating}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                        title="Remove uploaded image"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Digitize Parameters Form */}
                  <form onSubmit={triggerImageDigitization} className="space-y-4">
                    {/* Stitch Count (Resolution) Slider */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-bold text-slate-700 flex items-center gap-1">
                          <Sliders className="h-3 w-3 text-blush-500" />
                          Stitch Count
                        </label>
                        <span className="font-mono text-blush-700 font-bold">{digitizeStitchCount} stitches</span>
                      </div>
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="500"
                        disabled={isGenerating}
                        value={digitizeStitchCount}
                        onChange={(e) => setDigitizeStitchCount(parseInt(e.target.value))}
                        className="w-full accent-blush-500 h-1.5 bg-blush-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 font-semibold">
                        <span>500 (Coarse)</span>
                        <span>Estimated DMC thread: {Math.ceil(digitizeStitchCount / 800 * 10) / 10} skeins</span>
                        <span>5000 (Detailed)</span>
                      </div>
                    </div>

                    {/* Color Palette Size */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Color Palette Size
                      </label>
                      <select
                        value={digitizeColorsCount}
                        disabled={isGenerating}
                        onChange={(e) => setDigitizeColorsCount(parseInt(e.target.value))}
                        className="w-full rounded-xl border-blush-100 text-xs text-slate-800 focus:border-blush-500 focus:ring-blush-500"
                      >
                        <option value={4}>4 Threads (Minimalist Retro)</option>
                        <option value={8}>8 Threads (Standard Starter)</option>
                        <option value={12}>12 Threads (Vivid Detail)</option>
                        <option value={16}>16 Threads (Premium Studio)</option>
                      </select>
                    </div>

                    {/* Stitch Style Select */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Primary Stitch Type
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['cross', 'back', 'satin'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            disabled={isGenerating}
                            onClick={() => {
                              setDigitizeStitchType(type);
                              setSelectedStitch(type);
                            }}
                            className={`py-1.5 rounded-lg text-[10px] font-bold text-center border capitalize transition-all ${digitizeStitchType === type ? 'bg-blush-50 border-blush-500 text-blush-700 shadow-sm' : 'bg-white border-blush-100 text-slate-500 hover:bg-blush-50'}`}
                          >
                            {type === 'cross' ? 'Cross' : type === 'back' ? 'Back' : 'Satin'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Digitize progress loader / submit button */}
                    {isGenerating ? (
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between text-xs text-blush-700 font-semibold animate-pulse">
                          <span>{digitizeStepText}</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-blush-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-blush-500 h-full transition-all duration-300 ease-out animate-pulse" 
                            style={{ width: `${generatorProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="submit"
                        disabled={!uploadedFile}
                        className="w-full rounded-xl bg-blush-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blush-600 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all mt-2"
                      >
                        <Play className="h-4 w-4" />
                        Digitize & Generate Pattern
                      </button>
                    )}
                  </form>
                </div>
              )}

              {showDemoPattern && (
                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 animate-bounce" />
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <strong>Success!</strong> AI finished digitizing! Click the <strong>Pattern View</strong> / <strong>Original Image</strong> toggles on the canvas to inspect results.
                  </p>
                </div>
              )}
            </div>

            {/* Pattern Settings Box */}
            <div className="floral-card p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Palette className="h-5 w-5 text-blush-500" />
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
                      className="h-8 w-8 rounded-full border transition-all duration-150 relative flex items-center justify-center"
                      style={{ backgroundColor: color.hex, borderColor: selectedColor === color.hex ? '#000' : 'rgba(0,0,0,0.1)' }}
                    >
                      {selectedColor === color.hex && (
                        <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />
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
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${selectedStitch === style.id ? 'border-blush-600 bg-blush-50 text-blush-800 ring-1 ring-blush-500' : 'border-blush-100 bg-white hover:bg-blush-50 text-slate-700'}`}
                    >
                      <div className="font-bold">{style.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Center: Fabric Grid Canvas */}
          <div className="lg:col-span-8 space-y-6">
            <div className="floral-card p-6 flex flex-col items-center">
              
              <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-blush-100 pb-4 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blush-500" />
                    Embroidery Fabric Canvas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click cells on the grid below to manually stitch or preview generated patterns.
                  </p>
                </div>
                
                {/* Original vs. Pattern Preview Toggle */}
                {(showDemoPattern || uploadedFile) && (
                  <div className="flex bg-blush-50 p-1 rounded-xl border border-blush-100 shadow-inner">
                    <button
                      onClick={() => setPreviewMode('pattern')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${previewMode === 'pattern' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Layers className="h-3.5 w-3.5 text-blush-500" />
                      Pattern View
                    </button>
                    <button
                      onClick={() => setPreviewMode('original')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${previewMode === 'original' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Eye className="h-3.5 w-3.5 text-blush-500" />
                      Original Image
                    </button>
                  </div>
                )}
                
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleClearGrid}
                    className="p-2 rounded-lg bg-garden-cream hover:bg-blush-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-blush-100"
                    title="Clear Fabric Grid"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                  
                  <button
                    disabled={Object.keys(grid).length === 0}
                    className="p-2 rounded-lg bg-blush-500 hover:bg-blush-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    title="Export Pattern to PES format"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export (.PES)
                  </button>
                </div>
              </div>

              {/* Grid Fabric Canvas Wrapper */}
              <div className="p-8 bg-amber-50/20 rounded-2xl border-4 border-dashed border-blush-100 relative shadow-inner max-w-full overflow-auto flex items-center justify-center min-h-[360px]">
                
                {previewMode === 'original' ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-white/90 rounded-2xl shadow-sm border border-blush-100 max-w-sm mx-auto text-center animate-fade-in relative z-10">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-blush-600 mb-4 block">Original Sketch Source</span>
                    <div className="p-4 bg-garden-cream rounded-2xl border border-blush-100 shadow-inner">
                      {renderOriginalImage()}
                    </div>
                    <span className="text-xs font-extrabold text-slate-800 mt-4 block truncate max-w-[240px]">
                      {uploadedFile ? uploadedFile.name : 'Simulated Prompt Vector Sketch'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Resolution: High Fidelity Design Grid Map
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-16 gap-1 sm:gap-1.5 bg-amber-50/5 p-1 rounded relative">
                    {/* Fabric grid rows */}
                    {Array.from({ length: gridSize }).map((_, r) => (
                      <div key={r} className="flex gap-1 sm:gap-1.5">
                        {Array.from({ length: gridSize }).map((_, c) => {
                          const key = `${r},${c}`;
                          const color = grid[key];
                          const stitchType = gridStitchTypes[key];
                          const isSatin = stitchType === 'satin';
                          const isBack = stitchType === 'back';
                          return (
                            <button
                              key={c}
                              onClick={() => handleCellClick(r, c)}
                              className="h-5 w-5 sm:h-7 sm:w-7 rounded-md border flex items-center justify-center transition-all duration-100 hover:scale-105 active:scale-95 focus:outline-none"
                              style={{ 
                                backgroundColor: color || '#fafaf9', 
                                borderColor: color ? 'rgba(0,0,0,0.1)' : '#fce7f3',
                                background: isSatin && color ? `linear-gradient(45deg, ${color} 25%, rgba(255,255,255,0.2) 50%, ${color} 75%)` : color || '#fafaf9',
                                boxShadow: isSatin && color ? '0 0 4px rgba(255,255,255,0.4) inset' : undefined
                              }}
                            >
                              {/* Draw thread cross marks */}
                              {color ? (
                                isSatin ? (
                                  <span className="text-[12px] font-extrabold text-white opacity-90 tracking-tighter select-none animate-pulse">|||</span>
                                ) : isBack ? (
                                  <span className="text-[10px] font-extrabold text-white opacity-80 select-none">─</span>
                                ) : (
                                  <span className="text-[10px] font-bold text-white opacity-60 select-none">X</span>
                                )
                              ) : (
                                <span className="block h-1 w-1 rounded-full bg-blush-300/40" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid info */}
              <div className="w-full mt-4 flex items-center justify-between p-3 bg-garden-cream border border-blush-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4 text-blush-500" />
                  <span className="text-xs font-bold text-slate-700">{gridSize}x{gridSize} Grid</span>
                </div>
                <span className="text-xs text-slate-500">
                  {Object.keys(grid).length} stitches placed
                </span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
};