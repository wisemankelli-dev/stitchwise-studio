import React from 'react';
import { AlertTriangle, Download, Eye, Loader2, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import ConfirmPanel from '../ConfirmPanel';

export interface SavedPatternRow {
  id: string;
  name: string;
  updatedAt: string;
}

export interface FilePanelProps {
  patternName: string;
  onPatternNameChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;

  /** A refused save/load — shown with a Dismiss, never swallowed. */
  patternError: string | null;
  onDismissError: () => void;

  savedPatterns: SavedPatternRow[];
  isLoadingPatterns: boolean;
  patternsLoadError: string | null;
  loadingPatternId: string | null;
  onLoadPattern: (id: string) => void;
  onDeletePattern: (id: string, e: React.MouseEvent) => void;
  onRefreshPatterns: () => void;

  onExportPdf: () => void;

  fileInputId: string;
  /** Asks first when the canvas already holds stitches. */
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Tracing an image replaces the grid, so the Designer's confirm opens here. */
  pendingUpload: boolean;
  onConfirmUpload: () => void;
  onCancelUpload: () => void;
  isProcessingImage: boolean;
  numColors: number;
  onNumColorsChange: (value: number) => void;

  hasReferenceImage: boolean;
  showReference: boolean;
  onToggleReference: () => void;
  referenceOpacity: number;
  onReferenceOpacityChange: (value: number) => void;
}

const ROW = 'w-full min-h-[44px] flex items-center gap-2 px-3 rounded-lg border text-sm font-bold';

/**
 * The **File** tab of the phone sheet: name + Save, the saved-pattern list
 * with a 44×44 delete on each row, Export PDF, Upload Image with the colour
 * count, and the reference-image toggle + opacity — every file action the
 * desktop panel offers, none of it behind a hidden panel.
 */
export const FilePanel: React.FC<FilePanelProps> = ({
  patternName,
  onPatternNameChange,
  onSave,
  isSaving,
  patternError,
  onDismissError,
  savedPatterns,
  isLoadingPatterns,
  patternsLoadError,
  loadingPatternId,
  onLoadPattern,
  onDeletePattern,
  onRefreshPatterns,
  onExportPdf,
  fileInputId,
  onUploadImage,
  pendingUpload,
  onConfirmUpload,
  onCancelUpload,
  isProcessingImage,
  numColors,
  onNumColorsChange,
  hasReferenceImage,
  showReference,
  onToggleReference,
  referenceOpacity,
  onReferenceOpacityChange,
}) => (
  <div className="space-y-4" data-testid="phone-file-panel">
    {patternError && (
      <div role="alert" className="text-[11px] px-2 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span className="flex-1">{patternError}</span>
        <button type="button" onClick={onDismissError} className="min-h-[32px] px-1 text-[11px] font-bold text-red-500">
          Dismiss
        </button>
      </div>
    )}

    {/* Name + Save */}
    <div>
      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Pattern Name</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={patternName}
          onChange={(e) => onPatternNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); }}
          placeholder="Pattern name…"
          aria-label="Pattern name"
          className="flex-1 h-11 rounded-lg border border-blush-100 text-base text-slate-700 px-2 bg-white"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          data-testid="phone-file-save"
          className="h-11 px-4 rounded-lg bg-blush-500 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
    </div>

    {/* Saved patterns */}
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Saved Patterns</label>
        <button
          type="button"
          onClick={onRefreshPatterns}
          className="min-h-[32px] px-2 text-[11px] font-bold text-blush-600 flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
      <div className="rounded-xl border border-blush-100 bg-white divide-y divide-blush-50 overflow-hidden">
        {isLoadingPatterns ? (
          <p className="p-3 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </p>
        ) : patternsLoadError ? (
          <div className="p-3 text-center space-y-1">
            <p className="text-xs font-bold text-red-600">Couldn't load your patterns</p>
            <p className="text-[11px] text-red-500">{patternsLoadError}</p>
            <button type="button" onClick={onRefreshPatterns} className="text-[11px] font-bold text-blush-600 underline">
              Retry
            </button>
          </div>
        ) : savedPatterns.length === 0 ? (
          <p className="p-3 text-xs text-slate-400">No saved patterns yet</p>
        ) : (
          savedPatterns.map((p) => (
            <div key={p.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onLoadPattern(p.id)}
                className="flex-1 min-h-[44px] flex items-center justify-between gap-2 px-3 text-left text-sm text-slate-700"
              >
                <span className="truncate">{p.name}</span>
                {loadingPatternId === p.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blush-500 shrink-0" />
                ) : (
                  <span className="text-[11px] text-slate-400 shrink-0">{new Date(p.updatedAt).toLocaleDateString()}</span>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => onDeletePattern(p.id, e)}
                aria-label={`Delete ${p.name}`}
                className="h-11 w-11 shrink-0 flex items-center justify-center text-slate-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>

    {/* Export */}
    <button
      type="button"
      onClick={onExportPdf}
      data-testid="phone-file-export-pdf"
      className="w-full h-11 rounded-lg bg-blush-500 text-white text-sm font-bold flex items-center justify-center gap-1.5"
    >
      <Download className="h-4 w-4" /> Export PDF
    </button>

    {/* Upload image + colour count */}
    <div>
      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Trace an Image</label>
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        onChange={onUploadImage}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        <label
          htmlFor={fileInputId}
          className={`flex-1 h-11 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 ${
            isProcessingImage ? 'bg-blush-100 text-blush-400' : 'bg-blush-500 text-white'
          }`}
        >
          {isProcessingImage ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {isProcessingImage ? 'Processing…' : 'Upload Image'}
        </label>
        <select
          value={numColors}
          onChange={(e) => onNumColorsChange(Number(e.target.value))}
          aria-label="Number of colors"
          className="h-11 rounded-lg border border-blush-100 text-sm font-bold text-slate-600 px-2 bg-white"
        >
          <option value={5}>5 colors</option>
          <option value={10}>10 colors</option>
          <option value={15}>15 colors</option>
          <option value={20}>20 colors</option>
          <option value={30}>30 colors</option>
        </select>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">The image is traced to your colour count and laid under the grid as a reference.</p>
    </div>

    {pendingUpload && (
      <ConfirmPanel
        testId="confirm-upload"
        phone
        title="Replace what's on the canvas?"
        message="Tracing an image replaces the stitches you have drawn with the image's colours."
        confirmLabel="Upload and replace"
        onConfirm={onConfirmUpload}
        onCancel={onCancelUpload}
      />
    )}

    {/* Reference image */}
    {hasReferenceImage && (
      <div className="space-y-2">
        <button
          type="button"
          onClick={onToggleReference}
          aria-pressed={showReference}
          className={`${ROW} ${
            showReference ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          <Eye className="h-4 w-4" /> Reference image {showReference ? 'shown' : 'hidden'}
        </button>
        <div className="min-h-[44px] flex items-center gap-2 px-1">
          <span className="text-[11px] font-bold text-slate-500 shrink-0">Opacity</span>
          <input
            type="range"
            min="5"
            max="50"
            value={Math.round(referenceOpacity * 100)}
            onChange={(e) => onReferenceOpacityChange(Number(e.target.value) / 100)}
            aria-label="Reference opacity"
            className="flex-1 h-2 accent-pink-500"
          />
          <span className="text-[11px] font-bold text-slate-600 w-9 text-right">{Math.round(referenceOpacity * 100)}%</span>
        </div>
      </div>
    )}
  </div>
);

export default FilePanel;
