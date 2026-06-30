import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Sparkles, Download, Layers, Palette, Play, CheckCircle2, RotateCcw, 
  Share2, Users, Clipboard, Check, Send, Activity, X, Flame, ArrowLeft,
  UploadCloud, Image, Sliders, Eye, Trash2
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

  // Active Viewers List
  const [collaborators, setViewers] = useState<Collaborator[]>([
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

  // Handle cell click on the manual paint grid
  const handleCellClick = (x: number, y: number) => {
    const key = `${x},${y}`;
    const newGrid = { ...grid };
    const newStitchTypes = { ...gridStitchTypes };
    if (newGrid[key] === selectedColor) {
      delete newGrid[key]; // Toggle off if clicked with same color
      delete newStitchTypes[key];
      addCollabLog('You (César)', '👑', `Cleared stitch at (${x}, ${y})`);
    } else {
      newGrid[key] = selectedColor;
      newStitchTypes[key] = selectedStitch;
      const colorName = colors.find(c => c.hex === selectedColor)?.name || selectedColor;
      const stitchName = stitchStyles.find(s => s.id === selectedStitch)?.name || selectedStitch;
      addCollabLog('You (César)', '👑', `Painted ${colorName} (${stitchName}) at (${x}, ${y})`);
    }
    setGrid(newGrid);
    setGridStitchTypes(newStitchTypes);
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
    setGridStitchTypes({});
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

    // Trigger API call
    const apiPromise = api.generateStitches(promptInput, 'DST', { fillType: digitizeStitchType });

    // Simulate stepping through progress
    const interval = setInterval(() => {
      setGeneratorProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          
          apiPromise.then((res) => {
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
            addCollabLog('AI Digitizer', '🤖', `Successfully compiled AI stitch-pattern from prompt! (Count: ${res.stitchCount} stitches, Thread: ${res.estimatedThreadSkeins} skeins)`);
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
      addCollabLog('You (César)', '👑', `Dropped sketch file: ${file.name}`);
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
      addCollabLog('You (César)', '👑', `Uploaded sketch file: ${file.name}`);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setShowDemoPattern(false);
    addCollabLog('You (César)', '👑', 'Removed active sketch file');
  };

  const triggerImageDigitization = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile) return;

    setIsGenerating(true);
    setGeneratorProgress(5);
    setDigitizeStepText('Analyzing color channels...');
    setShowDemoPattern(false);
    addCollabLog('You (César)', '👑', `Started AI digitizer for image: "${uploadedFile.name}" (${digitizeStitchCount} stitches, ${digitizeColorsCount} colors)`);

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
          
          apiPromise.then((res) => {
            setIsGenerating(false);
            setShowDemoPattern(true);
            setPreviewMode('pattern');
            
            const mockStitchTypes: Record<string, string> = {};
            Object.keys(mockSunflowerGrid).forEach((key) => {
              mockStitchTypes[key] = digitizeStitchType;
            });
            setGrid(mockSunflowerGrid);
            setGridStitchTypes(mockStitchTypes);
            addCollabLog('AI Digitizer', '🤖', `Successfully digitized image "${uploadedFile.name}" into embroidery pattern! (Count: ${res.stitchCount} stitches, DMC thread usage: ${res.estimatedThreadSkeins} skeins)`);
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

  // Initialize collab mode if user loads from direct link
  useEffect(() => {
    if (sessionParam) {
      setIsCollabMode(true);
      setSessionId(sessionParam);
      addCollabLog('System', '⚙️', `Successfully connected to collaborative workshop session #${sessionParam}`);
    }
  }, [sessionParam]);

  // lastUpdated ref for polling
  const lastUpdated = useRef<string>();
  
  // Real project polling using `getProject(id, since)`
  useEffect(() => {
    if (!isCollabMode || !sessionId || !api.isLiveBackend) return;
    
    const poll = async () => {
      try {
        const project = await api.getProject(sessionId, lastUpdated.current);
        if (project) {
          lastUpdated.current = project.updatedAt;
          
          if (project.data) {
            try {
              const parsedData = JSON.parse(project.data);
              if (parsedData && typeof parsedData === 'object') {
                if (parsedData.grid) {
                  setGrid(parsedData.grid);
                  setGridStitchTypes(parsedData.stitchTypes || {});
                } else {
                  // Fallback for older projects
                  setGrid(parsedData);
                  setGridStitchTypes({});
                }
              }
            } catch (e) {
              console.error('Failed to parse grid data from polled project', e);
            }
          }
        }
      } catch (err) {
        console.error('Error during project polling:', err);
      }
    };

    poll(); // Immediate first fetch
    
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [isCollabMode, sessionId]);

  // Autosave grid state to backend in live mode
  useEffect(() => {
    if (!isCollabMode || !sessionId || !api.isLiveBackend) return;
    
    const delayDebounceFn = setTimeout(async () => {
      try {
        const dataToSave = { grid, stitchTypes: gridStitchTypes };
        await api.updateProject(sessionId, { data: JSON.stringify(dataToSave) });
      } catch (err) {
        console.error('Failed to autosave grid state:', err);
      }
    }, 800); // 800ms debounce
    
    return () => clearTimeout(delayDebounceFn);
  }, [grid, gridStitchTypes, isCollabMode, sessionId]);

  // --- REAL-TIME COLLABORATIVE SYNC SIMULATOR ---
  useEffect(() => {
    if (!isCollabMode || !collabSyncActive || api.isLiveBackend) return;

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
      
      let randomStitchStyle = 'cross';
      if (willAddStitch) {
        const rStyle = Math.random();
        randomStitchStyle = rStyle < 0.6 ? 'cross' : rStyle < 0.85 ? 'satin' : 'back';
      }

      setGridStitchTypes(prevTypes => {
        const updatedTypes = { ...prevTypes };
        if (willAddStitch) {
          updatedTypes[coordKey] = randomStitchStyle;
        } else {
          delete updatedTypes[coordKey];
        }
        return updatedTypes;
      });

      setGrid(prev => {
        const updated = { ...prev };
        if (willAddStitch) {
          // Choose a random color from colors palette
          const randomColorObj = colors[Math.floor(Math.random() * colors.length)];
          updated[coordKey] = randomColorObj.hex;
          
          // Trigger notification & logging
          const actionMsg = `Painted ${randomColorObj.name} (${randomStitchStyle === 'cross' ? 'Cross' : randomStitchStyle === 'back' ? 'Back' : 'Satin'} Stitch) at (${r}, ${c})`;
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
      setViewers(prev => prev.map(collab => {
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
        
        setViewers(prev => [...prev, newInvitee]);
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
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-800 px-5 py-4 rounded-2xl shadow-lg border border-blush-100 flex items-center gap-3 animate-bounce max-w-sm">
          <Activity className="h-5 w-5 text-blush-500 animate-pulse shrink-0" />
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
          <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-50 px-4 py-1 text-sm font-semibold leading-6 text-blush-600 ring-1 ring-inset ring-blush-100 mb-4">
            <Users className="h-4 w-4 text-blush-500" />
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
        <div className="bg-gradient-to-r from-blush-500 to-rose-500 rounded-3xl p-6 md:p-8 text-white shadow-md mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
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
                  className="px-5 py-2.5 rounded-xl bg-white text-blush-700 hover:bg-slate-50 font-bold text-sm shadow-sm transition-all flex items-center gap-2"
                >
                  <Share2 className="h-4 w-4 text-blush-600" />
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
            
            {/* Tabbed Design Panel */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              
              {/* Segments Tab Bar */}
              <div className="flex border-b border-slate-100 mb-6">
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
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
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
                      className="w-full rounded-xl border-slate-200 text-sm text-slate-900 shadow-sm focus:border-blush-500 focus:ring-blush-500 disabled:opacity-50"
                    />
                    
                    {isGenerating ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-blush-700 font-semibold">
                          <span>Digitizing stitches...</span>
                          <span>{Math.min(generatorProgress, 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
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
                        className="w-full rounded-xl bg-blush-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blush-400 disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all"
                      >
                        <Play className="h-4 w-4" />
                        Build Custom Pattern
                      </button>
                    )}
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
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
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isDraggingOver ? 'border-blush-500 bg-blush-50/50' : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'}`}
                    >
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="file-upload" className="cursor-pointer block space-y-2">
                        <UploadCloud className="h-8 w-8 mx-auto text-slate-400" />
                        <span className="block text-xs font-bold text-slate-700">Drag & drop sketch file here</span>
                        <span className="block text-[10px] text-slate-400">or click to browse local files (PNG, JPG, SVG)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
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
                        className="w-full accent-brand-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
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
                        className="w-full rounded-xl border-slate-200 text-xs text-slate-800 focus:border-blush-500 focus:ring-blush-500"
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
                            className={`py-1.5 rounded-lg text-[10px] font-bold text-center border capitalize transition-all ${digitizeStitchType === type ? 'bg-blush-50 border-blush-500 text-blush-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
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
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
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
                        className="w-full rounded-xl bg-blush-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blush-400 disabled:bg-slate-100 disabled:text-slate-400 flex items-center justify-center gap-2 transition-all mt-2"
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
                    <strong>Success!</strong> AI finished digitizing! Click the **Pattern View** / **Original Image** toggles on the canvas to inspect results.
                  </p>
                </div>
              )}
            </div>

            {/* Pattern Settings Box */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
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
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-left transition-all ${selectedStitch === style.id ? 'border-blush-600 bg-blush-50 text-blush-800 ring-1 ring-blush-500' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
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
              
              <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-100 pb-4 animate-fade-in">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blush-500" />
                    Embroidery Fabric Canvas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Click cells on the grid below to manual stitch or preview generated pattern stitches.
                  </p>
                </div>
                
                {/* Original vs. Pattern Preview Toggle */}
                {(showDemoPattern || uploadedFile) && (
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    <button
                      onClick={() => setPreviewMode('pattern')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${previewMode === 'pattern' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Layers className="h-3.5 w-3.5 text-blush-500" />
                      Pattern View
                    </button>
                    <button
                      onClick={() => setPreviewMode('original')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${previewMode === 'original' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      <Eye className="h-3.5 w-3.5 text-blush-500" />
                      Original Image
                    </button>
                  </div>
                )}
                
                <div className="flex gap-2 shrink-0">
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
                    className="p-2 rounded-lg bg-blush-500 hover:bg-blush-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    title="Export Pattern to PES format"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export (.PES)
                  </button>
                </div>
              </div>

              {/* Grid Fabric Canvas Wrapper */}
              <div className="p-8 bg-amber-50/20 rounded-2xl border-4 border-dashed border-slate-200 relative shadow-inner max-w-full overflow-auto flex items-center justify-center min-h-[360px]">
                
                {previewMode === 'original' ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-white/90 rounded-2xl shadow-sm border border-slate-100 max-w-sm mx-auto text-center animate-fade-in relative z-10">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-blush-600 mb-4 block">Original Sketch Source</span>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
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
                                borderColor: color ? 'rgba(0,0,0,0.1)' : '#f3f4f6',
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
                                <span className="block h-1 w-1 rounded-full bg-slate-300/40" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Sync Controller */}
              {isCollabMode && (
                <div className="w-full mt-4 flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blush-600 animate-pulse" />
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
                      className="rounded text-blush-600 focus:ring-blush-500 h-4.5 w-4.5"
                    />
                  </label>
                </div>
              )}

            </div>
          </div>

          {/* Right Panel: Workshop Sidebar */}
          {isCollabMode && (
            <div className="lg:col-span-12 xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
              
              {/* Viewers List Panel */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blush-500" />
                    Active Workshop Viewers
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blush-50 text-blush-700">
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
                    <Activity className="h-5 w-5 text-blush-500" />
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
          <div className="fixed inset-0 bg-blush-950/40 backdrop-blur-sm transition-opacity" onClick={() => setIsShareModalOpen(false)} />

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
                <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blush-50 sm:mx-0 sm:h-10 sm:w-10">
                  <Share2 className="h-6 w-6 text-blush-600" />
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
                      className="block w-full rounded-xl border-slate-200 text-xs font-mono text-slate-500 bg-slate-50 py-2.5 focus:border-blush-500 focus:ring-blush-500"
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
                        className="block w-full rounded-xl border-slate-200 text-sm text-slate-900 shadow-sm focus:border-blush-500 focus:ring-blush-500"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                        className="block w-full rounded-xl border-slate-200 text-sm text-slate-700 bg-white shadow-sm focus:border-blush-500 focus:ring-blush-500"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blush-500 hover:bg-blush-400 text-white font-bold py-2.5 text-sm shadow-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Send Invitation Email
                  </button>
                </form>

                {/* Form Notification Messages */}
                {inviteSuccessMsg && (
                  <div className="mt-4 p-3.5 bg-blush-50 border border-blush-100 text-blush-800 rounded-xl text-xs font-semibold leading-relaxed flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blush-600 shrink-0" />
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
