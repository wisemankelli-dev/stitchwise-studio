import React from 'react';
import { Brush, Eraser, Sparkles, Wrench } from 'lucide-react';

export interface BottomBarProps {
  selectedColor: string;
  activeTool: string;
  /** Label of the armed tool, shown on the Tools button. */
  activeToolLabel: string;
  /** Which sheet tab is open (null when the sheet is closed). */
  openTab: string | null;
  onOpenColour: () => void;
  onPaint: () => void;
  onErase: () => void;
  onOpenTools: () => void;
  /** The ✨ AI tab. It only opens the sheet — Generate lives inside it. */
  onOpenAi?: () => void;
}

const CELL = 'h-12 shrink-0 flex items-center justify-center rounded-xl border transition-colors';

/**
 * 60 px phone bottom bar (+ safe-area padding): Colour · Paint · Erase · Tools.
 * It only opens the sheet — it never spends an allowance, and Generate lives
 * inside the AI tab next to the cost line.
 */
export const BottomBar: React.FC<BottomBarProps> = ({
  selectedColor,
  activeTool,
  activeToolLabel,
  openTab,
  onOpenColour,
  onPaint,
  onErase,
  onOpenTools,
  onOpenAi,
}) => (
  <div
    className="shrink-0 bg-white border-t border-blush-100 pb-[env(safe-area-inset-bottom)]"
    data-testid="phone-bottom-bar"
  >
    <div className="h-[60px] flex items-center gap-2 px-2">
      <button
        type="button"
        onClick={onOpenColour}
        aria-label="Thread colour"
        aria-expanded={openTab === 'colour'}
        data-testid="phone-bar-colour"
        className={`${CELL} w-12 border-2 ${openTab === 'colour' ? 'border-blush-500 ring-1 ring-blush-300' : 'border-slate-200'}`}
      >
        <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: selectedColor }} />
      </button>
      <button
        type="button"
        onClick={onPaint}
        aria-label="Paint tool"
        aria-pressed={activeTool === 'paint'}
        className={`${CELL} w-12 ${activeTool === 'paint' ? 'bg-blush-500 border-blush-500 text-white' : 'bg-white border-blush-100 text-slate-600'}`}
      >
        <Brush className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onErase}
        aria-label="Erase tool"
        aria-pressed={activeTool === 'erase'}
        className={`${CELL} w-12 ${activeTool === 'erase' ? 'bg-blush-500 border-blush-500 text-white' : 'bg-white border-blush-100 text-slate-600'}`}
      >
        <Eraser className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onOpenTools}
        aria-label={`Tools — ${activeToolLabel}`}
        aria-expanded={openTab === 'tools'}
        data-testid="phone-bar-tools"
        className={`${CELL} flex-1 gap-1.5 px-2 text-xs font-bold ${
          openTab === 'tools' ? 'bg-blush-50 border-blush-300 text-blush-700' : 'bg-white border-blush-100 text-slate-600'
        }`}
      >
        <Wrench className="h-4 w-4" />
        <span className="truncate">{activeToolLabel}</span>
      </button>
      {onOpenAi && (
        <button
          type="button"
          onClick={onOpenAi}
          aria-label="AI design"
          aria-expanded={openTab === 'ai'}
          data-testid="phone-bar-ai"
          className={`h-12 flex-1 shrink-0 flex items-center justify-center gap-1.5 rounded-xl text-white text-xs font-bold ${
            openTab === 'ai'
              ? 'bg-gradient-to-r from-blush-600 to-purple-600 ring-2 ring-purple-300'
              : 'bg-gradient-to-r from-blush-500 to-purple-500'
          }`}
        >
          <Sparkles className="h-4 w-4" /> AI
        </button>
      )}
    </div>
  </div>
);

export default BottomBar;
