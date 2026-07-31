import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";

import { Nav } from "~/components/Nav";
import { Footer } from "~/components/Footer";

// ── Types ──────────────────────────────────────────────
interface StitchCell {
  color: string;
  dmcCode: string;
  dmcName: string;
}

interface DmcColor {
  code: string;
  name: string;
  hex: string;
  count: number;
}

interface GenerateResponse {
  grid: StitchCell[][];
  gridSize: number;
  dmcColors: DmcColor[];
  promptUsed: string;
}

const CANVAS_PRESETS: { label: string; size: number }[] = [
  { label: "Bag Charm", size: 50 },
  { label: "Ornament", size: 75 },
  { label: "5×7 Frame", size: 100 },
  { label: "8×10 Frame", size: 150 },
  { label: "Pillow", size: 150 },
  { label: "Stocking", size: 200 },
  { label: "Wall Hanging", size: 200 },
];

type GenerationMode = "line-art" | "photo-style";

const CELL_SCALE = 8;

const ENDPOINTS: Record<GenerationMode, string> = {
  "line-art": "/api/ai/text-to-line-art-pattern",
  "photo-style": "/api/ai/text-to-image-pattern",
};

// ── Route ──────────────────────────────────────────────
export const Route = createFileRoute("/designer")({
  component: DesignerPage,
});

// ── Page ───────────────────────────────────────────────
function DesignerPage() {
  const [prompt, setPrompt] = useState("");
  const [gridSize, setGridSize] = useState(100);
  const [mode, setMode] = useState<GenerationMode>("line-art");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [grid, setGrid] = useState<StitchCell[][]>([]);
  const [palette, setPalette] = useState<DmcColor[]>([]);
  const [promptUsed, setPromptUsed] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Generate ──────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    setError("");
    setGrid([]);
    setPalette([]);

    try {
      const endpoint = ENDPOINTS[mode];
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, gridSize, maxColors: 6 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Server error (${res.status})`);
      }
      const data: GenerateResponse = await res.json();
      setGrid(data.grid);
      setPalette(data.dmcColors || []);
      setPromptUsed(data.promptUsed || trimmed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [prompt, gridSize, mode, generating]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGenerate();
  };

  // ── Canvas rendering (main) ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || grid.length === 0) return;

    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    if (!rows || !cols) return;

    const width = cols * CELL_SCALE;
    const height = rows * CELL_SCALE;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]?.[c];
        if (cell?.color) {
          ctx.fillStyle = cell.color;
          ctx.fillRect(c * CELL_SCALE, r * CELL_SCALE, CELL_SCALE, CELL_SCALE);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SCALE);
      ctx.lineTo(width, r * CELL_SCALE);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SCALE, 0);
      ctx.lineTo(c * CELL_SCALE, height);
      ctx.stroke();
    }
  }, [grid]);

  // ── Canvas rendering (thumbnail) ──────────────────────
  useEffect(() => {
    const canvas = thumbCanvasRef.current;
    if (!canvas || grid.length === 0) return;

    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    if (!rows || !cols) return;

    const thumbSize = Math.min(120, cols, rows);
    const cellScale = thumbSize / Math.max(rows, cols);

    canvas.width = cols * cellScale;
    canvas.height = rows * cellScale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r]?.[c];
        if (cell?.color) {
          ctx.fillStyle = cell.color;
          ctx.fillRect(c * cellScale, r * cellScale, cellScale, cellScale);
        }
      }
    }
  }, [grid]);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex flex-col">
      <Nav />
      <main className="flex-1 bg-blush-50/50">
        {/* Hero banner */}
        <section className="bg-gradient-to-br from-blush-600 via-blush-500 to-blush-400 py-12 px-4 text-center text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Pattern Designer
          </h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto font-body">
            Describe your embroidery pattern and let AI bring it to life — stitch by stitch.
          </p>
        </section>

        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* ── Prompt bar ───────────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-petal p-6 space-y-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500 font-body">Mode:</span>
              <div className="flex rounded-xl bg-blush-50 p-1 border border-blush-100">
                <button
                  onClick={() => setMode("line-art")}
                  disabled={generating}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition font-body disabled:opacity-50 ${
                    mode === "line-art"
                      ? "bg-white text-blush-700 shadow-sm"
                      : "text-slate-500 hover:text-blush-600"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <PenIcon />
                    Line Art
                  </span>
                </button>
                <button
                  onClick={() => setMode("photo-style")}
                  disabled={generating}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition font-body disabled:opacity-50 ${
                    mode === "photo-style"
                      ? "bg-white text-blush-700 shadow-sm"
                      : "text-slate-500 hover:text-blush-600"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <CameraIcon />
                    Photo Style
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "line-art"
                    ? 'Describe a pattern (e.g. "a sunflower with green leaves")'
                    : 'Describe an image (e.g. "a photorealistic rose with morning dew")'
                }
                disabled={generating}
                className="flex-1 px-4 py-3 rounded-xl border border-blush-200 bg-blush-50/30 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blush-400/50 focus:border-blush-400 transition font-body disabled:opacity-50"
              />
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blush-600 to-blush-500 text-white font-semibold hover:from-blush-700 hover:to-blush-600 transition shadow-blush disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center min-w-[160px]"
              >
                {generating ? (
                  <>
                    <Spinner />
                    Generating…
                  </>
                ) : (
                  <>
                    <SparkleIcon />
                    Generate Pattern
                  </>
                )}
              </button>
            </div>

            {/* Canvas size selector */}
            <div className="flex flex-wrap gap-2">
              {CANVAS_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setGridSize(p.size)}
                  disabled={generating}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition border disabled:opacity-50 font-body ${
                    gridSize === p.size
                      ? "bg-blush-100 text-blush-700 border-blush-300"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blush-300 hover:bg-blush-50"
                  }`}
                >
                  {p.label} ({p.size}×{p.size})
                </button>
              ))}
            </div>
          </div>

          {/* ── Error ────────────────────────────────────── */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 font-body flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Generation failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
              <button
                onClick={handleGenerate}
                className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 transition shrink-0"
              >
                Try again
              </button>
            </div>
          )}

          {/* ── Loading / Results area ───────────────────── */}
          {(grid.length > 0 || generating) && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* Canvas panel */}
              <div className="bg-white rounded-2xl shadow-petal overflow-hidden">
                {/* Panel header */}
                <div className="px-6 py-4 border-b border-blush-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-800 truncate">
                      {generating ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="w-4 h-4 text-blush-500" />
                          <span className="text-blush-600">
                            Generating {mode === "line-art" ? "line art" : "photo"} pattern…
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-800">Pattern Result</span>
                      )}
                    </h2>
                    {!generating && promptUsed && (
                      <p className="text-xs text-slate-400 font-body mt-0.5 truncate">
                        &ldquo;{promptUsed}&rdquo;
                      </p>
                    )}
                  </div>
                  {!generating && grid.length > 0 && (
                    <span className="text-xs text-slate-400 font-body bg-blush-50 px-3 py-1 rounded-full shrink-0">
                      {grid.length}×{grid[0]?.length ?? 0} stitches
                    </span>
                  )}
                </div>

                {/* Canvas area */}
                <div className="p-6 flex items-center justify-center min-h-[300px] bg-blush-50/20">
                  {generating ? (
                    /* Skeleton loader */
                    <div className="w-full max-w-md space-y-4 animate-pulse">
                      <div className="aspect-square w-full bg-blush-100/50 rounded-xl" />
                      <div className="flex gap-2 justify-center">
                        <div className="h-2 w-20 bg-blush-100/50 rounded-full" />
                        <div className="h-2 w-16 bg-blush-100/50 rounded-full" />
                      </div>
                      <p className="text-center text-sm text-slate-400 font-body">
                        AI is creating your embroidery pattern…
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-xl border border-blush-100 bg-white shadow-sm">
                      <canvas
                        ref={canvasRef}
                        className="max-w-full"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </div>
                  )}
                </div>

                {/* Footer stats */}
                {!generating && grid.length > 0 && (
                  <div className="px-6 py-3 border-t border-blush-50 flex items-center gap-4 text-xs text-slate-400 font-body">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blush-400" />
                      {palette.length} DMC colors
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                      {(grid.length * grid[0]?.length ?? 0).toLocaleString()} total stitches
                    </span>
                  </div>
                )}
              </div>

              {/* DMC Palette panel */}
              <div className="bg-white rounded-2xl shadow-petal overflow-hidden">
                <div className="px-6 py-4 border-b border-blush-50">
                  <h3 className="text-lg font-semibold text-slate-800">
                    DMC Color Palette
                  </h3>
                </div>

                <div className="p-6">
                  {generating ? (
                    /* Palette skeleton */
                    <div className="space-y-3 animate-pulse">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blush-100/50" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-16 bg-blush-100/50 rounded" />
                            <div className="h-2 w-24 bg-blush-100/30 rounded" />
                          </div>
                          <div className="h-5 w-10 bg-blush-100/50 rounded-full" />
                        </div>
                      ))}
                      <p className="text-center text-xs text-slate-400 pt-4 font-body">
                        Computing palette…
                      </p>
                    </div>
                  ) : palette.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blush-50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-blush-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                          <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                          <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.38-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-400 font-body">
                        No palette data yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Thumbnail preview */}
                      {grid.length > 0 && (
                        <div className="pb-4 mb-2 border-b border-blush-50">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2 font-body">
                            Pattern Preview
                          </p>
                          <div className="bg-blush-50/30 rounded-xl p-3 flex items-center justify-center">
                            <canvas
                              ref={thumbCanvasRef}
                              className="max-w-full rounded-lg"
                              style={{ imageRendering: "pixelated", maxHeight: "100px" }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Color list */}
                      <ul className="space-y-1.5">
                        {palette.map((c) => (
                          <li
                            key={c.code}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blush-50/70 transition-colors group cursor-default"
                          >
                            <span
                              className="w-8 h-8 rounded-lg border border-slate-200 shrink-0 shadow-sm group-hover:scale-110 transition-transform"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="text-sm font-bold text-slate-700 block font-body">
                                {c.code}
                              </span>
                              <span className="text-[11px] text-slate-400 font-body truncate block">
                                {c.name}
                              </span>
                            </span>
                            <span className="text-xs text-blush-500 font-semibold bg-blush-100 px-2.5 py-1 rounded-full shrink-0">
                              {c.count}×
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-5 w-5 ${className ?? ""}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
      />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <circle cx="12" cy="13" r="3" strokeWidth="2" />
    </svg>
  );
}
