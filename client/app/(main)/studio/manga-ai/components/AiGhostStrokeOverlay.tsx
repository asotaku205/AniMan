"use client";

import React, { useMemo } from "react";
import { ArrowDownToLine, ArrowUpToLine, Layers, X } from "lucide-react";
import type { AiStrokeGroup, AiStrokePath } from "@/lib/ai-drawing-api";
import {
  aiStrokeAlpha,
  aiStrokeColor,
  aiStrokePixelWidth,
  aiStrokeShape,
  orderStrokesWithIndex,
  type AiStrokeShape,
} from "../lib/aiStrokeGeometry";

/** Một lớp AI đang hiện trên canvas (đã lọc theo visible + độ mờ ở tab Layers). */
export interface AiOverlayLayerView {
  id: string;
  group: AiStrokeGroup | null;
  name: string;
  /** Độ mờ của lớp AI (0..1) — lấy từ tab Layers (5C.6) */
  opacity: number;
  strokes: AiStrokePath[];
}

interface Props {
  layers: readonly AiOverlayLayerView[];
  canvasWidth: number;
  canvasHeight: number;
  /** Độ mờ thanh trượt chung của lớp phủ (0..100) */
  ghostOpacity: number;
  setGhostOpacity: (v: number) => void;
  /** Đè nét AI lên trên nét người dùng (mặc định: nằm dưới) */
  above: boolean;
  setAbove: (v: boolean) => void;
  /** Callback khi người dùng bấm "Xóa gợi ý" */
  onClear: () => void;
  onApplyToLayer?: () => void;
  canApplyToLayer?: boolean;
  /** Hiển thị thanh điều khiển */
  showControls?: boolean;
  /**
   * Chế độ chọn từng nét: bật thì SVG nhận click để chọn nét (mặc định tắt
   * để giữ bất biến "lớp phủ không chặn vẽ" — chỉ bật khi user chủ động bấm
   * "Chọn nét").
   */
  selectMode?: boolean;
  setSelectMode?: (v: boolean) => void;
  /** Key nét đang chọn: `${layerId}:${indexGốc}` */
  selectedStrokeKeys?: ReadonlySet<string>;
  onToggleStroke?: (layerId: string, strokeIndex: number) => void;
  /** Áp các nét đang chọn xuống lớp người dùng */
  onApplySelected?: () => void;
}

/** Vẽ nét lên SVG: viền trắng mảnh phía dưới để nét đọc được trên mọi hình. */
function renderShape(
  shape: AiStrokeShape,
  style: {
    color: string;
    width: number;
    alpha: number;
    fill: string;
    dashArray?: string;
  },
  key: string,
  opts?: { selected?: boolean; onClick?: () => void },
): React.ReactNode {
  const outline = {
    stroke: opts?.selected ? "#fde047" : "#ffffff",
    strokeWidth: style.width + (opts?.selected ? 4 : 2),
    fill: "none",
    opacity: Math.min(1, style.alpha + 0.25),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paint = {
    stroke: style.color,
    strokeWidth: style.width,
    fill: style.fill,
    opacity: style.alpha,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: style.dashArray,
  };

  const element = (props: Record<string, unknown>, isOutline: boolean) => {
    const merged = isOutline ? outline : paint;
    if (shape.kind === "path") {
      return (
        <path
          key={`${key}${isOutline ? "-o" : ""}`}
          d={shape.d}
          {...merged}
          {...props}
        />
      );
    }
    if (shape.kind === "line") {
      return (
        <line
          key={`${key}${isOutline ? "-o" : ""}`}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          {...merged}
          {...props}
        />
      );
    }
    if (shape.kind === "ellipse") {
      return (
        <ellipse
          key={`${key}${isOutline ? "-o" : ""}`}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          {...merged}
          {...props}
        />
      );
    }
    return (
      <rect
        key={`${key}${isOutline ? "-o" : ""}`}
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        rx={shape.radius}
        {...merged}
        {...props}
      />
    );
  };

  return (
    <g
      key={key}
      onClick={opts?.onClick}
      style={opts?.onClick ? { cursor: "pointer" } : undefined}
    >
      {element({}, true)}
      {element({}, false)}
    </g>
  );
}

/**
 * Lớp phủ SVG hiển thị nét AI của khung đang mở.
 *
 * - Nằm **dưới** nét người dùng theo mặc định (bất biến AI-DRAWING-OPERATIONS §1.2),
 *   có công tắc đè lên trên khi người dùng muốn đối chiếu.
 * - `pointer-events: none` → không chặn thao tác vẽ (nét AI không phải vùng bấm).
 * - Không bao giờ ghi vào canvas người dùng; muốn ghi phải bấm "Áp dụng về lớp tôi".
 * - Vẽ theo thứ tự nhóm nội dung: nền trước, hiệu ứng sau (5C.3).
 */
export function AiGhostStrokeOverlay({
  layers,
  canvasWidth,
  canvasHeight,
  ghostOpacity,
  setGhostOpacity,
  above,
  setAbove,
  onClear,
  onApplyToLayer,
  canApplyToLayer = true,
  showControls = true,
  selectMode = false,
  setSelectMode,
  selectedStrokeKeys,
  onToggleStroke,
  onApplySelected,
}: Props) {
  const w = canvasWidth > 0 ? canvasWidth : 400;
  const h = canvasHeight > 0 ? canvasHeight : 300;
  const slider = ghostOpacity / 100;

  const rendered = useMemo(
    () =>
      layers.map((layer) => ({
        id: layer.id,
        shapes: orderStrokesWithIndex(layer.strokes)
          .map(({ stroke, index }) => {
            const shape = aiStrokeShape(stroke, w, h);
            if (!shape) return null;
            const width = aiStrokePixelWidth(stroke, w, h);
            return {
              key: `${layer.id}-${index}`,
              layerId: layer.id,
              strokeIndex: index,
              shape,
              color: aiStrokeColor(stroke),
              width,
              alpha: aiStrokeAlpha(stroke, layer.opacity, slider),
              fill: stroke.fill && stroke.fill !== "none" ? stroke.fill : "none",
              dashArray: stroke.dashed
                ? `${width * 4},${width * 2}`
                : undefined,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null),
      })),
    [layers, w, h, slider],
  );

  const totalStrokes = rendered.reduce(
    (total, layer) => total + layer.shapes.length,
    0,
  );
  const selectedCount = selectedStrokeKeys?.size ?? 0;
  if (totalStrokes === 0) return null;

  return (
    <>
      <svg
        className="absolute inset-0 w-full h-full"
        style={{
          zIndex: above ? 35 : 25,
          // Mặc định không nhận sự kiện để không chặn vẽ; chỉ chế độ chọn nét
          // mới bật pointer-events để bấm chọn từng nét.
          pointerEvents: selectMode ? "auto" : "none",
        }}
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
      >
        {rendered.map((layer) =>
          layer.shapes.map((item) => {
            const selected = selectedStrokeKeys?.has(item.key) ?? false;
            return renderShape(
              item.shape,
              {
                color: item.color,
                width: item.width,
                alpha: item.alpha,
                fill: item.fill,
                dashArray: item.dashArray,
              },
              item.key,
              {
                selected,
                onClick:
                  selectMode && onToggleStroke
                    ? () => onToggleStroke(item.layerId, item.strokeIndex)
                    : undefined,
              },
            );
          }),
        )}
      </svg>

      {showControls && (
        <div
          className="absolute bottom-2 right-2 z-40 max-w-[calc(100%-1rem)] bg-[#0d0817]/90 border border-purple-500/30 rounded-xl px-2.5 py-1.5 flex items-center gap-2"
          style={{ pointerEvents: "auto" }}
        >
          <span
            className="text-purple-300 text-[10px] flex-shrink-0 flex items-center gap-1"
            title={`Nét AI: ${totalStrokes} nét trong ${rendered.length} lớp AI`}
          >
            <Layers size={11} />
            AI: {totalStrokes} nét
          </span>
          <input
            type="range"
            min={8}
            max={80}
            value={ghostOpacity}
            onChange={(e) => setGhostOpacity(+e.target.value)}
            className="w-16 h-1 accent-purple-500 flex-shrink-0"
            title="Độ mờ nét AI trên canvas (không ảnh hưởng nét của bạn)"
          />
          <span className="text-purple-400 text-[9px] w-6 flex-shrink-0">{ghostOpacity}%</span>
          <button
            onClick={() => setAbove(!above)}
            className="text-white/50 hover:text-white transition-colors"
            title={
              above
                ? "Nét AI đang đè lên nét của bạn — bấm để đưa xuống dưới"
                : "Đưa nét AI lên trên nét của bạn"
            }
            aria-label="Đổi thứ tự nét AI"
          >
            {above ? <ArrowUpToLine size={12} /> : <ArrowDownToLine size={12} />}
          </button>
          {onApplyToLayer && (
            <button
              onClick={onApplyToLayer}
              disabled={!canApplyToLayer}
              className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[9px] font-semibold flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Vẽ nét AI vào lớp đang chọn bằng một bước hoàn tác"
            >
              Áp về lớp tôi
            </button>
          )}
          {setSelectMode && (
            <button
              onClick={() => setSelectMode(!selectMode)}
              className={`px-1.5 py-0.5 rounded-md border text-[9px] font-semibold flex-shrink-0 ${
                selectMode
                  ? "bg-yellow-500/25 border-yellow-400/50 text-yellow-200"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
              title={
                selectMode
                  ? "Đang chọn nét — bấm vào nét để chọn/bỏ chọn, bấm lại để tắt"
                  : "Bật để bấm chọn từng nét AI rồi chỉ áp các nét đã chọn"
              }
            >
              Chọn nét
            </button>
          )}
          {selectMode && selectedCount > 0 && onApplySelected && (
            <button
              onClick={onApplySelected}
              disabled={!canApplyToLayer}
              className="px-1.5 py-0.5 rounded-md bg-yellow-500/25 border border-yellow-400/50 text-yellow-100 text-[9px] font-semibold flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Chỉ vẽ các nét đang chọn (viền vàng) vào lớp đang chọn"
            >
              Áp {selectedCount} nét đã chọn
            </button>
          )}
          <button
            onClick={onClear}
            className="text-white/40 hover:text-white transition-colors"
            title="Xoá nét AI (không đụng nét của bạn)"
            aria-label="Xoá nét AI"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
}
