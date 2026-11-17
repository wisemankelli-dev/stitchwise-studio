import React from 'react';

export interface SwatchColor {
  name: string;
  hex: string;
}

export interface ThreadBoxPanelProps {
  colors: SwatchColor[];
  customColors: string[];
  selectedColor: string;
  onSelectColor: (hex: string) => void;
  onHexInput: (value: string) => void;
  onAddCustomColor: () => void;
}

/**
 * Active thread colour + swatch box. One markup serves both layouts:
 * desktop keeps the original `flex flex-wrap` 32 px swatches, the phone sheet
 * gets a `grid-cols-7` of 44 px swatches (7×44 + 6×6 = 344 ≤ 358) and 16 px
 * inputs so iOS does not zoom on focus.
 */
export const ThreadBoxPanel: React.FC<ThreadBoxPanelProps> = ({
  colors,
  customColors,
  selectedColor,
  onSelectColor,
  onHexInput,
  onAddCustomColor,
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Active Thread Color</label>
    <div className="flex flex-wrap gap-2 max-lg:grid max-lg:grid-cols-7 max-lg:gap-1.5">
      {colors.map((c) => (
        <button
          key={c.name}
          onClick={() => onSelectColor(c.hex)}
          title={c.name}
          aria-label={c.name}
          className="h-8 w-8 max-lg:h-11 max-lg:w-11 rounded-full border transition-all relative flex items-center justify-center"
          style={{ backgroundColor: c.hex, borderColor: selectedColor === c.hex ? '#000' : 'rgba(0,0,0,0.1)' }}
        >
          {selectedColor === c.hex && <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
        </button>
      ))}
      {customColors.map((hex) => (
        <button
          key={hex}
          onClick={() => onSelectColor(hex)}
          title={`My color ${hex}`}
          aria-label={`My color ${hex}`}
          className="h-8 w-8 max-lg:h-11 max-lg:w-11 rounded-full border border-dashed transition-all relative flex items-center justify-center"
          style={{ backgroundColor: hex, borderColor: selectedColor === hex ? '#000' : 'rgba(0,0,0,0.25)' }}
        >
          {selectedColor === hex && <span className="block h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
        </button>
      ))}
    </div>
    <div className="mt-2 flex items-center gap-2">
      <input
        type="color"
        value={selectedColor}
        onChange={(e) => onSelectColor(e.target.value)}
        className="h-8 w-8 max-lg:h-11 max-lg:w-11 rounded-full border border-slate-300 cursor-pointer bg-white p-0.5"
        title="Pick any color"
        aria-label="Custom color picker"
      />
      <input
        type="text"
        value={selectedColor}
        onChange={(e) => onHexInput(e.target.value)}
        className="w-24 max-lg:w-28 max-lg:h-11 rounded-lg border border-blush-100 bg-white px-2 py-1 text-xs max-lg:text-base font-mono text-slate-700"
        placeholder="#RRGGBB"
        aria-label="Hex color code"
        spellCheck={false}
      />
      <button
        onClick={onAddCustomColor}
        title="Add this color to my swatches"
        className="h-8 w-8 max-lg:h-11 max-lg:w-11 rounded-lg border border-blush-200 bg-blush-50 hover:bg-blush-100 text-blush-600 text-lg font-bold leading-none flex items-center justify-center transition-colors"
        aria-label="Add current color to swatches"
      >
        +
      </button>
      <span className="text-[10px] text-slate-400 leading-tight">
        Pick any color,<br />tap + to pin it
      </span>
    </div>
  </div>
);

export interface StitchStylePickerProps {
  styles: { id: string; name: string; description: string }[];
  selectedStitch: string;
  onSelectStitch: (id: string) => void;
}

/** The four stitch styles. Phone: one 52 px row each; desktop: the original 2×2 grid. */
export const StitchStylePicker: React.FC<StitchStylePickerProps> = ({ styles, selectedStitch, onSelectStitch }) => (
  <div>
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Stitch Style</label>
    <div className="grid grid-cols-2 gap-2 max-lg:grid-cols-1">
      {styles.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelectStitch(s.id)}
          className={`px-3 py-2 max-lg:min-h-[52px] text-xs font-semibold rounded-lg border text-left transition-all ${
            selectedStitch === s.id
              ? 'border-blush-600 bg-blush-50 text-blush-800 ring-1 ring-blush-500'
              : 'border-blush-100 bg-white hover:bg-blush-50 text-slate-700'
          }`}
        >
          <div className="font-bold">{s.name}</div>
          <div className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{s.description}</div>
        </button>
      ))}
    </div>
  </div>
);

export default ThreadBoxPanel;
