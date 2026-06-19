import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw, 
  Share2, Users, Clipboard, Check, Send, Activity, X, Flame, ArrowLeft
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
 * Collaborator interface
 */
interface Collaborator {
  id: string;
  name: string;
  avatar: string;
  color: string; // Hex color for cursor/marker
  status: 'active' | 'idle' | 'offline';
  role: 'owner' | 'editor' | 'viewer';
  cursorPos?: string; // "x,y" coordinates
}

/**
 * LogEntry interface for real-time collaboration logs
 */
interface LogEntry {
  id: string;
  user: string;
  avatar: string;
  action: string;
  time: string;
  color?: string;
}

/**
 * Interactive Designer Sandbox Component with full Collaborative Workshop UI
 */
export const Designer: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');

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

  // Grid size
  const gridSize = 16;

  // --- COLLABORATION STATE ---
  const [isCollabMode, setIsCollabMode] = useState<boolean>(!!sessionParam);
  const [sessionId, setSessionId] = useState<string>(sessionParam || '');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [collabSyncActive, setCollabSyncActive] = useState<boolean>(true);
  const [recentNotification, setRecentNotification] = useState<string | null>(null);

  // Active Collaborators List
  const [collaborators, setCollaborators] = useState<Collaborator[]>([
    { id: 'you', name: 'You (César)', avatar: '👑', color: '#e11d48', status: 'active', role: 'owner' },
    { id: 'elena', name: 'Elena Crafter', avatar: '🌸', color: '#8b5cf6', status: 'active', role: 'editor', cursorPos: '3,4' },
    { id: 'dave', name: 'Dave Digitizer', avatar: '🐕', color: '#f59e0b', status: 'active', role: 'editor', cursorPos: '11,12' },
    { id: 'sofia', name: 'Sofia R.', avatar: '🦉', color: '#10b981', status: 'idle', role: 'viewer' }
  ]);

  // Collaboration Logs
  const [collabLogs, setCollabLogs] = useState<LogEntry[]>([
    { id: '1', user: 'System', avatar: '⚙️', action: 'Collaborative Workshop initialized', time: '10 mins ago' },
    { id: '2', user: 'Dave Digitizer', avatar: '🐕', action: 'Set active stitch style to Back Stitch', time: '8 mins ago' },
    { id: '3', user: 'Elena Crafter', avatar: '🌸', action: 'Painted Rose Red cross stitch at (4, 4)', time: '5 mins ago' }
  ]);

  // --- CANVAS & AI STATE ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorProgress, setGeneratorProgress] = useState(0);
  const [showDemoPattern, setShowDemoPattern] = useState(false);

  // Custom Paint Grid (coordinates "x,y" -> color hex)
  const [selectedColor, setSelectedColor] = useState(colors[0].hex);
  const [selectedStitch, setSelectedStitch] = useState('cross');
  const [grid, setGrid] = useState<Record<string, string>>({}); 

  // Handle cell click on the manual paint grid
  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    const newGrid = { ...grid };
    if (newGrid[key] === selectedColor) {
      delete newGrid[key]; // Toggle off if clicked with same color
      addCollabLog('You (César)', '👑', `Cleared stitch at (${x}, ${y})`);
    } else {
      newGrid[key] = selectedColor;
      const colorName = colors.find(c => c.hex === selectedColor)?.name || selectedColor;
      const stitchName = stitchStyles.find(s => s.id === selectedStitch)?.name || selectedStitch;
      addCollabLog('You (César)', '👑', `Painted ${colorName} (${stitchName}) at (${x}, ${y})`);
    }
    setGrid(newGrid);
  };

  // Helper to add collab logs
  const addCollabLog = (user: string, avatar: string, action: string, color?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      user,
      avatar,
      action,
      time: 'Just now',
      color
    };
    setCollabLogs(prev => [newLog, ...prev.slice(0, 9)]); // Cap at 10 items
  };

  // Clear manual painting
  const handleClearGrid = () => {
    setGrid({});
    setShowDemoPattern(false);
    addCollabLog('You (César)', '👑', 'Cleared the entire fabric canvas');
  };

  const [promptInput, setPromptInput] = useState('');

  // AI Generation simulation
  const triggerGeneration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setIsGenerating(true);
    setGeneratorProgress(10);
    setShowDemoPattern(false);
    addCollabLog('You (César)', '👑', `Started AI digitizer for prompt: "${promptInput}"`);

    // Simulate stepping through progress
    const interval = setInterval(() => {
      setGeneratorProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setShowDemoPattern(true);
          
          // Seed grid with a beautiful rose heart
          const mockPatternGrid: Record<string, string> = {};
          for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
              if (r >= 3 && r <= 11 && c >= 3 && c <= 12) {
                const distFromCenterOfLeftLobe = Math.hypot(r - 5, c - 5);
                const distFromCenterOfRightLobe = Math.hypot(r - 5, c - 10);
                if (distFromCenterOfLeftLobe < 2.5 || distFromCenterOfRightLobe < 2.5 || (r >= 6 && r - c <= 5 && r + c <= 17)) {
                  mockPatternGrid[`${r},${c}`] = (r === 6 && c === 7) || (r === 7 && c === 8) ? '#d97706' : '#e11d48'; 
                }
              }
            }
          }
          setGrid(mockPatternGrid);
          addCollabLog('AI Digitizer', '🤖', `Successfully compiled AI stitch-pattern from prompt`);
          return 100;
        }
        return prev + 15;
      });
    }, 350);
  };

  // Initialize collab mode if user loads from direct link
  useEffect(() => {
    if (sessionParam) {
      setIsCollabMode(true);
      setSessionId(sessionParam);
      addCollabLog('System', '⚙️', `Successfully connected to collaborative workshop session #${sessionParam}`);
    }
  }, [sessionParam]);

  // --- REAL-TIME COLLABORATIVE SYNC SIMULATOR ---
  useEffect(() => {
    if (!isCollabMode || !collabSyncActive) return;

    const interval = setInterval(() => {
      // Choose randomly between Elena (2) and Dave (3)
      const randomCollabIndex = Math.random() > 0.5 ? 1 : 2;
      const teammate = collaborators[randomCollabIndex];
      
      // Select random coordinates on fabric grid
      const r = Math.floor(Math.random() * gridSize);
      const c = Math.floor(Math.random() * gridSize);
      const coordKey = `${r},${c}`;
      
      // Randomly decide to add or clear a stitch
      const willAddStitch = Math.random() > 0.3;
      
      setGrid(prev => {
        const updated = { ...prev };
        if (willAddStitch) {
          // Choose a random color from colors palette
          const randomColorObj = colors[Math.floor(Math.random() * colors.length)];
          updated[coordKey] = randomColorObj.hex;
          
          // Trigger notification & logging
          const actionMsg = `Painted ${randomColorObj.name} stitch at (${r}, ${c})`;
          setRecentNotification(`${teammate.avatar} ${teammate.name}: ${actionMsg}`);
          addCollabLog(teammate.name, teammate.avatar, actionMsg, teammate.color);
        } else {
          if (updated[coordKey]) {
            delete updated[coordKey];
            const actionMsg = `Cleared stitch at (${r}, ${c})`;
            setRecentNotification(`${teammate.avatar} ${teammate.name}: ${actionMsg}`);
            addCollabLog(teammate.name, teammate.avatar, actionMsg, teammate.color);
          }
        }
        return updated;
      });

      // Update collaborator's active cursor position
      setCollaborators(prev => prev.map(collab => {
        if (collab.id === teammate.id) {
          return { ...collab, cursorPos: coordKey, status: 'active' };
        }
        return collab;
      }));

      // Auto dismiss notifications after 4 seconds
      setTimeout(() => {
        setRecentNotification(null);
      }, 4000);

    }, 11000); // Trigger a collaborator action every 11 seconds

    return () => clearInterval(interval);
  }, [isCollabMode, collabSyncActive, collaborators]);

  // Go live action
  const handleGoLive = () => {
    const randomId = `collab-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(randomId);
    setIsCollabMode(true);
    addCollabLog('You (César)', '👑', `Generated live collaborative workshop session #${randomId}`);
    setIsShareModalOpen(true);
  };

  // Copy share invite link to clipboard
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/designer?session=${sessionId || 'quick-workshop'}`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Handle invitation email submission
  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    // Simulate sending email
    setInviteSuccessMsg(`Sending invitation to ${inviteEmail}...`);
    setTimeout(() => {
      setInviteSuccessMsg(`Success! ${inviteEmail} was invited as an ${inviteRole}.`);
      
      // Simulate invitee joining after 6 seconds!
      setTimeout(() => {
        const newCollabId = `invited-${Date.now()}`;
        const newCollabName = inviteEmail.split('@')[0];
        const formattedName = newCollabName.charAt(0).toUpperCase() + newCollabName.slice(1);
        
        const newInvitee: Collaborator = {
          id: newCollabId,
          name: `${formattedName} (Invited)`,
          avatar: '🎨',
          color: '#ec4899', // Pink cursor
          status: 'active',
          role: inviteRole
        };
        
        setCollaborators(prev => [...prev, newInvitee]);
        addCollabLog(`${formattedName} (Invited)`, '🎨', `Joined the collaborative session as ${inviteRole}`);
        setRecentNotification(`🎨 ${formattedName} joined the workshop live!`);
        
        setTimeout(() => setRecentNotification(null), 4000);
      }, 6000);

      setInviteEmail('');
    }, 1200);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16 px-6 lg:px-8 relative overflow-hidden">
      
      {/* Real-time sync floating alert toast */}
      {recentNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-4 rounded-2xl shadow-lg border border-slate-800 flex items-center gap-3 animate-bounce max-w-sm">
          <Activity className="h-5 w-5 text-brand-500 animate-pulse shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-slate-200">Live Sync Update</span>
            <p className="text-slate-400 mt-0.5">{recentNotification}</p>
          </div>
          <button onClick={() => setRecentNotification(null)} className="text-slate-500 hover:text-white ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex justify-between items-center">
          <Link to="/dashboard" className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          {isCollabMode && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-100 text-xs font-bold shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Live Connected (Session #{sessionId})
            </div>
          )}
        </div>

        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-x-2 rounded-full bg-brand-50 px-4 py-1 text-sm font-semibold leading-6 text-brand-600 ring-1 ring-inset ring-brand-100 mb-4">
            <Users className="h-4 w-4 text-brand-500" />
            Collaborative Pattern Workshop
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            StitchWise Collaborative Studio
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
            Design perfect patterns by yourself or with co-crafters in real-time. Invite other designers or hobbyists to stitch, edit, and review patterns collaboratively.
          </p>
        </div>
        
        {/* Workshop Collaboration Status Banner */}
        <div className="bg-gradient-to-r from-brand-600 to-rose-500 rounded-3xl p-6 md:p-8 text-white shadow-md mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20 pointer-events-none" />
          <div className="z-10 max-w-xl">
            <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
              <Activity className="h-6 w-6 text-amber-300" />
              {isCollabMode ? 'Collaborative Workshop Live!' : 'Design Privately or Invite the World'}
            </h2>
            <p className="mt-2 text-sm text-slate-100 leading-relaxed">
              {isCollabMode 
                ? 'Your fabric canvas is synchronized with the workshop session. All active collaborators can place and view stitch layouts instantly with near-zero latency.' 
                : 'Turn your design workspace into a live workshop session. Co-design with other crafters, share a dynamic invite link, and work together on fine-grained pixel grids.'}
            </p>
          </div>

          <div className="z-10 flex gap-3 shrink-0">
            {isCollabMode ? (
              <>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-white text-brand-700 hover:bg-slate-50 font-bold text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4 text-brand-600" />
                  Invite & Manage
                </button>
                <button
                  onClick={() => {
                    setIsCollabMode(false);
                    setSessionId('');
                    addCollabLog('System', '⚙️', 'Switched to private sandbox mode');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-800/40 border border-white/20 text-white hover:bg-slate-800/60 font-bold text-sm transition-all"
                >
                  Go Private
                </button>
              </>
            ) : (
              <button
                onClick={handleGoLive}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-sm shadow-sm transition-all flex items-center gap-2"
              >
                <Flame className="h-4.5 w-4.5 text-slate-900 animate-pulse" />
                Start Live Workshop Session
              </button>
            )}
          </div>
        </div>

        {/* Sandbox Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Prompt & Settings */}
          <div className="lg:col-span-4 space-y-6">
            
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
                  placeholder="e.g., A cozy miniature red cardinal perched on a birch branch covered in winter snow"
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
                      className="h-8 w-8 rounded-full border transition-all duration-150 relative flex items-center justify-center"
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

          {/* Center/Right: Fabric Grid Canvas */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
              
              <div className="w-full flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-brand-500" />
                    Embroidery Fabric Canvas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click cells on the grid below to manual stitch or preview generated pattern stitches.
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
                    title="Export Pattern to PES format"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export (.PES)
                  </button>
                </div>
              </div>

              {/* Grid Fabric Canvas Wrapper */}
              <div className="p-8 bg-amber-50/20 rounded-2xl border-4 border-dashed border-slate-200 relative shadow-inner max-w-full overflow-auto">
                <div className="grid grid-cols-16 gap-1 sm:gap-1.5 bg-amber-50/5 p-1 rounded relative">
                  
                  {/* Floating active collaborator cursor highlights overlaid on the grid */}
                  {isCollabMode && collaborators.map(collab => {
                    if (collab.id === 'you' || !collab.cursorPos || collab.status !== 'active') return null;
                    const [rStr, cStr] = collab.cursorPos.split(',');
                    const rowNum = parseInt(rStr);
                    const colNum = parseInt(cStr);
                    
                    // Simple styling to position cursors based on rows
                    return (
                      <div 
                        key={collab.id}
                        className="absolute h-5 w-5 sm:h-7 sm:w-7 border-2 rounded-md pointer-events-none z-20 flex items-center justify-center transition-all duration-300"
                        style={{
                          borderColor: collab.color,
                          top: `calc(${rowNum * (20 + 4) + 4}px)`, // matches button sizes + gaps
                          left: `calc(${colNum * (20 + 4) + 4}px)`,
                          backgroundColor: `${collab.color}15`,
                        }}
                      >
                        <span className="absolute -top-5 left-0 px-1 py-0.5 rounded text-[8px] text-white font-extrabold shrink-0 truncate max-w-[80px]" style={{ backgroundColor: collab.color }}>
                          {collab.name.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}

                  {/* Fabric grid rows */}
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
                            {/* Draw thread cross marks */}
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

              {/* Real-time Sync Controller */}
              {isCollabMode && (
                <div className="w-full mt-4 flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-brand-600 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700">Workshop Sync Stream</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-slate-500 font-medium">Simulate Teammate Stitches</span>
                    <input 
                      type="checkbox" 
                      checked={collabSyncActive}
                      onChange={(e) => {
                        setCollabSyncActive(e.target.checked);
                        addCollabLog('System', '⚙️', e.target.checked ? 'Enabled teammate update simulation' : 'Paused teammate update simulation');
                      }}
                      className="rounded text-brand-600 focus:ring-brand-500 h-4.5 w-4.5"
                    />
                  </label>
                </div>
              )}

            </div>
          </div>

          {/* Right Panel: Workshop Sidebar */}
          {isCollabMode && (
            <div className="lg:col-span-12 xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              
              {/* Collaborators List Panel */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-brand-500" />
                    Active Workshop Collaborators
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                    {collaborators.filter(c => c.status === 'active').length} Online
                  </span>
                </div>

                <div className="space-y-4">
                  {collaborators.map((collab) => (
                    <div key={collab.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="text-2xl" role="img" aria-label="avatar">{collab.avatar}</span>
                          <span 
                            className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${collab.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`}
                            title={collab.status}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-800">{collab.name}</span>
                            <span className="capitalize text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {collab.role}
                            </span>
                          </div>
                          {collab.cursorPos && collab.status === 'active' && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: collab.color }} />
                              Stitching at ({collab.cursorPos})
                            </p>
                          )}
                        </div>
                      </div>

                      {collab.id !== 'you' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {collab.status}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Activities Logs */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-brand-500" />
                    Workshop Activity Stream
                  </h3>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                  {collabLogs.map((logItem) => (
                    <div key={logItem.id} className="flex items-start gap-2.5 text-xs text-slate-600 leading-normal">
                      <span className="text-sm shrink-0" role="img" aria-label="avatar">{logItem.avatar}</span>
                      <div className="flex-grow">
                        <p className="text-slate-800">
                          <strong className="font-semibold text-slate-900">{logItem.user}</strong>: {logItem.action}
                        </p>
                        <span className="text-[10px] text-slate-400">{logItem.time}</span>
                      </div>
                      {logItem.color && (
                        <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: logItem.color }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* --- COLLABORATOR SHARING DIALOG / MODAL --- */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Modal Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsShareModalOpen(false)} />

          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-3xl bg-white px-6 pb-6 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-8">
              
              {/* Close Button */}
              <button 
                onClick={() => setIsShareModalOpen(false)} 
                className="absolute right-5 top-5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="sm:flex sm:items-start mb-6">
                <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 sm:mx-0 sm:h-10 sm:w-10">
                  <Share2 className="h-6 w-6 text-brand-600" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <h3 className="text-lg font-bold leading-6 text-slate-900">
                    Workshop Invite Manager
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Generate secure sharing credentials and invite other crafters into your workshop.
                  </p>
                </div>
              </div>

              {/* Copy Shareable Link Suite */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Shareable Workshop Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/designer?session=${sessionId || 'quick-workshop'}`}
                      className="block w-full rounded-xl border-slate-200 text-xs font-mono text-slate-500 bg-slate-50 py-2.5 focus:border-brand-500 focus:ring-brand-500"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 text-xs font-bold shrink-0 flex items-center gap-1.5"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Clipboard className="h-4 w-4 text-slate-500" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Separator line */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-slate-400 font-bold tracking-wider">Or Invite via Email</span>
                  </div>
                </div>

                {/* Email Invitation Form */}
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label htmlFor="email" className="sr-only">Email address</label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="e.g. craftmate@gmail.com"
                        className="block w-full rounded-xl border-slate-200 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                        className="block w-full rounded-xl border-slate-200 text-sm text-slate-700 bg-white shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 text-sm shadow-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Send Invitation Email
                  </button>
                </form>

                {/* Form Notification Messages */}
                {inviteSuccessMsg && (
                  <div className="mt-4 p-3.5 bg-brand-50 border border-brand-100 text-brand-800 rounded-xl text-xs font-semibold leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0" />
                    {inviteSuccessMsg}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
