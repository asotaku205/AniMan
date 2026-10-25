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
 * Dung sai rút gọn điểm (Douglas–Peucker) tính bằng **pixel của canvas đích**.
 *
 * Model trả điểm theo lưới tọa độ thô nên một nét "cong" thường là chuỗi đoạn
 * thẳng ngắn răng cưa; fit Bézier trực tiếp lên chuỗi đó giữ lại răng cưa ở
 * dạng sóng nhỏ. Rút gọn trước với dung sai 1.5px chỉ loại điểm lệch khỏi
 * đường nối dưới 1.5px — nhỏ hơn bề rộng nét tối thiểu nhìn thấy được — nên
 * hình dáng nét không đổi, chỉ mất nhiễu (Slice 2, hoàn thiện vẽ 22/10/2026).
 */
export const AI_GUIDE_SIMPLIFY_TOLERANCE_PX = 1.5;

type NormPoint = { readonly x: number; readonly y: number };

/** Khoảng cách vuông góc từ điểm tới đoạn thẳng, đo trong hệ pixel đích. */
function perpendicularDistancePx(
  p: NormPoint,
  a: NormPoint,
  b: NormPoint,
  w: number,
  h: number,
): number {
  const px = p.x * w;
  const py = p.y * h;
  const ax = a.x * w;
  const ay = a.y * h;
  const bx = b.x * w;
  const by = b.y * h;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const cross = (px - ax) * dy - (py - ay) * dx;
  return Math.abs(cross) / Math.sqrt(lenSq);
}

/**
 * Rút gọn chuỗi điểm bằng Douglas–Peucker: giữ điểm đầu/cuối và mọi điểm lệch
 * khỏi đường nối quá `tolerancePx` (pixel đích). Trả về **tập con của điểm
 * gốc** (không nội suy điểm mới) nên nét giữ đúng vị trí model đã đặt.
 * Chuỗi dưới 3 điểm trả nguyên.
 */
export function simplifyStrokePoints(
  points: readonly NormPoint[],
  w: number,
  h: number,
  tolerancePx: number = AI_GUIDE_SIMPLIFY_TOLERANCE_PX,
): NormPoint[] {
  if (points.length < 3) return [...points];
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let farthestDist = tolerancePx;
    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistancePx(points[i], points[start], points[end], w, h);
      if (dist > farthestDist) {
        farthestDist = dist;
        farthest = i;
      }
    }
    if (farthest >= 0) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

/**
 * Mảng điểm normalized → đường cong mượt (Catmull-Rom → cubic Bézier) trong hệ
 * pixel của canvas đích. Chuỗi từ 3 điểm trở lên được rút gọn nhiễu trước khi
 * fit (xem `simplifyStrokePoints`).
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

  const simplified = simplifyStrokePoints(points, w, h);
  const pts = simplified.map((p) => ({ x: p.x * w, y: p.y * h }));
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
 * Bản giữ chỉ số gốc để overlay chọn từng nét: key chọn nét là chỉ số gốc
 * trong mảng strokes của lớp, không phải vị trí sau khi sắp.
 */
export function orderStrokesWithIndex(
  strokes: readonly AiStrokePath[],
): Array<{ stroke: AiStrokePath; index: number }> {
  const rank = new Map<string, number>();
  AI_STROKE_GROUPS.forEach((group, index) => rank.set(group, index));
  return [...strokes]
    .map((stroke, index) => ({ stroke, index }))
    .sort((a, b) => {
      const ra = rank.get(a.stroke.group) ?? AI_STROKE_GROUPS.length;
      const rb = rank.get(b.stroke.group) ?? AI_STROKE_GROUPS.length;
      if (ra !== rb) return ra - rb;
      return a.index - b.index;
    });
}

export function orderStrokesByGroup(
  strokes: readonly AiStrokePath[],
): AiStrokePath[] {
  return orderStrokesWithIndex(strokes).map((item) => item.stroke);
}

/**
 * Nét AI có vẽ được không — phòng thủ cuối phía client trước khi phủ/xuống lớp.
 * Server đã lọc, nhưng model vẫn có thể lọt nét thiếu hình học, tọa độ NaN
 * (chuỗi path "NaN" vẽ ra rác) hoặc kind lạ. Nét không đạt thì bỏ, không vẽ bừa.
 */
function isFinitePoint(point: unknown): boolean {
  if (typeof point !== "object" || point === null) return false;
  const p = point as Record<string, unknown>;
  return (
    typeof p.x === "number" &&
    Number.isFinite(p.x) &&
    typeof p.y === "number" &&
    Number.isFinite(p.y)
  );
}

function isFiniteRegion(region: unknown): boolean {
  if (typeof region !== "object" || region === null) return false;
  const r = region as Record<string, unknown>;
  return (
    typeof r.x === "number" &&
    Number.isFinite(r.x) &&
    typeof r.y === "number" &&
    Number.isFinite(r.y) &&
    typeof r.width === "number" &&
    Number.isFinite(r.width) &&
    (r.width as number) > 0 &&
    typeof r.height === "number" &&
    Number.isFinite(r.height) &&
    (r.height as number) > 0
  );
}

export function isDrawableAiStroke(stroke: AiStrokePath): boolean {
  if (
    typeof stroke.strokeWidth !== "number" ||
    !Number.isFinite(stroke.strokeWidth)
  ) {
    return false;
  }
  switch (stroke.kind) {
    case "path":
      return (
        !!stroke.points &&
        stroke.points.length > 0 &&
        stroke.points.every(isFinitePoint)
      );
    case "line":
      return isFinitePoint(stroke.from) && isFinitePoint(stroke.to);
    case "ellipse":
    case "rectangle":
      return isFiniteRegion(stroke.region);
    default:
      return false;
  }
}

/** Lọc mảng nét AI, chỉ giữ nét vẽ được (giữ nguyên thứ tự gốc). */
export function sanitizeAiStrokes(
  strokes: readonly AiStrokePath[],
): AiStrokePath[] {
  return strokes.filter(isDrawableAiStroke);
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
