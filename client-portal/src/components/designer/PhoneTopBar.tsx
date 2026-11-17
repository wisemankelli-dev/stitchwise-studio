import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MoreHorizontal, Save } from 'lucide-react';

export interface PhoneTopBarProps {
  patternName: string;
  onPatternNameChange: (value: string) => void;
  onSave: () => void;
  isSaving?: boolean;
  onMore: () => void;
  moreOpen?: boolean;
}

/**
 * 52 px phone top bar: Back · pattern name · Save · More.
 * Every control is 44×44 (the name field is 44 tall), and the name input is
 * text-base (16 px) so iOS Safari does not zoom the page on focus.
 */
export const PhoneTopBar: React.FC<PhoneTopBarProps> = ({
  patternName,
  onPatternNameChange,
  onSave,
  isSaving = false,
  onMore,
  moreOpen = false,
}) => (
  <div
    className="shrink-0 h-[52px] flex items-center gap-1.5 px-2 border-b border-blush-100 bg-white/95 backdrop-blur-sm"
    data-testid="phone-top-bar"
  >
    <Link
      to="/dashboard"
      aria-label="Back to Dashboard"
      className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:bg-blush-50 transition-colors"
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
    <input
      type="text"
      value={patternName}
      onChange={(e) => onPatternNameChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave();
      }}
      placeholder="Pattern name..."
      aria-label="Pattern name"
      className="flex-1 min-w-0 h-11 rounded-lg border border-blush-100 bg-white px-2 text-base font-semibold text-slate-700 focus:border-blush-400 focus:ring-1 focus:ring-blush-400"
    />
    <button
      type="button"
      onClick={onSave}
      disabled={isSaving}
      aria-label="Save pattern"
      className="h-11 w-11 shrink-0 flex items-center justify-center rounded-lg bg-blush-500 hover:bg-blush-600 text-white disabled:opacity-50"
    >
      {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
    </button>
    <button
      type="button"
      onClick={onMore}
      aria-label="More actions"
      aria-expanded={moreOpen}
      className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-lg border transition-colors ${
        moreOpen ? 'bg-blush-50 border-blush-300 text-blush-700' : 'border-blush-100 text-slate-600 hover:bg-blush-50'
      }`}
    >
      <MoreHorizontal className="h-5 w-5" />
    </button>
  </div>
);

export default PhoneTopBar;
