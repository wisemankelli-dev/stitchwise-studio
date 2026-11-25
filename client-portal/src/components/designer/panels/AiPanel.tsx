import React from 'react';
import { AlertTriangle, Loader2, Paintbrush, Sparkles } from 'lucide-react';
import ConfirmPanel from '../ConfirmPanel';

export interface BasicOptionChip {
  id: string;
  label: string;
  prompt: string;
}

export interface MaskSteeringNote {
  below: boolean;
  title: string;
  message: string;
  createOwnLabel: string;
  resizeLabel: string;
  /** The size "make it big enough" restarts the canvas at — named in the confirm. */
  target: { width: number; height: number };
}

export interface AiPanelProps {
  createOwnMode: boolean;
  onUseAiAgain: () => void;

  basicOptions: BasicOptionChip[];
  basicHeading: string;
  basicCostNote: string;
  onApplyBasicOption: (option: BasicOptionChip) => void;

  prompt: string;
  onPromptChange: (value: string) => void;
  /** Asks first when the canvas already holds stitches. */
  onGenerate: () => void;
  /** Generate overwrites drawn work, so the Designer's confirm opens here. */
  pendingGenerate: boolean;
  onConfirmGenerate: () => void;
  onCancelGenerate: () => void;
  /** "Use 54×54" restarts the canvas — same confirm, same panel. */
  pendingMaskFloor: boolean;
  onConfirmMaskFloor: () => void;
  onCancelMaskFloor: () => void;
  isGenerating: boolean;
  /** `Generating…` / the poll status — the button's own label while busy. */
  generatingLabel: string;
  canGenerate: boolean;
  disabledReason?: string;

  /** The allowance line. It sits DIRECTLY above Generate, never below it. */
  costText: string;
  costExhausted: boolean;

  maskSteering: MaskSteeringNote;
  onStartCreateOwn: () => void;
  onUseMaskFloorSize: () => void;

  isStudioTier: boolean;
  premiumModel: boolean;
  onTogglePremium: () => void;

  aiStats: { stitches: number; colors: number; backstitch: number; crossStitch: number } | null;
  aiArtworkUrl: string | null;
}

/**
 * The **AI** tab of the phone sheet: the same prompt bar the desktop right
 * column shows, at phone sizes — 48 px prompt, the allowance line directly
 * above a full-width Generate, the free basic-option chips at ≥ 44 px, the
 * mask steering buttons, the premium switch and the artwork preview.
 *
 * Generate is the ONLY thing in the whole phone shell that spends an
 * allowance unit: the bottom bar's ✨ button just opens this tab.
 */
export const AiPanel: React.FC<AiPanelProps> = ({
  createOwnMode,
  onUseAiAgain,
  basicOptions,
  basicHeading,
  basicCostNote,
  onApplyBasicOption,
  prompt,
  onPromptChange,
  onGenerate,
  pendingGenerate,
  onConfirmGenerate,
  onCancelGenerate,
  pendingMaskFloor,
  onConfirmMaskFloor,
  onCancelMaskFloor,
  isGenerating,
  generatingLabel,
  canGenerate,
  disabledReason,
  costText,
  costExhausted,
  maskSteering,
  onStartCreateOwn,
  onUseMaskFloorSize,
  isStudioTier,
  premiumModel,
  onTogglePremium,
  aiStats,
  aiArtworkUrl,
}) => (
  <div className="space-y-3" data-testid="phone-ai-panel">
    {createOwnMode ? (
      <div data-testid="create-own-banner" className="p-3 bg-gradient-to-r from-purple-50 to-blush-50 rounded-xl border border-purple-200 space-y-2">
        <div className="flex items-start gap-2">
          <Paintbrush className="h-4 w-4 text-blush-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-slate-700">Create-Your-Own</p>
            <p className="text-[11px] text-slate-600">
              No prompt and no mask — this canvas is yours. Pick a colour and a tool and draw it
              stitch by stitch, at the size you want.
            </p>
          </div>
        </div>
        <button type="button" onClick={onUseAiAgain} className="w-full h-11 rounded-lg bg-white border border-purple-200 text-xs font-bold text-slate-600">
          Generate again
        </button>
      </div>
    ) : (
      <>
        {/* Free deterministic shortcuts — never spend a generation. */}
        {basicOptions.length > 0 && (
          <div data-testid="basic-options-gallery">
            <p className="text-[11px] font-bold text-slate-600 mb-1.5">{basicHeading}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {basicOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`basic-option-${option.id}`}
                  onClick={() => onApplyBasicOption(option)}
                  disabled={isGenerating}
                  title={option.prompt}
                  className="min-h-[44px] rounded-lg bg-white border border-purple-200 text-[11px] font-bold text-slate-700 px-2 hover:bg-purple-50 disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{basicCostNote}</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Describe your pattern</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canGenerate) onGenerate(); }}
            placeholder="e.g. a teddy bear with a brown sweater"
            aria-label="Design prompt"
            disabled={isGenerating}
            className="w-full h-12 rounded-lg border border-purple-200 text-base text-slate-700 px-3 bg-white focus:border-blush-500 focus:ring-blush-500"
          />
        </div>

        {/* The allowance line, directly above Generate. */}
        <p
          data-testid="ai-generation-cost"
          className={`text-[11px] flex items-center gap-1 ${costExhausted ? 'text-amber-600 font-semibold' : 'text-slate-500'}`}
        >
          <Sparkles className="h-3 w-3 shrink-0" /> {costText}
        </p>

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          title={disabledReason}
          data-testid="phone-generate"
          className="w-full h-12 rounded-xl bg-gradient-to-r from-blush-600 to-blush-500 text-white text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? generatingLabel : 'Generate'}
        </button>

        {pendingGenerate && (
          <ConfirmPanel
            testId="confirm-generate"
            phone
            title="Replace what's on the canvas?"
            message="Generating a new pattern clears the stitches you have drawn. It still uses one allowance unit."
            confirmLabel="Generate anyway"
            onConfirm={onConfirmGenerate}
            onCancel={onCancelGenerate}
          />
        )}

        {maskSteering.below && (
          <div data-testid="mask-min-grid-steering" className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">{maskSteering.title}</p>
                <p className="text-[11px] text-amber-700">{maskSteering.message}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onStartCreateOwn} className="flex-1 h-11 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-bold">
                {maskSteering.createOwnLabel}
              </button>
              <button type="button" onClick={onUseMaskFloorSize} className="flex-1 h-11 rounded-lg bg-amber-500 text-white text-xs font-bold">
                {maskSteering.resizeLabel}
              </button>
            </div>
          </div>
        )}

        {pendingMaskFloor && (
          <ConfirmPanel
            testId="confirm-mask-floor"
            phone
            title="Make room for the mask?"
            message={`This restarts the canvas at ${maskSteering.target.width}×${maskSteering.target.height}, so the stitches you have drawn will be cleared.`}
            confirmLabel={maskSteering.resizeLabel}
            onConfirm={onConfirmMaskFloor}
            onCancel={onCancelMaskFloor}
          />
        )}

        {isStudioTier && (
          <div className="flex items-center gap-2 min-h-[44px]">
            <button
              type="button"
              role="switch"
              aria-checked={premiumModel}
              aria-label="Premium art model"
              onClick={onTogglePremium}
              disabled={isGenerating}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent transition-colors disabled:opacity-50 ${premiumModel ? 'bg-purple-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${premiumModel ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-[11px] text-slate-500">
              Premium art model
              <span className="text-slate-400"> — higher-quality pro model (~2x image cost)</span>
            </span>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          💡 Tip: descriptive prompts give the best patterns — name the subject and add a few details (colors, texture, pose).
        </p>

        {aiStats && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">{aiStats.stitches} stitches</span>
            <span className="text-slate-400">•</span>
            <span>{aiStats.colors} DMC colors</span>
            <span className="text-slate-400">•</span>
            <span>{aiStats.crossStitch} cross</span>
            <span className="text-slate-400">•</span>
            <span>{aiStats.backstitch} backstitch</span>
          </div>
        )}

        {aiArtworkUrl && (
          <div className="rounded-xl border border-purple-200 bg-white p-3">
            <p className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-blush-500" /> 1 · Your artwork
              <span className="font-normal text-slate-400">— the stitch grid on your canvas (step 2) is converted from it</span>
            </p>
            <img src={aiArtworkUrl} alt="Generated artwork" className="w-full rounded-lg border border-slate-100" />
          </div>
        )}
      </>
    )}
  </div>
);

export interface AiStatusFooterProps {
  error: string;
  status: string;
}

/**
 * Pinned to the bottom of the sheet, outside the scrolling body, so a failed
 * or in-flight generation cannot scroll away from the button that started it.
 */
export const AiStatusFooter: React.FC<AiStatusFooterProps> = ({ error, status }) => {
  if (!error && !status) return null;
  return error ? (
    <p
      role="alert"
      data-testid="phone-ai-error"
      className="flex items-start gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border-t border-red-100"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
    </p>
  ) : (
    <p
      data-testid="phone-ai-status"
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blush-600 bg-blush-50 border-t border-blush-100"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
    </p>
  );
};

export default AiPanel;
