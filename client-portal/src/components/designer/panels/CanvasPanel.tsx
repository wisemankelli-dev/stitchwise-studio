import React, { useEffect, useState } from 'react';
import { AlertTriangle, Grid3X3, Maximize, Ruler, Square } from 'lucide-react';
import type { StitchGridData } from '../../StitchGrid';
import { DmcLegend } from '../../StitchGrid';

export interface CanvasPresetRow {
  /** Preset name — unique, and the id handed back to `onSelectPreset`. */
  name: string;
  stitchW: number;
  stitchH: number;
  /** e.g. `54×54 st · 3.9″×3.9″ on 14ct` */
  meta: string;
  active: boolean;
}

export interface PendingPresetRow {
  name: string;
  stitchW: number;
  stitchH: number;
}

export interface ThreadEstimateRow {
  hex: string;
  colorName: string;
  stitchCount: number;
  meters: number;
}

export interface CanvasPanelProps {
  presets: CanvasPresetRow[];
  onSelectPreset: (name: string) => void;
  pendingPreset: PendingPresetRow | null;
  onConfirmPreset: () => void;
  onCancelPreset: () => void;

  gridWidth: number;
  gridHeight: number;
  /** Applies a new custom size; the caller asks before clipping stitches. */
  onResize: (w: number, h: number) => void;
  resizeWarning: { w: number; h: number } | null;
  onConfirmResize: () => void;
  onCancelResize: () => void;
  /** `Physical size on 14ct: 3.9″ × 3.9″` (plus a non-square note). */
  physicalNote: string;

  fabricCount: number;
  fabricCounts: number[];
  onFabricChange: (count: number) => void;
  designSize: { widthInches: number; widthCm: number; heightInches: number; heightCm: number };
  fabricNeeded: { widthInches: number; heightInches: number };

  threadEstimates: ThreadEstimateRow[];
  totalThreadMeters: number;
  totalSkeins: number;

  dmcPalette: StitchGridData['dmcPalette'];
  totalStitches: number;

  showGridLines: boolean;
  onToggleGridLines: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const ROW = 'w-full min-h-[44px] flex items-center gap-2 px-3 rounded-lg border text-sm font-bold';

/**
 * The **Canvas** tab of the phone sheet: everything the desktop left column
 * puts under "Canvas Size" and "Material Estimator" — presets, custom size,
 * fabric count, the read-outs, the grid-lines and full-screen switches — at
 * ≥ 44 px, in a sheet that only scrolls internally.
 */
export const CanvasPanel: React.FC<CanvasPanelProps> = ({
  presets,
  onSelectPreset,
  pendingPreset,
  onConfirmPreset,
  onCancelPreset,
  gridWidth,
  gridHeight,
  onResize,
  resizeWarning,
  onConfirmResize,
  onCancelResize,
  physicalNote,
  fabricCount,
  fabricCounts,
  onFabricChange,
  designSize,
  fabricNeeded,
  threadEstimates,
  totalThreadMeters,
  totalSkeins,
  dmcPalette,
  totalStitches,
  showGridLines,
  onToggleGridLines,
  isFullscreen,
  onToggleFullscreen,
}) => {
  // Typing in a number field must not resize the canvas on every keystroke:
  // hold a draft and apply it on the button (desktop resizes as you type,
  // which is fine with a keyboard and awful with a phone keypad).
  const [draftW, setDraftW] = useState(String(gridWidth));
  const [draftH, setDraftH] = useState(String(gridHeight));
  useEffect(() => { setDraftW(String(gridWidth)); }, [gridWidth]);
  useEffect(() => { setDraftH(String(gridHeight)); }, [gridHeight]);

  const clamp = (raw: string) => Math.max(6, Math.min(200, Number(raw) || 6));
  const applySize = () => onResize(clamp(draftW), clamp(draftH));

  return (
    <div className="space-y-4" data-testid="phone-canvas-panel">
      {/* Resize confirm — same decision as desktop, never a silent clip. */}
      {resizeWarning && (
        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">Stitches will be lost</p>
              <p className="text-[11px] text-amber-700">
                Resizing to {resizeWarning.w}×{resizeWarning.h} will remove stitches outside the new bounds.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onConfirmResize} className="flex-1 h-11 rounded-lg bg-amber-500 text-white text-xs font-bold">
              Resize &amp; Clip
            </button>
            <button type="button" onClick={onCancelResize} className="flex-1 h-11 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product presets — 56 px rows, name and physical size on two lines. */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Preset Sizes</label>
        <div className="grid grid-cols-2 gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onSelectPreset(preset.name)}
              aria-pressed={preset.active}
              className={`min-h-[56px] px-2.5 py-2 rounded-lg text-left border transition-all ${
                preset.active
                  ? 'bg-blush-500 text-white border-blush-500 shadow-sm'
                  : 'bg-white text-slate-700 border-blush-100 hover:bg-blush-50'
              }`}
            >
              <div className="text-xs font-bold leading-tight">{preset.name}</div>
              <div className={`text-[11px] leading-tight mt-0.5 ${preset.active ? 'text-white/80' : 'text-slate-400'}`}>
                {preset.meta}
              </div>
            </button>
          ))}
        </div>

        {pendingPreset && (
          <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Start a fresh {pendingPreset.name} canvas?</p>
                <p className="text-[11px] text-amber-700">
                  Your current stitches will be cleared — a product preset always starts blank
                  ({pendingPreset.stitchW}×{pendingPreset.stitchH} st).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onConfirmPreset} className="flex-1 h-11 rounded-lg bg-amber-500 text-white text-xs font-bold">
                Start fresh
              </button>
              <button type="button" onClick={onCancelPreset} className="flex-1 h-11 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-bold">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom size — 16 px inputs so iOS does not zoom the page on focus. */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Custom Size</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">W:</span>
          <input
            type="number"
            inputMode="numeric"
            value={draftW}
            onChange={(e) => setDraftW(e.target.value)}
            aria-label="Grid width in stitches"
            min={6}
            max={200}
            className="w-20 h-11 rounded-lg border border-blush-100 text-base font-bold text-slate-700 px-2 text-center"
          />
          <span className="text-slate-300 font-bold">×</span>
          <span className="text-xs text-slate-500">H:</span>
          <input
            type="number"
            inputMode="numeric"
            value={draftH}
            onChange={(e) => setDraftH(e.target.value)}
            aria-label="Grid height in stitches"
            min={6}
            max={200}
            className="w-20 h-11 rounded-lg border border-blush-100 text-base font-bold text-slate-700 px-2 text-center"
          />
          <button
            type="button"
            onClick={applySize}
            data-testid="phone-apply-size"
            className="flex-1 h-11 rounded-lg bg-blush-500 text-white text-sm font-bold"
          >
            Apply
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">{physicalNote}</p>
      </div>

      {/* Fabric count — re-derives a preset canvas, exactly like desktop. */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Fabric Count (stitches/inch)</label>
        <select
          value={fabricCount}
          onChange={(e) => onFabricChange(Number(e.target.value))}
          aria-label="Fabric count"
          className="w-full h-11 rounded-lg border border-blush-100 text-base font-semibold text-slate-700 px-2 bg-white"
        >
          {fabricCounts.map((count) => (
            <option key={count} value={count}>
              {count} count — {count === 11 ? 'Coarse' : count === 13 ? 'Mesh' : count === 14 ? 'Standard' : count === 18 ? 'Fine' : count >= 28 ? 'Extra Fine' : 'Medium'}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-blush-50/50 rounded-xl p-3 border border-blush-100 space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Square className="h-3.5 w-3.5 text-blush-500" /> Design Size
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white rounded-lg p-2 border border-blush-100">
            <span className="text-slate-400">Width</span>
            <p className="font-bold text-slate-800">{designSize.widthInches}″ / {designSize.widthCm} cm</p>
          </div>
          <div className="bg-white rounded-lg p-2 border border-blush-100">
            <span className="text-slate-400">Height</span>
            <p className="font-bold text-slate-800">{designSize.heightInches}″ / {designSize.heightCm} cm</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 italic">
          Fabric needed (with 2″ margins): {fabricNeeded.widthInches}″ × {fabricNeeded.heightInches}″
        </p>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Ruler className="h-3.5 w-3.5 text-blush-500" /> Thread Estimate
        </p>
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {threadEstimates.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">Add stitches to see thread estimates</p>
          ) : (
            threadEstimates.map((c) => (
              <div key={c.hex} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-blush-100">
                <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: c.hex }} />
                <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{c.colorName}</span>
                <span className="text-[11px] text-slate-500">{c.stitchCount} st</span>
                <span className="text-[11px] font-bold text-blush-700">{c.meters}m</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-blush-100 flex justify-between text-[11px] text-slate-600">
          <span>Total thread</span>
          <span className="font-bold text-blush-700">{totalThreadMeters.toFixed(2)}m</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-600">
          <span>DMC skeins needed (8.7m/skein)</span>
          <span className="font-bold text-blush-700">~{totalSkeins} skein{totalSkeins > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Grid lines + full screen — StitchGrid's own toolbar is hidden on the
          phone, so these two live here instead of being lost. */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={onToggleGridLines}
          aria-pressed={showGridLines}
          data-testid="phone-toggle-grid-lines"
          className={`${ROW} ${showGridLines ? 'bg-blush-50 border-blush-300 text-blush-700' : 'bg-white border-blush-100 text-slate-500'}`}
        >
          <Grid3X3 className="h-4 w-4" /> Grid lines {showGridLines ? 'on' : 'off'}
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
          data-testid="phone-toggle-fullscreen"
          className={`${ROW} ${isFullscreen ? 'bg-blush-500 border-blush-500 text-white' : 'bg-white border-blush-100 text-slate-600'}`}
        >
          <Maximize className="h-4 w-4" /> {isFullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
      </div>

      {dmcPalette.length > 0 && (
        <div className="bg-white rounded-xl p-3 border border-blush-100">
          <DmcLegend palette={dmcPalette} />
          <div className="mt-3 pt-3 border-t border-blush-100 text-[11px] text-slate-500 space-y-0.5">
            <p>Total stitches: <span className="font-bold text-blush-600">{totalStitches}</span></p>
            <p>Grid: <span className="font-bold text-slate-700">{gridWidth}×{gridHeight}</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasPanel;
