"use client";

import React from "react";
import { X } from "lucide-react";
import type { AiStrokePath, AiDrawingPrinciple } from "@/lib/ai-drawing-api";

// Bảng màu theo principle mỹ thuật
const PRINCIPLE_COLORS: Record<AiDrawingPrinciple, string> = {
  composition: "#a855f7", // purple
  proportion: "#ec4899",  // pink
  color: "#f59e0b",       // amber
  flow: "#3b82f6",        // blue
  perspective: "#10b981", // emerald
  lighting: "#f97316",    // orange
  shadow: "#64748b",      // slate
};

interface Props {
  strokes: AiStrokePath[];
  canvasWidth: number;
  canvasHeight: number;
  /** Độ mờ toàn cục nhân với opacity từng stroke (0..1) */
  globalOpacity?: number;
  /** Callback khi người dùng bấm "Xóa gợi ý" */
  onClear: () => void;
  /** Hiển thị nút điều chỉnh opacity / xóa */
  showControls?: boolean;
  ghostOpacity: number;
  setGhostOpacity: (v: number) => void;
}

/**
 * Chuyển mảng điểm {x,y} sang đường cong mượt Bézier (Catmull-Rom to Cubic Bezier)
 * giúp nét AI mềm mại như nét vẽ manga chuyên nghiệp thay vì các đoạn thẳng gãy khúc.
 */
function pointsToSmoothSvgPath(
  points: readonly { readonly x: number; readonly y: number }[],
  w: number,
  h: number,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x * w} ${points[0].y * h}`;
  if (points.length === 2) {
    return `M ${points[0].x * w} ${points[0].y * h} L ${points[1].x * w} ${points[1].y * h}`;
  }

  const pts = points.map((p) => ({ x: p.x * w, y: p.y * h }));
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

    // Catmull-Rom spline control points với tension = 0.5
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

function renderStroke(stroke: AiStrokePath, idx: number, w: number, h: number, globalAlpha: number): React.ReactNode {
  const baseColor = PRINCIPLE_COLORS[stroke.style] ?? "#38bdf8";
  // Tăng độ tương phản thị giác: AI gợi ý có opacity rõ nét hơn kèm hệ số alpha
  const effectiveAlpha = Math.min(0.95, Math.max(0.2, (stroke.opacity * 2.5) * (globalAlpha * 1.5)));
  // strokeWidth normalized → pixel: dùng chiều nhỏ hơn làm reference, tối thiểu 1.5px
  const pixelWidth = Math.max(1.5, stroke.strokeWidth * Math.min(w, h) * 1.4);
  const dashArray = stroke.dashed ? `${pixelWidth * 4},${pixelWidth * 2}` : undefined;

  const commonProps = {
    stroke: baseColor,
    strokeWidth: pixelWidth,
    fill: "none",
    opacity: effectiveAlpha,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: dashArray,
    style: { filter: "drop-shadow(0 0 1.5px rgba(56,189,248,0.4))" },
  };

  if (stroke.kind === "path" && stroke.points && stroke.points.length > 0) {
    const d = pointsToSmoothSvgPath(stroke.points, w, h);
    return <path key={idx} d={d} {...commonProps} />;
  }

  if (stroke.kind === "line" && stroke.from && stroke.to) {
    return (
      <line
        key={idx}
        x1={stroke.from.x * w}
        y1={stroke.from.y * h}
        x2={stroke.to.x * w}
        y2={stroke.to.y * h}
        {...commonProps}
      />
    );
  }

  if (stroke.kind === "ellipse" && stroke.region) {
    const r = stroke.region;
    const cx = (r.x + r.width / 2) * w;
    const cy = (r.y + r.height / 2) * h;
    const rx = (r.width / 2) * w;
    const ry = (r.height / 2) * h;
    return (
      <ellipse key={idx} cx={cx} cy={cy} rx={rx} ry={ry} {...commonProps} />
    );
  }

  if (stroke.kind === "rectangle" && stroke.region) {
    const r = stroke.region;
    return (
      <rect
        key={idx}
        x={r.x * w}
        y={r.y * h}
        width={r.width * w}
        height={r.height * h}
        rx={pixelWidth * 1.5}
        {...commonProps}
      />
    );
  }

  return null;
}

/**
 * Lớp phủ SVG mờ hiển thị ghost strokes do AI sinh ra.
 * - pointer-events: none → không chặn thao tác vẽ
 * - không ghi vào canvas pixel của người dùng
 * - người dùng có thể xóa bất kỳ lúc nào
 */
export function AiGhostStrokeOverlay({
  strokes,
  canvasWidth,
  canvasHeight,
  globalOpacity = 1,
  onClear,
  showControls = true,
  ghostOpacity,
  setGhostOpacity,
}: Props) {
  if (strokes.length === 0) return null;

  const w = canvasWidth > 0 ? canvasWidth : 400;
  const h = canvasHeight > 0 ? canvasHeight : 300;
  const alpha = globalOpacity * (ghostOpacity / 100);

  return (
    <>
      {/* SVG ghost strokes — pointer-events: none */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 25 }}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {strokes.map((stroke, idx) => renderStroke(stroke, idx, w, h, alpha))}
      </svg>

      {/* Control bar */}
      {showControls && (
        <div
          className="absolute bottom-2 left-2 right-2 z-40 bg-[#0d0817]/90 border border-purple-500/30 rounded-xl px-3 py-2 flex items-center gap-2"
        >
          <span className="text-purple-300 text-[10px] flex-shrink-0">
            Nét AI gợi ý
          </span>
          <input
            type="range"
            min={8}
            max={80}
            value={ghostOpacity}
            onChange={(e) => setGhostOpacity(+e.target.value)}
            className="flex-1 h-1 accent-purple-500"
          />
          <span className="text-purple-400 text-[9px] w-6">{ghostOpacity}%</span>
          <button
            onClick={onClear}
            className="text-white/40 hover:text-white transition-colors"
            title="Xóa nét AI gợi ý"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </>
  );
}
