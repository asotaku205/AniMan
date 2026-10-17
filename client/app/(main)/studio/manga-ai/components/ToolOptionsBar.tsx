"use client";

import React, { useEffect, useRef } from "react";
import type { DrawTool } from "../data";
import { dabAlpha, smoothStroke } from "../lib/stroke";
import type { ToolSettings } from "../lib/toolSettings";
import { SIZE_PRESETS } from "../lib/toolSettings";

type Props = {
  tool: DrawTool;
  settings: ToolSettings;
  onSettingsChange: (patch: Partial<ToolSettings>) => void;
  color: string;
  disabled: boolean;
};

const PREVIEW_W = 168;
const PREVIEW_H = 36;

/** Nhóm điều khiển: nhãn nhỏ + slider + giá trị (dùng chung cho mọi thuộc tính). */
function Slider({
  label,
  value,
  min,
  max,
  suffix = "%",
  onChange,
  width = "w-24",
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
      <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold whitespace-nowrap">
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
      <span className="text-[9px] font-mono text-white/60 w-9 text-right">
        {value}
        {suffix}
      </span>
    </label>
  );
}

/**
 * Thanh thuộc tính động theo công cụ (AC-T2.1…AC-T2.6).
 * Nằm ngang ngay dưới thanh trên cùng; mọi thay đổi cập nhật **preview nét**
 * ngay lập tức (AC-T2.2).
 */
export function ToolOptionsBar({
  tool,
  settings,
  onSettingsChange,
  color,
  disabled,
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
      // Nền xám rồi tẩy → thấy đúng bề rộng và độ mờ của tẩy
      ctx.fillStyle = "rgba(255,255,255,0.25)";
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
    const blur = (1 - settings.hardness / 100) * (settings.size / 2);
    if (blur > 0.2) ctx.filter = `blur(${blur.toFixed(2)}px)`;

    if (tool === "brush") {
      // Cọ: hai lớp mực lệch nhẹ theo `flow` → thấy rõ "chồng thì đậm"
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

  const showSize = tool !== "fill" && tool !== "select" && tool !== "pan";
  const showOpacity = tool !== "fill" && tool !== "select" && tool !== "pan";
  const showSmoothing = tool === "pen" || tool === "brush" || tool === "eraser";

  return (
    <div
      className={`h-12 bg-[#0d0817] border-b border-white/5 flex items-center gap-3 px-3 flex-shrink-0 overflow-x-auto scrollbar-none ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      {/* Preview nét mẫu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] uppercase tracking-wider text-white/30 font-semibold">
          Nét mẫu
        </span>
        <canvas
          ref={previewRef}
          style={{ width: PREVIEW_W, height: PREVIEW_H }}
          className="rounded-lg bg-white/5 border border-white/10"
        />
      </div>

      <div className="w-px h-7 bg-white/10 flex-shrink-0" />

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
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono transition-colors ${
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

      {/* flow + hardness chỉ có ở cọ (AC-T2.1) */}
      {tool === "brush" && (
        <>
          <Slider
            label="Mực"
            value={settings.flow}
            min={1}
            max={100}
            onChange={(v) => onSettingsChange({ flow: v })}
          />
          <Slider
            label="Cứng"
            value={settings.hardness}
            min={0}
            max={100}
            onChange={(v) => onSettingsChange({ hardness: v })}
          />
        </>
      )}

      {tool === "eraser" && (
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

      {!showSize && (
        <span className="text-[10px] text-white/35 flex-shrink-0">
          {tool === "fill"
            ? "Thùng sơn: đổ màu đang chọn vào vùng kín"
            : tool === "select"
              ? "Vùng chọn: kéo để chọn (làm ở bước 3C)"
              : "Kéo để di chuyển khung nhìn — cuộn để phóng to"}
        </span>
      )}
    </div>
  );
}
