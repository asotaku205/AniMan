"use client";

import {
  Pen, Brush, Eraser, PaintBucket, MousePointer2,
  Square, Type as TypeIcon, Hand,
} from "lucide-react";
import { TOOL_NAMES } from "../hooks/useDrawStudio";
import type { DrawTool } from "../data";

const TOOL_ICONS: Record<DrawTool, React.ReactNode> = {
  pen:    <Pen size={16} />,
  brush:  <Brush size={16} />,
  eraser: <Eraser size={16} />,
  fill:   <PaintBucket size={16} />,
  select: <MousePointer2 size={16} />,
  shape:  <Square size={16} />,
  text:   <TypeIcon size={16} />,
  pan:    <Hand size={16} />,
};

const TOOLS = Object.keys(TOOL_ICONS) as DrawTool[];

type Props = {
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  size: number;
  onSizeChange: (s: number) => void;
  /** Disabled when no active panel */
  disabled: boolean;
};

export function LeftToolbar({ tool, onToolChange, color, onColorChange, size, onSizeChange, disabled }: Props) {
  return (
    <div className={`w-16 bg-[#120a1f] border-r border-white/5 flex flex-col items-center py-3 gap-1 flex-shrink-0 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {TOOLS.map(t => (
        <button
          key={t}
          onClick={() => onToolChange(t)}
          title={TOOL_NAMES[t]}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            tool === t
              ? "bg-pink-500/30 text-pink-400 ring-1 ring-pink-500/50"
              : "text-white/40 hover:bg-white/5 hover:text-white/80"
          }`}
        >
          {TOOL_ICONS[t]}
        </button>
      ))}

      <div className="mt-3 w-8 h-px bg-white/10" />

      {/* Color picker */}
      <div className="relative mt-2">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden cursor-pointer">
          <input
            type="color"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            className="absolute -inset-1 opacity-0 cursor-pointer w-12 h-12"
          />
          <div className="w-full h-full rounded-full" style={{ background: color }} />
        </div>
      </div>

      {/* Size slider */}
      <p className="text-white/30 text-[8px] tracking-widest mt-2">CỠ</p>
      <input
        type="range" min={1} max={40} value={size}
        onChange={e => onSizeChange(+e.target.value)}
        className="h-20 w-2 appearance-none bg-transparent cursor-pointer"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />
      <span className="text-white/50 text-[9px] font-mono">{size}</span>
    </div>
  );
}
