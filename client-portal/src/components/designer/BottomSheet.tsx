import React from 'react';
import { X } from 'lucide-react';

export interface SheetTab {
  id: string;
  label: string;
}

export interface BottomSheetProps {
  open: boolean;
  /** Active tab id, or null when nothing is selected. */
  tab: string | null;
  tabs: SheetTab[];
  onTabChange: (id: string) => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned below the scrolling body — AI errors/status live here. */
  footer?: React.ReactNode;
}

/**
 * The one phone sheet. Closed by default; `max-h-[62dvh]`, and only the body
 * scrolls so the tabs and close button never move. The handle, the tabs and
 * the close button are all ≥ 44 px.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({ open, tab, tabs, onTabChange, onClose, children, footer }) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Designer tools"
      data-testid="phone-bottom-sheet"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[62dvh] flex flex-col rounded-t-2xl border-t border-blush-100 bg-white shadow-[0_-8px_30px_rgba(15,23,42,0.14)]"
    >
      <div className="shrink-0 flex justify-center pt-2 pb-1">
        <span className="h-1 w-9 rounded-full bg-slate-200" />
      </div>
      <div className="shrink-0 flex items-center gap-1 px-2 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            aria-selected={tab === t.id}
            role="tab"
            className={`h-11 flex-1 rounded-lg text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-blush-50 text-blush-700 ring-1 ring-blush-300'
                : 'text-slate-500 hover:bg-blush-50/60'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-blush-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-1 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        data-testid="phone-sheet-body"
      >
        {children}
      </div>
      {footer && (
        <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" data-testid="phone-sheet-footer">
          {footer}
        </div>
      )}
    </div>
  );
};

export default BottomSheet;
