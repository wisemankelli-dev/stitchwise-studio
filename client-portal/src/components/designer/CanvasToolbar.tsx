import React from 'react';
import { Maximize, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';

export interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const BTN =
  'h-11 w-11 shrink-0 flex items-center justify-center rounded-lg border border-blush-100 bg-white text-slate-600 ' +
  'hover:bg-blush-50 active:bg-blush-100 transition-colors disabled:opacity-40 disabled:pointer-events-none';

/**
 * 44 px phone canvas toolbar, always visible under the top bar:
 * zoom − · zoom % · zoom + · Fit · Undo · Redo (324 px of the 358 available).
 * It drives the SAME `zoom` state as the desktop controls; StitchGrid's own
 * zoom row is hidden in compact mode so there is only one set of controls.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => (
  <div
    className="shrink-0 h-11 flex items-center gap-1 px-2 border-b border-blush-100 bg-white"
    data-testid="phone-canvas-toolbar"
  >
    <button type="button" onClick={onZoomOut} aria-label="Zoom out" className={BTN}>
      <ZoomOut className="h-5 w-5" />
    </button>
    <span
      className="h-11 w-10 shrink-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-600"
      data-testid="phone-zoom-percent"
    >
      {Math.round(zoom * 100)}%
    </span>
    <button type="button" onClick={onZoomIn} aria-label="Zoom in" className={BTN}>
      <ZoomIn className="h-5 w-5" />
    </button>
    <button type="button" onClick={onFit} aria-label="Fit to screen" className={BTN}>
      <Maximize className="h-5 w-5" />
    </button>
    <div className="ml-auto flex items-center gap-1">
      <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" className={BTN}>
        <Undo2 className="h-5 w-5" />
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" className={BTN}>
        <Redo2 className="h-5 w-5" />
      </button>
    </div>
  </div>
);

export default CanvasToolbar;
