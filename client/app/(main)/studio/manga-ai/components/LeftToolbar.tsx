"use client";

import React from "react";
import {
  Pen,
  Brush,
  Eraser,
  PaintBucket,
  MousePointer2,
  Square,
  Circle,
  Minus,
  Type as TypeIcon,
  Hand,
  Check,
} from "lucide-react";
import { TOOL_NAMES } from "../hooks/useDrawStudio";
import type { DrawTool } from "../data";

const TOOL_ICONS: Record<DrawTool, React.ReactNode> = {
  pen: <Pen size={16} />,
  brush: <Brush size={16} />,
  eraser: <Eraser size={16} />,
  fill: <PaintBucket size={16} />,
  select: <MousePointer2 size={16} />,
  shape: <Square size={16} />,
  text: <TypeIcon size={16} />,
  pan: <Hand size={16} />,
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
  shapeType?: "rect" | "circle" | "line";
  onShapeTypeChange?: (t: "rect" | "circle" | "line") => void;
  shapeFill?: boolean;
  onShapeFillChange?: (f: boolean) => void;
};

export function LeftToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  disabled,
  shapeType = "rect",
  onShapeTypeChange,
  shapeFill = false,
  onShapeFillChange,
}: Props) {
  return (
    <div
      className={`w-16 bg-[#120a1f] border-r border-white/5 flex flex-col items-center py-3 gap-1 flex-shrink-0 relative ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {TOOLS.map((t) => (
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

      {/* Sub-menu chọn loại hình khi tool === "shape" */}
      {tool === "shape" && (
        <div className="absolute left-16 top-32 z-50 bg-[#0d0817]/95 border border-purple-500/30 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 w-32">
          <p className="text-[9px] uppercase tracking-wider text-white/40 font-semibold px-1">
            Loại hình
          </p>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
            <button
              onClick={() => onShapeTypeChange?.("rect")}
              title="Chữ nhật"
              className={`flex-1 p-1 rounded-lg flex items-center justify-center transition-colors ${
                shapeType === "rect"
                  ? "bg-purple-600 text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Square size={13} />
            </button>
            <button
              onClick={() => onShapeTypeChange?.("circle")}
              title="Hình tròn / Ellipse"
              className={`flex-1 p-1 rounded-lg flex items-center justify-center transition-colors ${
                shapeType === "circle"
                  ? "bg-purple-600 text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Circle size={13} />
            </button>
            <button
              onClick={() => onShapeTypeChange?.("line")}
              title="Đường thẳng"
              className={`flex-1 p-1 rounded-lg flex items-center justify-center transition-colors ${
                shapeType === "line"
                  ? "bg-purple-600 text-white"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Minus size={13} />
            </button>
          </div>
          {shapeType !== "line" && (
            <button
              onClick={() => onShapeFillChange?.(!shapeFill)}
              className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] transition-colors ${
                shapeFill
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "bg-white/5 text-white/40 hover:text-white"
              }`}
            >
              <span>Đổ đặc nền</span>
              {shapeFill && <Check size={11} className="text-purple-400" />}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 w-8 h-px bg-white/10" />

      {/* Color picker */}
      <div className="relative mt-2" title="Chọn màu vẽ">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden cursor-pointer shadow-md">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="absolute -inset-1 opacity-0 cursor-pointer w-12 h-12"
          />
          <div
            className="w-full h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      </div>

      {/* Size slider */}
      <p className="text-white/30 text-[8px] tracking-widest mt-2">CỠ</p>
      <input
        type="range"
        min={1}
        max={40}
        value={size}
        onChange={(e) => onSizeChange(+e.target.value)}
        className="h-20 w-2 appearance-none bg-transparent cursor-pointer accent-pink-500"
        style={{ writingMode: "vertical-lr", direction: "rtl" }}
      />
      <span className="text-white/50 text-[9px] font-mono">{size}px</span>
    </div>
  );
}
