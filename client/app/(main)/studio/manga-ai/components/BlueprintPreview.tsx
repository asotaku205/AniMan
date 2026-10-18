"use client";

import React from "react";
import { Check, Layers, Sparkles, X } from "lucide-react";
import type { AiSceneBlueprintResponse } from "@/lib/ai-drawing-api";
import { AI_STROKE_GROUP_LABELS } from "../lib/aiStrokeGeometry";

interface Props {
  blueprint: AiSceneBlueprintResponse;
  /** Blueprint đã được áp vào các lớp AI của khung chưa */
  applied: boolean;
  onApply: () => void;
  onDismiss: () => void;
  /** Dòng nguồn AI (AC-D2.2) do AiTab truyền xuống để tránh import vòng */
  footer?: React.ReactNode;
}

/**
 * Xem trước **bức tranh toàn cảnh** (A-2, 5B.5): bố cục + ánh sáng + góc máy bằng
 * lời, kèm danh sách lớp nội dung và số nét mỗi lớp.
 *
 * Đây là blueprint (vector + mô tả), không phải ảnh render sẵn — quyết định C3.
 * Nét chỉ vào khung khi người dùng bấm "Áp vào lớp AI" (5B.6).
 */
export function BlueprintPreview({
  blueprint,
  applied,
  onApply,
  onDismiss,
  footer,
}: Props) {
  const totalStrokes = blueprint.strokes.length;

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/30 border border-indigo-400/30 rounded-2xl p-3 space-y-2.5 shadow-lg shadow-indigo-900/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-indigo-200 text-xs font-semibold flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-300" />
            Toàn cảnh: {blueprint.blueprint.title}
          </span>
          <p className="text-white/40 text-[9px] mt-0.5">
            Blueprint gợi ý — {blueprint.layers.length} lớp · {totalStrokes} nét
            vector, không phải ảnh hoàn chỉnh
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/40 hover:text-white transition-colors flex-shrink-0"
          title="Bỏ kết quả toàn cảnh này"
          aria-label="Bỏ kết quả toàn cảnh"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-1.5 text-[10px] leading-relaxed">
        {(
          [
            ["Bố cục", blueprint.blueprint.composition],
            ["Ánh sáng", blueprint.blueprint.lighting],
            ["Góc máy", blueprint.blueprint.camera],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="bg-black/25 border border-white/5 rounded-xl p-2"
          >
            <span className="text-indigo-300/80 font-semibold">{label}: </span>
            <span className="text-white/70">{value}</span>
          </div>
        ))}
      </div>

      {blueprint.summary && (
        <p className="text-indigo-100/80 text-[10px] leading-relaxed italic bg-black/30 p-2.5 rounded-xl border border-white/5">
          &ldquo;{blueprint.summary}&rdquo;
        </p>
      )}

      <div className="space-y-1">
        <span className="text-white/40 text-[9px] uppercase tracking-wider font-semibold flex items-center gap-1">
          <Layers size={10} className="text-indigo-300" />
          Lớp nội dung (thứ tự vẽ)
        </span>
        {blueprint.layers.map((layer) => (
          <div
            key={layer.group}
            className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-2 py-1.5"
          >
            <span className="text-[9px] font-mono text-indigo-300/90 w-[62px] flex-shrink-0 pt-px">
              {AI_STROKE_GROUP_LABELS[layer.group] ?? layer.group}
            </span>
            <span className="text-white/75 text-[10px] min-w-0">
              <span className="font-semibold">{layer.name}</span>
              <span className="text-white/40"> · {layer.strokes.length} nét</span>
              <span className="block text-white/45 text-[9px] mt-0.5">
                {layer.description}
              </span>
            </span>
          </div>
        ))}
      </div>

      {footer}

      <div className="flex items-center gap-1.5 pt-0.5">
        <button
          onClick={onApply}
          disabled={applied}
          className="flex-1 py-1.5 px-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-100 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          title="Lưu từng lớp nội dung thành một lớp AI (nét của bạn vẫn nằm trên)"
        >
          {applied ? <Check size={11} /> : <Layers size={11} />}
          {applied ? "Đã áp vào lớp AI" : "Áp vào lớp AI"}
        </button>
        <button
          onClick={onDismiss}
          className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-[10px] transition-colors"
        >
          Bỏ
        </button>
      </div>
    </div>
  );
}
