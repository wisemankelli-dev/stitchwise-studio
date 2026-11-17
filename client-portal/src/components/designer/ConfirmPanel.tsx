import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * The one "are you sure?" panel the Designer asks with.
 *
 * Owner priority 11-17: nothing that overwrites work already on the canvas may
 * happen silently. Every confirm — presets, resize, Generate, image upload,
 * Clear grid, "Use 54×54" — uses this same amber panel, the same warning icon
 * and the same amber-confirm / white-Cancel pair, so they read and behave the
 * same wherever they appear. The confirm button always names the action it
 * performs; Cancel never does anything but close the panel.
 */
export interface ConfirmPanelProps {
  /** The question, in the user's words ("Clear the whole grid?"). */
  title: string;
  /** What exactly will be lost. */
  message: string;
  /** Names the action, never a bare "Yes" ("Clear grid", "Use 54×54"). */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** Phone sheet: 44 px touch targets and the larger type scale. */
  phone?: boolean;
  testId?: string;
}

export const ConfirmPanel: React.FC<ConfirmPanelProps> = ({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = 'Cancel',
  phone = false,
  testId,
}) => (
  <div
    data-testid={testId}
    role="alertdialog"
    aria-label={title}
    className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2"
  >
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className={`font-bold text-amber-800 ${phone ? 'text-xs' : 'text-[11px]'}`}>{title}</p>
        <p className={`text-amber-700 ${phone ? 'text-[11px]' : 'text-[10px]'}`}>{message}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onConfirm}
        className={`flex-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold transition-all ${
          phone ? 'h-11 text-xs' : 'py-1.5 text-[10px]'
        }`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className={`flex-1 rounded-lg bg-white border border-amber-200 text-amber-700 font-bold hover:bg-amber-50 transition-all ${
          phone ? 'h-11 text-xs' : 'py-1.5 text-[10px]'
        }`}
      >
        {cancelLabel}
      </button>
    </div>
  </div>
);

export default ConfirmPanel;
