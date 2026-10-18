import {
  AI_STROKE_GROUPS,
  type AiDrawingPrinciple,
  type AiStrokeGroup,
  type AiStrokePath,
} from "@/lib/ai-drawing-api";

/**
 * Hình học của một nét AI đã quy đổi sang **pixel của canvas đích**.
 *
 * Một nguồn sự thật duy nhất cho cả hai chỗ dùng nét AI: lớp phủ SVG (5C.3) và
 * bước rasterize "Áp dụng về lớp tôi" (5C.2). `path` trả về chuỗi `d` dùng được
 * cho cả `<path d>` của SVG và `new Path2D(d)` của Canvas2D.
 */
export type AiStrokeShape =
  | { kind: "path"; d: string; closed: boolean }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
    };

/** Bảng màu theo nguyên lý mỹ thuật — nét AI khác màu nhau để đọc được vai trò. */
export const AI_PRINCIPLE_COLORS: Record<AiDrawingPrinciple, string> = {
  composition: "#a855f7", // purple
  proportion: "#ec4899", // pink
  color: "#f59e0b", // amber
  flow: "#3b82f6", // blue
  perspective: "#10b981", // emerald
  lighting: "#f97316", // orange
  shadow: "#64748b", // slate
};

/** Nét AI mảnh nhất vẫn phải thấy được trên canvas cỡ nhỏ. */
export const MIN_AI_STROKE_PIXELS = 1;

/**
 * Mảng điểm normalized → đường cong mượt (Catmull-Rom → cubic Bézier) trong hệ
 * pixel của canvas đích.
 */
export function pointsToSmoothPath(
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

    // Catmull-Rom spline với tension = 0.5
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Quy đổi một nét AI sang hình học pixel. Trả `null` khi nét thiếu dữ liệu mà
 * `kind` yêu cầu (model trả hình dạng sai) — bỏ nét đó thay vì vẽ bừa.
 */
export function aiStrokeShape(
  stroke: AiStrokePath,
  w: number,
  h: number,
): AiStrokeShape | null {
  if (stroke.kind === "path") {
    if (!stroke.points || stroke.points.length === 0) return null;
    const d = pointsToSmoothPath(stroke.points, w, h);
    if (!d) return null;
    return { kind: "path", d, closed: stroke.closed === true };
  }

  if (stroke.kind === "line") {
    if (!stroke.from || !stroke.to) return null;
    return {
      kind: "line",
      x1: stroke.from.x * w,
      y1: stroke.from.y * h,
      x2: stroke.to.x * w,
      y2: stroke.to.y * h,
    };
  }

  if (stroke.kind === "ellipse") {
    if (!stroke.region) return null;
    const r = stroke.region;
    return {
      kind: "ellipse",
      cx: (r.x + r.width / 2) * w,
      cy: (r.y + r.height / 2) * h,
      rx: (r.width / 2) * w,
      ry: (r.height / 2) * h,
    };
  }

  if (!stroke.region) return null;
  const r = stroke.region;
  return {
    kind: "rect",
    x: r.x * w,
    y: r.y * h,
    width: r.width * w,
    height: r.height * h,
    radius: aiStrokePixelWidth(stroke, w, h) * 1.5,
  };
}

/** Màu nét theo nguyên lý mỹ thuật (màu dự phòng khi model trả giá trị lạ). */
export function aiStrokeColor(stroke: AiStrokePath): string {
  return AI_PRINCIPLE_COLORS[stroke.style] ?? "#38bdf8";
}

/**
 * Bề rộng nét tính theo **cạnh nhỏ** của canvas đích (nét normalized), tối thiểu
 * `MIN_AI_STROKE_PIXELS` px để không biến mất ở canvas nhỏ.
 */
export function aiStrokePixelWidth(
  stroke: AiStrokePath,
  w: number,
  h: number,
): number {
  return Math.max(MIN_AI_STROKE_PIXELS, stroke.strokeWidth * Math.min(w, h));
}

/**
 * Độ trong suốt cuối cùng của nét = `opacity` model trả (mức chi tiết) × độ mờ
 * của lớp AI (tab Layers) × độ mờ thanh trượt của overlay.
 *
 * Đã bỏ hệ số phóng đại cũ (×2.5 ×1.5) từ thời hợp đồng v1: từ Phase 5A `opacity`
 * đã nằm trong 0.15..0.9 nên nhân thêm sẽ làm mọi nét bão hoà ở 0.95 và mất phân
 * tầng độ đậm.
 */
export function aiStrokeAlpha(
  stroke: AiStrokePath,
  layerOpacity: number,
  sliderOpacity: number,
): number {
  const alpha = stroke.opacity * clamp01(layerOpacity) * clamp01(sliderOpacity);
  return clamp01(alpha);
}

/**
 * Sắp nét theo **thứ tự vẽ của nhóm nội dung** (nền trước, hiệu ứng sau) rồi theo
 * thứ tự gốc — nhờ vậy lớp trước không bị lớp sau vẽ đè lộn xộn.
 */
export function orderStrokesByGroup(
  strokes: readonly AiStrokePath[],
): AiStrokePath[] {
  const rank = new Map<string, number>();
  AI_STROKE_GROUPS.forEach((group, index) => rank.set(group, index));
  return [...strokes]
    .map((stroke, index) => ({ stroke, index }))
    .sort((a, b) => {
      const ra = rank.get(a.stroke.group) ?? AI_STROKE_GROUPS.length;
      const rb = rank.get(b.stroke.group) ?? AI_STROKE_GROUPS.length;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    })
    .map((item) => item.stroke);
}

/** Nhãn nhóm nội dung bằng tiếng Việt cho UI (chip, lớp AI). */
export const AI_STROKE_GROUP_LABELS: Record<AiStrokeGroup, string> = {
  background: "Hậu cảnh",
  midground: "Trung cảnh",
  subject: "Chủ thể",
  detail: "Chi tiết",
  effects: "Hiệu ứng",
  guide: "Đường dóng",
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
