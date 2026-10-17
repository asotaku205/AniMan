"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  Pen,
  Brush,
  SprayCan,
  Eraser,
  PaintBucket,
  Blend,
  Pipette,
  MousePointer2,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Pentagon,
  Star,
  Spline,
  Slash,
  Waves,
  FlipHorizontal2,
  Type as TypeIcon,
  Hand,
  Check,
} from "lucide-react";
import { TOOL_NAMES, TOOL_SHORTCUTS } from "../hooks/useDrawStudio";
import { MANGA_PALETTE, normalizeHex } from "../lib/toolSettings";
import {
  clampSides,
  LINE_KINDS,
  SHAPE_KINDS,
  SIDES_MAX,
  SIDES_MIN,
  shapeLabel,
  type ShapeKind,
} from "../lib/shape";
import { TOOL_HELP, type DrawTool } from "../data";

const TOOL_ICONS: Record<DrawTool, React.ReactNode> = {
  pen: <Pen size={16} />,
  brush: <Brush size={16} />,
  airbrush: <SprayCan size={16} />,
  eraser: <Eraser size={16} />,
  fill: <PaintBucket size={16} />,
  gradient: <Blend size={16} />,
  eyedropper: <Pipette size={16} />,
  shape: <Square size={16} />,
  line: <Slash size={16} />,
  curve: <Spline size={16} />,
  select: <MousePointer2 size={16} />,
  effect: <Waves size={16} />,
  symmetry: <FlipHorizontal2 size={16} />,
  text: <TypeIcon size={16} />,
  pan: <Hand size={16} />,
};

/**
 * Công cụ xếp theo nhóm cho dễ tìm khi đã có 15 công cụ (Phase 3 slice D).
 * Phím tắt không theo thứ tự này mà theo bảng công cụ của BRD (Phụ lục A):
 * `1`–`9` cho 9 công cụ đầu, chữ cái cho các công cụ thêm.
 *
 * `TOOL_GROUP_OF` là `Record<DrawTool, …>` nên **thêm công cụ mới mà quên xếp
 * nhóm là TypeScript báo lỗi ngay**; thứ tự nút trong nhóm lấy theo thứ tự khai
 * báo của `TOOL_ICONS`.
 */
const GROUP_ORDER = ["Vẽ", "Tô", "Hình", "Vùng", "Khác"] as const;

const TOOL_GROUP_OF: Record<DrawTool, (typeof GROUP_ORDER)[number]> = {
  pen: "Vẽ",
  brush: "Vẽ",
  airbrush: "Vẽ",
  eraser: "Vẽ",
  fill: "Tô",
  gradient: "Tô",
  eyedropper: "Tô",
  shape: "Hình",
  line: "Hình",
  curve: "Hình",
  select: "Vùng",
  effect: "Vùng",
  symmetry: "Vùng",
  text: "Khác",
  pan: "Khác",
};

const TOOL_GROUPS = GROUP_ORDER.map((label) => ({
  label,
  tools: (Object.keys(TOOL_ICONS) as DrawTool[]).filter(
    (t) => TOOL_GROUP_OF[t] === label,
  ),
}));

const SHAPE_ICONS: Record<ShapeKind, React.ReactNode> = {
  rect: <Square size={13} />,
  circle: <Circle size={13} />,
  line: <Minus size={13} />,
  arrow: <MoveUpRight size={13} />,
  polygon: <Pentagon size={13} />,
  star: <Star size={13} />,
};

type Props = {
  tool: DrawTool;
  onToolChange: (t: DrawTool) => void;
  color: string;
  onColorChange: (c: string) => void;
  /** Disabled when no active panel */
  disabled: boolean;
  shapeType?: ShapeKind;
  onShapeTypeChange?: (t: ShapeKind) => void;
  shapeFill?: boolean;
  onShapeFillChange?: (f: boolean) => void;
  /** Số cạnh đa giác / số cánh sao (BRD T-1 #6). */
  shapeSides?: number;
  onShapeSidesChange?: (n: number) => void;
};

export function LeftToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  disabled,
  shapeType = "rect",
  onShapeTypeChange,
  shapeFill = false,
  onShapeFillChange,
  shapeSides = 5,
  onShapeSidesChange,
}: Props) {
  // Ô nhập HEX chỉ chốt màu khi hợp lệ (AC-T2.3). `hexDraft = null` nghĩa là
  // đang không sửa → hiện màu hiện tại, nên không cần đồng bộ bằng effect.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexValue = hexDraft ?? color;
  /**
   * Công cụ đang được rê chuột (kèm toạ độ nút) → hiện bảng hướng dẫn. Bảng được
   * render qua portal ra `document.body` và đặt `position: fixed` vì khung studio
   * có `overflow-hidden`: để trong thanh công cụ thì bảng bị cắt cụt.
   */
  const [hovered, setHovered] = useState<{
    tool: DrawTool;
    left: number;
    top: number;
  } | null>(null);

  const openHelp = (t: DrawTool, r: DOMRect) => {
    setHovered({
      tool: t,
      left: Math.max(8, Math.min(r.right + 8, window.innerWidth - 272)),
      top: Math.max(8, Math.min(r.top, window.innerHeight - 240)),
    });
  };

  /** Chọn màu từ bảng/circle: bỏ bản nháp đang gõ dở để ô HEX theo màu mới. */
  const pickColor = (c: string) => {
    setHexDraft(null);
    onColorChange(c);
  };

  const commitHex = () => {
    const normalized = hexDraft === null ? null : normalizeHex(hexDraft);
    if (normalized) onColorChange(normalized);
    setHexDraft(null);
  };

  /** Công cụ đang hiện bảng chọn kiểu (Hình: 6 kiểu; Đường/mũi tên: 2 kiểu). */
  const showShapePanel = tool === "shape" || tool === "line";
  const isLineTool = tool === "line";
  /** Kiểu đang vẽ của công cụ Đường (dùng chung state với công cụ Hình). */
  const activeKind: ShapeKind = isLineTool
    ? shapeType === "arrow"
      ? "arrow"
      : "line"
    : shapeType;
  const showSides = shapeType === "polygon" || shapeType === "star";
  const showFillToggle =
    !isLineTool && shapeType !== "line" && shapeType !== "arrow";

  return (
    <div
      className={`w-16 bg-[#120a1f] border-r border-white/5 flex flex-col items-center py-3 gap-1 flex-shrink-0 relative ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {/* AC-T1.3: chưa vào khung thì công cụ bị vô hiệu **kèm lý do**, không im lặng */}
      {disabled && (
        <p className="text-[8px] leading-tight text-amber-300/90 text-center px-1 mb-1">
          Mở một khung tranh để dùng công cụ
        </p>
      )}

      {/* 15 công cụ nên danh sách cuộn được, phần bảng màu vẫn ghim dưới cùng */}
      <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-none flex flex-col items-center gap-0.5">
        {TOOL_GROUPS.map((group, gi) => (
          <React.Fragment key={group.label}>
            <div className="flex items-center gap-0.5 my-0.5">
              {gi > 0 && <div className="w-4 h-px bg-white/10" />}
              <span className="text-[7px] uppercase tracking-wider text-white/25 font-semibold">
                {group.label}
              </span>
              <div className="w-4 h-px bg-white/10" />
            </div>
            {group.tools.map((t) => (
              // Bọc ngoài để vẫn có tooltip khi nút bị vô hiệu (nút disabled không nhận
              // sự kiện chuột, nhưng phần tử cha thì nhận) — lúc đó người dùng cần lý do
              // nhất.
              <div
                key={t}
                className="flex-shrink-0"
                onMouseEnter={(e) =>
                  openHelp(t, e.currentTarget.getBoundingClientRect())
                }
                onMouseLeave={() => setHovered(null)}
              >
                <button
                  onClick={() => onToolChange(t)}
                  disabled={disabled}
                  aria-label={`${TOOL_NAMES[t]} (phím ${TOOL_SHORTCUTS[t]})`}
                  onFocus={(e) =>
                    openHelp(t, e.currentTarget.getBoundingClientRect())
                  }
                  onBlur={() => setHovered(null)}
                  className={`w-10 h-9 rounded-xl flex items-center justify-center transition-all disabled:cursor-not-allowed relative ${
                    tool === t
                      ? "bg-pink-500/30 text-pink-400 ring-1 ring-pink-500/50"
                      : "text-white/40 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  {TOOL_ICONS[t]}
                  {/* AC-T1.1: nhắc phím tắt ngay trên nút */}
                  <span className="absolute bottom-0 right-0.5 text-[7px] font-mono text-white/30 leading-none">
                    {TOOL_SHORTCUTS[t]}
                  </span>
                </button>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      {/* Bảng hướng dẫn công cụ (portal ra body để không bị overflow cắt) */}
      {hovered &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[60] w-64 max-h-[calc(100vh-16px)] overflow-y-auto"
            style={{ left: hovered.left, top: hovered.top }}
          >
            <div className="bg-[#0d0817]/97 border border-pink-500/25 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md">
              <p className="text-[10px] font-semibold text-pink-300">
                {TOOL_NAMES[hovered.tool]}
                <span className="ml-1.5 font-mono text-[9px] text-white/40">
                  phím {TOOL_SHORTCUTS[hovered.tool]}
                </span>
              </p>
              <p className="text-[10px] text-white/70 leading-relaxed mt-0.5">
                {TOOL_HELP[hovered.tool].summary}
              </p>
              <ul className="mt-1.5 space-y-1">
                {TOOL_HELP[hovered.tool].hints.map((hint) => (
                  <li
                    key={hint}
                    className="flex gap-1.5 text-[9px] text-white/55 leading-relaxed"
                  >
                    <span className="text-pink-400/70">•</span>
                    <span>{hint}</span>
                  </li>
                ))}
              </ul>
              {disabled && (
                <p className="mt-1.5 pt-1.5 border-t border-white/10 text-[9px] text-amber-300/90">
                  Chưa mở khung tranh nào — hãy mở một khung để dùng công cụ.
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Sub-menu chọn loại hình / kiểu đường (BRD T-1 #6, #10) */}
      {showShapePanel && !disabled && (
        <div className="absolute left-16 top-24 z-50 bg-[#0d0817]/95 border border-purple-500/30 rounded-2xl p-2 shadow-2xl backdrop-blur-md flex flex-col gap-1.5 w-36">
          <p className="text-[9px] uppercase tracking-wider text-white/40 font-semibold px-1">
            {isLineTool ? "Kiểu đường" : "Loại hình"}
          </p>
          <div className="grid grid-cols-4 gap-1 bg-white/5 p-1 rounded-xl">
            {(isLineTool ? LINE_KINDS : SHAPE_KINDS).map((kind) => (
              <button
                key={kind}
                onClick={() => onShapeTypeChange?.(kind)}
                title={shapeLabel(kind)}
                className={`p-1 rounded-lg flex items-center justify-center transition-colors ${
                  activeKind === kind
                    ? "bg-purple-600 text-white"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {SHAPE_ICONS[kind]}
              </button>
            ))}
          </div>

          {showFillToggle && (
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

          {showSides && (
            <label
              className="flex items-center gap-1 px-1"
              title={
                shapeType === "star"
                  ? "Số cánh của ngôi sao"
                  : "Số cạnh của đa giác"
              }
            >
              <span className="text-[9px] text-white/40 whitespace-nowrap">
                {shapeType === "star" ? "Số cánh" : "Số cạnh"}
              </span>
              <input
                type="range"
                min={SIDES_MIN}
                max={SIDES_MAX}
                value={shapeSides}
                onChange={(e) => onShapeSidesChange?.(clampSides(+e.target.value))}
                className="flex-1 w-full accent-purple-500 cursor-pointer"
              />
              <span className="text-[9px] font-mono text-white/60 w-4 text-right">
                {shapeSides}
              </span>
            </label>
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
            disabled={disabled}
            onChange={(e) => pickColor(e.target.value)}
            className="absolute -inset-1 opacity-0 cursor-pointer w-12 h-12"
          />
          <div
            className="w-full h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      </div>

      {/* Bảng màu nhanh 16 màu manga (AC-T2.3) */}
      <p className="text-white/30 text-[8px] tracking-widest mt-3">MÀU</p>
      <div className="grid grid-cols-4 gap-1 mt-1.5">
        {MANGA_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => pickColor(c)}
            disabled={disabled}
            title={c}
            className={`w-3.5 h-3.5 rounded-[4px] border transition-transform hover:scale-110 ${
              color.toLowerCase() === c
                ? "border-pink-400 ring-1 ring-pink-400/60"
                : "border-white/15"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      {/* Nhập HEX tay (AC-T2.3) */}
      <input
        value={hexValue}
        disabled={disabled}
        onChange={(e) => setHexDraft(e.target.value)}
        onBlur={commitHex}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitHex();
        }}
        placeholder="#RRGGBB"
        title="Nhập mã màu HEX rồi Enter"
        className="mt-1.5 w-14 bg-white/5 border border-white/10 rounded-md px-1 py-0.5 text-[8px] font-mono text-white/70 text-center focus:outline-none focus:border-pink-500/40"
      />
    </div>
  );
}
