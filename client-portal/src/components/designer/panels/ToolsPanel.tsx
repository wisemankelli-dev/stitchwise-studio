import React from 'react';

export interface ToolDefinition {
  id: string;
  icon: React.ReactNode;
  label: string;
}

export interface ToolButtonsProps {
  tools: ToolDefinition[];
  activeTool: string;
  onSelectTool: (id: string) => void;
}

/**
 * The 13 edit tools. Desktop keeps the original compact icon+label row; on the
 * phone sheet it becomes a `grid-cols-4` of 82×64 tap targets with the label
 * always visible (`hidden sm:inline` is overridden below lg).
 */
export const ToolButtons: React.FC<ToolButtonsProps> = ({ tools, activeTool, onSelectTool }) => (
  <div
    className="flex items-center gap-1 bg-blush-50 p-1 rounded-xl border border-blush-100 max-lg:grid max-lg:grid-cols-4 max-lg:gap-2 max-lg:bg-transparent max-lg:p-0 max-lg:border-0"
    data-testid="tool-buttons"
  >
    {tools.map((tool) => (
      <button
        key={tool.id}
        onClick={() => onSelectTool(tool.id)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all max-lg:flex-col max-lg:justify-center max-lg:h-16 max-lg:gap-0.5 max-lg:border max-lg:text-[11px] ${
          activeTool === tool.id
            ? 'bg-white text-slate-800 shadow-sm ring-1 ring-blush-500 max-lg:border-blush-500'
            : 'text-slate-500 hover:text-slate-700 max-lg:bg-white max-lg:border-blush-100'
        }`}
        title={tool.label}
        aria-pressed={activeTool === tool.id}
      >
        <span className="flex items-center justify-center max-lg:[&>svg]:h-5 max-lg:[&>svg]:w-5">{tool.icon}</span>
        <span className="hidden sm:inline max-lg:inline">{tool.label}</span>
      </button>
    ))}
  </div>
);

export default ToolButtons;
