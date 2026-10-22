"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  FlipHorizontal,
  FlipVertical,
  Lasso,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { DrawTool } from "../data";
import type { ShapeKind } from "../lib/shape";
import { dabAlpha, hardnessBlurRadius, smoothStroke } from "../lib/stroke";
import type { ToolSettings } from "../lib/toolSettings";
import { EFFECT_MODES, effectModeLabel, MANGA_PALETTE, normalizeHex, SIZE_PRESETS } from "../lib/toolSettings";
import {
  GRADIENT_ENDS,
  GRADIENT_SHAPES,
  gradientEndLabel,
  gradientShapeLabel,
} from "../lib/gradient";
import { CURVE_BOW_MAX, CURVE_BOW_MIN } from "../lib/curve";
import { SYMMETRY_MODES, symmetryHint, symmetryLabel } from "../lib/symmetry";
import { ROTATE_STEP, SCALE_STEP, type SelectMode } from "../lib/selection";

type Props = {
  tool: DrawTool;
  settings: ToolSettings;
  onSettingsChange: (patch: Partial<ToolSettings>) => void;
  color: string;
  /** Đổi màu vẽ ngay trong thanh thuộc tính (7.8). */
  onColorChange: (color: string) => void;
  disabled: boolean;
  /** Kiểu hình / kiểu đường đang chọn (dùng chung công cụ Hình và Đường — 3D). */
  shapeType: ShapeKind;
  onShapeTypeChange: (kind: ShapeKind) => void;
  /** Đang có vùng chọn hay không (3C) — quyết định nút biến đổi có sáng không. */
  selectionActive: boolean;
  selectMode: SelectMode;
  onSelectModeChange: (mode: SelectMode) => void;
  onRotateSelection: (direction: 1 | -1) => void;
  onFlipSelection: (axis: "h" | "v") => void;
  onScaleSelection: (factor: number) => void;
  onInvertSelection: () => void;
  onDeleteSelection: () => void;
  onClearSelection: () => void;
};

const PREVIEW_W = 168;
const PREVIEW_H = 36;

/**
 * Chọn màu ngay trong thanh thuộc tính (7.8): nút màu + mã HEX, popover chứa
 * 16 màu manga, ô HEX và màu tuỳ chọn. Màu là thuộc tính của nét nên đứng cạnh
 * Cỡ/Độ mờ; để trong popover cho thanh không cao thêm.
 */
function ColorControl({
  color,
  disabled,
  onChange,
}: {
  color: string;
  disabled: boolean;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  /** Bản nháp HEX đang gõ; null = đang hiện màu thật. */
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? color;

  const commit = () => {
    const normalized = draft === null ? null : normalizeHex(draft);
    if (normalized) onChange(normalized);
    setDraft(null);
  };

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={`Màu vẽ ${color} — bấm để chọn màu`}
        aria-label="Chọn màu vẽ"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 px-1.5 py-1 transition-colors"
      >
        <span
          className="w-6 h-6 rounded-full border-2 border-white/25 shadow-sm"
          style={{ background: color }}
        />
        <span className="text-[10px] font-mono text-white/60 uppercase">
          {color}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full mt-2 z-50 w-[196px] bg-[#0d0817] border border-pink-500/25 rounded-2xl p-2.5 shadow-2xl">
            <p className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-2">
              Màu nhanh
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {MANGA_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setDraft(null);
                    setOpen(false);
                  }}
                  title={c}
                  aria-label={`Màu ${c}`}
                  className={`w-7 h-7 rounded-md border transition-transform hover:scale-105 ${
                    color.toLowerCase() === c
                      ? "border-pink-400 ring-1 ring-pink-400/60"
                      : "border-white/15"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-2">
              <label
                className="relative w-7 h-7 rounded-md border border-white/20 overflow-hidden cursor-pointer flex-shrink-0"
                title="Màu tuỳ chọn"
                style={{ background: color }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className="absolute -inset-2 opacity-0 cursor-pointer"
                />
              </label>
              <input
                value={value}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                }}
                placeholder="#RRGGBB"
                title="Nhập mã màu HEX rồi Enter"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-[10px] font-mono text-white/70 text-center uppercase focus:outline-none focus:border-pink-500/40"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Nhóm điều khiển: nhãn nhỏ + slider + giá trị (dùng chung cho mọi thuộc tính). */
function Slider({
  label,
  value,
  min,
  max,
  suffix = "%",
  onChange,
  width = "w-28",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
  width?: string;
}) {
  return (
    <label className="flex items-center gap-1.5" title={label}>
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold whitespace-nowrap">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className={`${width} accent-pink-500 cursor-pointer`}
      />
      <span className="text-[10px] font-mono text-white/60 w-9 text-right">
        {value}
        {suffix}
      </span>
    </label>
  );
}

/** Nhóm nút chọn một trong vài lựa chọn (kiểu đối xứng, đầu màu, chế độ hiệu ứng…). */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  title,
}: {
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  title?: string;
}) {
  return (
    <div
      className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg flex-shrink-0"
      title={title}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.hint ?? o.label}
          className={`px-2 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
            value === o.value
              ? "bg-pink-500/30 text-pink-300 ring-1 ring-pink-500/40"
              : "text-white/50 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Nút biểu tượng nhỏ cho nhóm điều khiển vùng chọn (AC-T3.1, AC-T3.4). */
function IconButton({
  onClick,
  title,
  active,
  dim,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-disabled={dim ? true : undefined}
      className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
        active
          ? "bg-pink-500/30 text-pink-300 ring-1 ring-pink-500/40"
          : dim
            ? "text-white/25 hover:text-white/40"
            : "text-white/60 hover:text-white hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Thanh thuộc tính động theo công cụ (AC-T2.1…AC-T2.6).
 * Nằm ngang ngay dưới thanh trên cùng; mọi thay đổi cập nhật **preview nét**
 * ngay lập tức (AC-T2.2). Công cụ Chọn có nhóm điều khiển vùng chọn riêng (3C).
 */
export function ToolOptionsBar({
  tool,
  settings,
  onSettingsChange,
  color,
  onColorChange,
  disabled,
  shapeType,
  onShapeTypeChange,
  selectionActive,
  selectMode,
  onSelectModeChange,
  onRotateSelection,
  onFlipSelection,
  onScaleSelection,
  onInvertSelection,
  onDeleteSelection,
  onClearSelection,
}: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null);

  // ── Preview nét mẫu (AC-T2.2) ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = 2;
    canvas.width = PREVIEW_W * dpr;
    canvas.height = PREVIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

    const midY = PREVIEW_H / 2;
    // Đường zig-zag thô → cho qua bộ làm mượt để thấy tác dụng của `smoothing`
    const raw = [
      { x: 6, y: midY },
      { x: 24, y: midY - 11 },
      { x: 42, y: midY + 11 },
      { x: 60, y: midY - 11 },
      { x: 78, y: midY + 11 },
      { x: 96, y: midY - 11 },
      { x: 114, y: midY + 11 },
      { x: 132, y: midY - 11 },
      { x: 162, y: midY },
    ];
    const path = smoothStroke(raw, settings.smoothing);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, Math.min(settings.size, PREVIEW_H - 8));

    if (tool === "eraser") {
      // Nền xám trên giấy trắng rồi tẩy → thấy đúng bề rộng và độ mờ của tẩy
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, midY - 12, PREVIEW_W, 24);
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha =
        settings.eraserMode === "alpha" ? settings.opacity / 100 : 1;
    } else {
      ctx.strokeStyle = color;
      ctx.globalAlpha = settings.opacity / 100;
    }

    const draw = () => {
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i += 1) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    };
    // Cùng công thức với lúc hợp nhất nét xuống layer → preview đúng như thật
    const blur = hardnessBlurRadius(settings.hardness, settings.size);
    if (blur > 0.1) ctx.filter = `blur(${blur.toFixed(2)}px)`;

    if (tool === "brush" || tool === "airbrush" || tool === "symmetry") {
      // Cọ (và cọ phun, đối xứng): hai lớp mực lệch nhẹ theo `flow` → thấy rõ
      // "chồng thì đậm"
      ctx.globalAlpha = (settings.opacity / 100) * dabAlpha(settings.flow);
      ctx.save();
      ctx.translate(0, -1.5);
      draw();
      ctx.restore();
      ctx.save();
      ctx.translate(0, 1.5);
      draw();
      ctx.restore();
    } else {
      draw();
    }
    ctx.filter = "none";
  }, [tool, settings, color]);

  /** Nhóm cọ: bút/cọ/tẩy dùng chung bộ điều khiển nét mượt (AC-T2.1). */
  const isBrushLike =
    tool === "brush" || tool === "airbrush" || tool === "symmetry";
  const showSize =
    tool !== "fill" &&
    tool !== "select" &&
    tool !== "pan" &&
    tool !== "eyedropper" &&
    tool !== "gradient";
  const showOpacity =
    showSize && tool !== "effect";
  const showFlow = isBrushLike;
  const showHardness = isBrushLike || tool === "eraser";
  const showSmoothing = isBrushLike || tool === "pen" || tool === "eraser";
  // Preview nét chỉ có nghĩa với công cụ vẽ nét (bút/cọ/phun/đối xứng/tẩy)
  const showPreview = showSmoothing;
  const isSelectionTool = tool === "select";
  /**
   * Công cụ có vẽ nét nên đặt được trục đối xứng (BRD T-1 #13). Chuyển sắc và
   * thùng sơn không dùng trục nên không hiện nhóm này.
   */
  const showSymmetry =
    tool === "pen" ||
    tool === "brush" ||
    tool === "eraser" ||
    tool === "airbrush" ||
    tool === "symmetry" ||
    tool === "line" ||
    tool === "curve" ||
    tool === "shape" ||
    tool === "effect";

  return (
    <div
      className={`min-h-12 bg-[#0d0817] border-b border-white/5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1.5 flex-shrink-0 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {/* Preview nét mẫu */}
      {showPreview && (
        <>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-white/35 font-semibold">
              Nét mẫu
            </span>
            <canvas
              ref={previewRef}
              style={{
                width: PREVIEW_W,
                height: PREVIEW_H,
                background: "#ffffff",
              }}
              className="rounded-lg border border-white/15 shadow-inner"
            />
          </div>

          <div className="w-px h-7 bg-white/10 flex-shrink-0 hidden 2xl:block" />
        </>
      )}

      {/* ── Vùng chọn (3C — BR-T05, AC-T3.1–T3.4) ─────────────────────────────── */}
      {isSelectionTool && (
        <>
          {/* Kiểu khoanh vùng */}
          <div className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg flex-shrink-0">
            <IconButton
              onClick={() => onSelectModeChange("rect")}
              title="Khoanh vùng chữ nhật"
              active={selectMode === "rect"}
            >
              <Square size={13} />
            </IconButton>
            <IconButton
              onClick={() => onSelectModeChange("lasso")}
              title="Khoanh vùng tự do (lasso)"
              active={selectMode === "lasso"}
            >
              <Lasso size={13} />
            </IconButton>
          </div>

          {/* Biến đổi vùng chọn kèm pixel bên trong (AC-T3.1) */}
          <div
            className="flex items-center gap-0.5 bg-white/5 p-0.5 rounded-lg flex-shrink-0"
            title="Biến đổi vùng chọn cùng nội dung bên trong"
          >
            <IconButton
              onClick={() => onRotateSelection(-1)}
              title={`Xoay trái ${ROTATE_STEP}°`}
              dim={!selectionActive}
            >
              <RotateCcw size={13} />
            </IconButton>
            <IconButton
              onClick={() => onRotateSelection(1)}
              title={`Xoay phải ${ROTATE_STEP}°`}
              dim={!selectionActive}
            >
              <RotateCw size={13} />
            </IconButton>
            <IconButton
              onClick={() => onFlipSelection("h")}
              title="Lật ngang"
              dim={!selectionActive}
            >
              <FlipHorizontal size={13} />
            </IconButton>
            <IconButton
              onClick={() => onFlipSelection("v")}
              title="Lật dọc"
              dim={!selectionActive}
            >
              <FlipVertical size={13} />
            </IconButton>
            <IconButton
              onClick={() => onScaleSelection(SCALE_STEP)}
              title="Phóng to có tỉ lệ"
              dim={!selectionActive}
            >
              <ZoomIn size={13} />
            </IconButton>
            <IconButton
              onClick={() => onScaleSelection(1 / SCALE_STEP)}
              title="Thu nhỏ có tỉ lệ"
              dim={!selectionActive}
            >
              <ZoomOut size={13} />
            </IconButton>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onInvertSelection}
              title="Đảo vùng chọn (Ctrl+Shift+I)"
              aria-disabled={!selectionActive}
              className={`px-2 py-1 rounded-md text-[10px] transition-colors ${
                selectionActive
                  ? "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  : "text-white/25 hover:text-white/40"
              }`}
            >
              Đảo
            </button>
            <IconButton
              onClick={onDeleteSelection}
              title="Xóa nội dung trong vùng chọn (Delete)"
              dim={!selectionActive}
            >
              <Trash2 size={13} />
            </IconButton>
            <IconButton
              onClick={onClearSelection}
              title="Bỏ chọn (Esc)"
              dim={!selectionActive}
            >
              <X size={13} />
            </IconButton>
          </div>

          <span className="text-[10px] text-white/35 flex-shrink-0">
            {selectionActive
              ? "Kéo bên trong vùng chọn để dời; Delete xóa; Ctrl+C/Ctrl+V sao chép–dán"
              : "Kéo để khoanh vùng chọn; Esc bỏ chọn"}
          </span>
        </>
      )}

      {/* ── Bộ công cụ mở rộng (Phase 3 slice D) ──────────────────────────────── */}

      {/* Đường thẳng / mũi tên (BRD T-1 #10) */}
      {tool === "line" && (
        <Segmented
          title="Kiểu đường (giữ Shift khi kéo để khoá 45°)"
          value={shapeType === "arrow" ? "arrow" : "line"}
          options={[
            { value: "line", label: "Đường thẳng", hint: "Đường thẳng một nhát kéo" },
            { value: "arrow", label: "Mũi tên", hint: "Đường thẳng có đầu mũi tên" },
          ]}
          onChange={(v) => onShapeTypeChange(v)}
        />
      )}

      {/* Chuyển sắc (BRD T-1 #11): đầu kia màu gì và trải màu kiểu gì */}
      {tool === "gradient" && (
        <>
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold whitespace-nowrap">
            Chuyển sắc
          </span>
          <Segmented
            title="Màu ở đầu thứ hai của dải (đầu thứ nhất là màu đang vẽ)"
            value={settings.gradientEnd}
            options={GRADIENT_ENDS.map((end) => ({
              value: end,
              label: gradientEndLabel(end),
            }))}
            onChange={(v) => onSettingsChange({ gradientEnd: v })}
          />
          <Segmented
            title="Cách trải màu giữa hai đầu"
            value={settings.gradientShape}
            options={GRADIENT_SHAPES.map((shape) => ({
              value: shape,
              label: gradientShapeLabel(shape),
            }))}
            onChange={(v) => onSettingsChange({ gradientShape: v })}
          />
        </>
      )}

      {/* Đường cong (BRD T-1 #15): uốn đường về hai phía */}
      {tool === "curve" && (
        <Slider
          label="Độ cong"
          value={settings.curveBow}
          min={CURVE_BOW_MIN}
          max={CURVE_BOW_MAX}
          suffix=""
          onChange={(v) => onSettingsChange({ curveBow: v })}
        />
      )}

      {/* Làm mờ / Làm sắc nét (BRD T-1 #16) */}
      {tool === "effect" && (
        <>
          <Segmented
            title="Mỗi nhát cọ làm mờ hay làm sắc nét vùng bên dưới"
            value={settings.effectMode}
            options={EFFECT_MODES.map((mode) => ({
              value: mode,
              label: effectModeLabel(mode),
            }))}
            onChange={(v) => onSettingsChange({ effectMode: v })}
          />
          <Slider
            label="Độ mạnh"
            value={settings.effectStrength}
            min={1}
            max={100}
            onChange={(v) => onSettingsChange({ effectStrength: v })}
          />
        </>
      )}

      {/* Đối xứng (BRD T-1 #13): dùng được cho mọi công cụ vẽ nét */}
      {showSymmetry && (
        <>
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold whitespace-nowrap">
            Đối xứng
          </span>
          <Segmented
            title="Trục đối xứng khi vẽ"
            value={settings.symmetry}
            options={SYMMETRY_MODES.map((mode) => ({
              value: mode,
              label: symmetryLabel(mode),
              hint: symmetryHint(mode),
            }))}
            onChange={(v) => onSettingsChange({ symmetry: v })}
          />
        </>
      )}

      {/* Màu vẽ — đứng cùng Cỡ/Độ mờ vì là thuộc tính của nét (7.8) */}
      <ColorControl color={color} disabled={disabled} onChange={onColorChange} />

      {/* Kích thước + preset (AC-T2.5) */}
      {showSize && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Slider
            label="Cỡ"
            value={settings.size}
            min={1}
            max={200}
            suffix="px"
            width="w-28"
            onChange={(v) => onSettingsChange({ size: v })}
          />
          <div className="flex items-center gap-0.5">
            {SIZE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => onSettingsChange({ size: p })}
                title={`Cỡ ${p}px`}
                className={`px-2 py-1 rounded-md text-[10px] font-mono transition-colors ${
                  settings.size === p
                    ? "bg-pink-500/30 text-pink-300 ring-1 ring-pink-500/40"
                    : "bg-white/5 text-white/50 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {showOpacity && (
        <Slider
          label="Độ mờ"
          value={settings.opacity}
          min={1}
          max={100}
          onChange={(v) => onSettingsChange({ opacity: v })}
        />
      )}

      {/* flow + hardness: cọ, cọ phun, đối xứng; tẩy chỉ có độ cứng (AC-T2.1) */}
      {showFlow && (
        <Slider
          label="Mực"
          value={settings.flow}
          min={1}
          max={100}
          onChange={(v) => onSettingsChange({ flow: v })}
        />
      )}

      {showHardness && (
        <Slider
          label="Cứng"
          value={settings.hardness}
          min={0}
          max={100}
          onChange={(v) => onSettingsChange({ hardness: v })}
        />
      )}

      {showSmoothing && (
        <Slider
          label="Mượt"
          value={settings.smoothing}
          min={0}
          max={100}
          onChange={(v) => onSettingsChange({ smoothing: v })}
        />
      )}

      {/* Chế độ tẩy (BR-T04) */}
      {tool === "eraser" && (
        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg flex-shrink-0">
          {(
            [
              ["clear", "Xóa sạch"],
              ["alpha", "Xóa mờ"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => onSettingsChange({ eraserMode: mode })}
              title={
                mode === "clear"
                  ? "Xóa hẳn pixel (mặc định)"
                  : "Xóa theo độ mờ — nhạt dần"
              }
              className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${
                settings.eraserMode === mode
                  ? "bg-pink-500/30 text-pink-300 ring-1 ring-pink-500/40"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!showSize && !isSelectionTool && (
        <span className="text-[10px] text-white/35 flex-shrink-0">
          {tool === "fill"
            ? "Thùng sơn: đổ màu đang chọn vào vùng kín (tôn trọng vùng chọn)"
            : tool === "eyedropper"
              ? "Bút lấy màu: bấm vào tranh để lấy màu từ ảnh tổng hợp"
              : tool === "gradient"
                ? "Chuyển sắc: kéo từ đầu này sang đầu kia — cú kéo chính là trục chuyển sắc"
                : "Kéo để di chuyển khung nhìn — cuộn để phóng to"}
        </span>
      )}
    </div>
  );
}
