/**
 * drawTools, công cụ vẽ port từ Manga Studio sang hộp thoại vẽ của
 * Animation Studio.
 *
 * Manga có 15 công cụ (bút, cọ, phun, tẩy, đổ màu, chuyển sắc, lấy màu,
 * hình, đường, cong, chọn, hiệu ứng, đối xứng, chữ, di chuyển). Các lib
 * toán/vẽ của manga đều thuần (không React, không state trang) nên được
 * import trực tiếp: shape, bubbleShapes, textItems, floodFill, gradient,
 * curve, symmetry, effects, stroke, selection, toolSettings.
 *
 * Riêng component vẽ của manga (DrawStudio, CanvasArea, useDrawStudio) gắn
 * chặt state khung/layer/AI của manga nên KHÔNG dùng chung được; hộp thoại
 * animation tự quản lý tương tác theo model op dưới đây (copy-adapt).
 *
 * Model: mỗi thao tác là một op dữ liệu thuần (toạ độ tương đối 0..1, trừ
 * bán kính hiệu ứng tính bằng px), vẽ lại được toàn bộ từ đầu nên hoàn
 * tác/làm lại là phát lại danh sách op. Đầu ra không đổi: canvas PNG nền
 * trong suốt qua onSave như cũ. Pan (di chuyển khung nhìn) không port vì
 * canvas của modal cố định và hiện toàn bộ, không có viewport để di chuyển.
 */

import {
  buildShapePath,
  clampSides,
  kindLetsFill,
  shapeLabel,
  snapToAngle,
  type ShapeKind,
} from "../../manga-ai/lib/shape";
import {
  drawBubbleShapes,
  type BubbleShape,
  type BubbleShapeKind,
} from "../../manga-ai/lib/bubbleShapes";
import {
  drawTextItems,
  type TextStyle,
} from "../../manga-ai/lib/textItems";
import {
  floodFillPixels,
  FLOOD_TOLERANCE,
} from "../../manga-ai/lib/floodFill";
import {
  buildGradient,
  parseHexColor,
  type GradientEnd,
  type GradientShape,
} from "../../manga-ai/lib/gradient";
import { curveControlPoints, clampBow } from "../../manga-ai/lib/curve";
import {
  drawWithSymmetry,
  symmetryTransforms,
  type SymmetryMode,
} from "../../manga-ai/lib/symmetry";
import {
  boxBlurRGBA,
  sharpenRGBA,
  blurRadiusForSize,
  sharpenAmountForStrength,
} from "../../manga-ai/lib/effects";
import {
  airbrushDabRadius,
  airbrushDabsPerTick,
  dabAlpha,
  hardnessBlurRadius,
  smoothStroke,
  sprayDabs,
} from "../../manga-ai/lib/stroke";
import {
  clampPercent,
  clampSize,
  defaultSettingsFor,
  type EffectMode,
} from "../../manga-ai/lib/toolSettings";
import {
  lassoSelection,
  rectSelection,
  translateSelection,
  type Selection,
} from "../../manga-ai/lib/selection";
import type { DrawPoint } from "./drawStrokes";

export type { DrawPoint };

/** 15 công cụ manga trừ "di chuyển khung nhìn", cộng "bóng thoại". */
export type AnimDrawTool =
  | "pen"
  | "brush"
  | "airbrush"
  | "eraser"
  | "fill"
  | "gradient"
  | "eyedropper"
  | "shape"
  | "line"
  | "curve"
  | "select"
  | "effect"
  | "symmetry"
  | "text"
  | "bubble";

export const ANIM_TOOL_LABELS: Record<AnimDrawTool, string> = {
  pen: "Bút vẽ",
  brush: "Cọ",
  airbrush: "Cọ phun (airbrush)",
  eraser: "Tẩy",
  fill: "Đổ màu",
  gradient: "Chuyển sắc",
  eyedropper: "Bút lấy màu",
  shape: "Hình",
  line: "Đường / Mũi tên",
  curve: "Đường cong",
  select: "Chọn",
  effect: "Mờ / Sắc nét",
  symmetry: "Đối xứng",
  text: "Chữ",
  bubble: "Bóng thoại",
};

export const ANIM_TOOL_GROUPS: Array<{
  label: string;
  tools: AnimDrawTool[];
}> = [
  { label: "Vẽ", tools: ["pen", "brush", "airbrush", "eraser", "symmetry"] },
  { label: "Tô", tools: ["fill", "gradient", "eyedropper"] },
  { label: "Hình", tools: ["shape", "line", "curve"] },
  { label: "Vùng", tools: ["select", "effect"] },
  { label: "Khác", tools: ["text", "bubble"] },
];

/** Phím tắt theo đúng manga (thêm B cho bóng thoại, manga không có). */
export const ANIM_TOOL_SHORTCUTS: Record<AnimDrawTool, string> = {
  pen: "1",
  brush: "2",
  eraser: "3",
  fill: "4",
  select: "5",
  shape: "6",
  text: "7",
  eyedropper: "9",
  line: "L",
  gradient: "G",
  airbrush: "A",
  symmetry: "Y",
  curve: "C",
  effect: "U",
  bubble: "B",
};

export const ANIM_SHORTCUT_TO_TOOL: Record<string, AnimDrawTool> =
  Object.fromEntries(
    (Object.entries(ANIM_TOOL_SHORTCUTS) as [AnimDrawTool, string][]).map(
      ([tool, key]) => [key.toLowerCase(), tool],
    ),
  );

/** Công cụ vẽ nét tự do (đối xứng áp được cho các công cụ này). */
export const FREEHAND_TOOLS: readonly AnimDrawTool[] = [
  "pen",
  "brush",
  "airbrush",
  "eraser",
  "symmetry",
];

/** Công cụ vẽ bằng cú kéo có xem trước trên lớp phủ. */
export const DRAG_TOOLS: readonly AnimDrawTool[] = [
  "shape",
  "line",
  "curve",
  "gradient",
  "bubble",
];

// ------------------------------------------------------------ Op ------------------------------------------------------------

export interface FreeOp {
  kind: "free";
  tool: "pen" | "brush" | "eraser";
  color: string;
  widthPx: number;
  opacity: number;
  flow: number;
  hardness: number;
  symmetry: SymmetryMode;
  points: DrawPoint[];
}

export interface AirbrushOp {
  kind: "airbrush";
  color: string;
  dabRadius: number;
  opacity: number;
  stamps: DrawPoint[];
}

export interface ShapeOp {
  kind: "shape";
  shape: ShapeKind;
  from: DrawPoint;
  to: DrawPoint;
  sides: number;
  fill: boolean;
  color: string;
  widthPx: number;
  opacity: number;
}

export interface CurveOp {
  kind: "curve";
  from: DrawPoint;
  to: DrawPoint;
  bow: number;
  color: string;
  widthPx: number;
  opacity: number;
}

export interface GradientOp {
  kind: "gradient";
  shape: GradientShape;
  from: DrawPoint;
  to: DrawPoint;
  color: string;
  end: GradientEnd;
  opacity: number;
}

export interface FillOp {
  kind: "fill";
  at: DrawPoint;
  color: string;
  opacity: number;
  tolerance: number;
}

export interface EffectOp {
  kind: "effect";
  mode: EffectMode;
  strength: number;
  center: DrawPoint;
  /** Bán kính vùng tác động, px tuyệt đối (canvas modal cố định kích thước). */
  radiusPx: number;
}

export interface TextOp {
  kind: "text";
  text: string;
  x: number;
  y: number;
  w: number;
  fontScale: number;
  style: TextStyle;
}

export interface BubbleOp {
  kind: "bubble";
  shape: BubbleShape;
}

export interface MoveOp {
  kind: "move";
  /** Hộp vùng nguồn, tương đối 0..1. */
  from: { x: number; y: number; w: number; h: number };
  /** Độ dời, tương đối 0..1. */
  dx: number;
  dy: number;
}

export interface EraseOp {
  kind: "erase";
  /** Đa giác vùng xoá, tương đối 0..1 (ít nhất 3 điểm). */
  points: DrawPoint[];
}

export type DrawOp =
  | FreeOp
  | AirbrushOp
  | ShapeOp
  | CurveOp
  | GradientOp
  | FillOp
  | EffectOp
  | TextOp
  | BubbleOp
  | MoveOp
  | EraseOp;

export interface DrawOpHistory {
  ops: DrawOp[];
  undone: DrawOp[];
}

export function createDrawOpHistory(): DrawOpHistory {
  return { ops: [], undone: [] };
}

/** Op suy biến (không vẽ gì) thì bỏ qua để khỏi tạo bước hoàn tác rỗng. */
export function isEmptyDrawOp(op: DrawOp): boolean {
  switch (op.kind) {
    case "free":
      return op.points.length === 0;
    case "airbrush":
      return op.stamps.length === 0;
    case "shape":
    case "curve":
    case "gradient":
      return op.from.x === op.to.x && op.from.y === op.to.y;
    case "text":
      return op.text.trim().length === 0;
    case "move":
      return op.dx === 0 && op.dy === 0;
    case "erase":
      return op.points.length < 3;
    default:
      return false;
  }
}

/** Thêm op mới ,  làm lại bị xoá như mọi trình vẽ chuẩn. */
export function pushDrawOp(h: DrawOpHistory, op: DrawOp): DrawOpHistory {
  if (isEmptyDrawOp(op)) return h;
  return { ops: [...h.ops, op], undone: [] };
}

export function undoDrawOp(h: DrawOpHistory): DrawOpHistory {
  const last = h.ops[h.ops.length - 1];
  if (!last) return h;
  return { ops: h.ops.slice(0, -1), undone: [...h.undone, last] };
}

export function redoDrawOp(h: DrawOpHistory): DrawOpHistory {
  const next = h.undone[h.undone.length - 1];
  if (!next) return h;
  return { ops: [...h.ops, next], undone: h.undone.slice(0, -1) };
}

// ------------------------------------------------------------ Commit helpers (thuần, test được) ------------------------------------------------------------

/** Làm mượt nét tự do rồi đóng gói thành op (điểm rỗng -> null). */
export function commitFreeOp(
  tool: FreeOp["tool"],
  color: string,
  widthPx: number,
  opacity: number,
  flow: number,
  hardness: number,
  symmetry: SymmetryMode,
  rawPoints: readonly DrawPoint[],
  smoothing: number,
): FreeOp | null {
  const points = smoothStroke(rawPoints, smoothing);
  if (points.length === 0) return null;
  return {
    kind: "free",
    tool,
    color,
    widthPx,
    opacity: clampPercent(opacity),
    flow: clampPercent(flow),
    hardness: clampPercent(hardness),
    symmetry,
    points,
  };
}

/**
 * Đóng gói các dấu phun đã sinh trong lúc kéo (dùng rng tiêm được để test
 * tất định). Dấu phun sinh một lần lúc commit nên phát lại luôn giống nhau.
 * Offset phun tính theo px nên phải đổi sang tương đối 0..1 bằng kích thước
 * khung, nếu không phát lại sẽ vẽ lệch khỏi khung.
 */
export function commitAirbrushOp(
  color: string,
  size: number,
  flow: number,
  opacity: number,
  pathPoints: readonly DrawPoint[],
  canvasWidth: number,
  canvasHeight: number,
  rng: () => number = Math.random,
): AirbrushOp | null {
  const stamps: DrawPoint[] = [];
  const perTick = airbrushDabsPerTick(flow);
  for (const p of pathPoints) {
    for (const d of sprayDabs(perTick, Math.max(0, size / 2), rng)) {
      stamps.push({
        x: p.x + d.x / canvasWidth,
        y: p.y + d.y / canvasHeight,
      });
    }
  }
  if (stamps.length === 0) return null;
  return {
    kind: "airbrush",
    color,
    dabRadius: airbrushDabRadius(size),
    opacity: clampPercent(opacity),
    stamps,
  };
}

export function commitShapeOp(
  shape: ShapeKind,
  from: DrawPoint,
  to: DrawPoint,
  sides: number,
  fill: boolean,
  color: string,
  widthPx: number,
  opacity: number,
): ShapeOp | null {
  const op: ShapeOp = {
    kind: "shape",
    shape,
    from,
    to,
    sides: clampSides(sides),
    fill: fill && kindLetsFill(shape),
    color,
    widthPx,
    opacity: clampPercent(opacity),
  };
  return isEmptyDrawOp(op) ? null : op;
}

export function commitCurveOp(
  from: DrawPoint,
  to: DrawPoint,
  bow: number,
  color: string,
  widthPx: number,
  opacity: number,
): CurveOp | null {
  const op: CurveOp = {
    kind: "curve",
    from,
    to,
    bow: clampBow(bow),
    color,
    widthPx,
    opacity: clampPercent(opacity),
  };
  return isEmptyDrawOp(op) ? null : op;
}

export function commitGradientOp(
  shape: GradientShape,
  from: DrawPoint,
  to: DrawPoint,
  color: string,
  end: GradientEnd,
  opacity: number,
): GradientOp | null {
  const op: GradientOp = {
    kind: "gradient",
    shape,
    from,
    to,
    color,
    end,
    opacity: clampPercent(opacity),
  };
  return isEmptyDrawOp(op) ? null : op;
}

export function commitFillOp(
  at: DrawPoint,
  color: string,
  opacity: number,
): FillOp {
  return {
    kind: "fill",
    at,
    color,
    opacity: clampPercent(opacity),
    tolerance: FLOOD_TOLERANCE,
  };
}

export function commitEffectOp(
  mode: EffectMode,
  strength: number,
  center: DrawPoint,
  radiusPx: number,
): EffectOp {
  return {
    kind: "effect",
    mode,
    strength: clampPercent(strength),
    center,
    radiusPx: Math.max(1, radiusPx),
  };
}

export function commitTextOp(
  text: string,
  x: number,
  y: number,
  w: number,
  fontScale: number,
  style: TextStyle,
): TextOp | null {
  const op: TextOp = {
    kind: "text",
    text,
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    w: Math.min(1, Math.max(0.12, w)),
    fontScale: Math.max(0.01, fontScale),
    style,
  };
  return isEmptyDrawOp(op) ? null : op;
}

/**
 * Bóng thoại từ hộp kéo: đuôi trỏ xuống dưới từ giữa đáy hộp (trừ khung
 * thoại dạng rect không có đuôi, đúng chuẩn manga).
 */
export function commitBubbleOp(
  kind: BubbleShapeKind,
  from: DrawPoint,
  to: DrawPoint,
  strokeColor: string,
): BubbleOp | null {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  if (w < 0.02 || h < 0.02) return null;
  const shape: BubbleShape = {
    id: `bubble-${Date.now().toString(36)}`,
    kind,
    x,
    y,
    w,
    h,
    tail:
      kind === "rect"
        ? null
        : {
            x: Math.min(1, Math.max(0, x + w / 2)),
            y: Math.min(1, y + h + 0.12),
          },
    fill: "#ffffff",
    strokeColor,
    strokeScale: 0.004,
  };
  return { kind: "bubble", shape };
}

export function commitMoveOp(
  from: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
): MoveOp | null {
  const op: MoveOp = { kind: "move", from, dx, dy };
  return isEmptyDrawOp(op) ? null : op;
}

export function commitEraseOp(points: readonly DrawPoint[]): EraseOp | null {
  const op: EraseOp = { kind: "erase", points: [...points] };
  return isEmptyDrawOp(op) ? null : op;
}

// ------------------------------------------------------------ Màu ------------------------------------------------------------

/** `#rrggbb` + độ mờ % -> RGBA (dùng cho đổ màu lên ImageData). */
export function hexToRgba(
  hex: string,
  opacityPercent: number,
): [number, number, number, number] {
  const [r, g, b] = parseHexColor(hex);
  return [r, g, b, Math.round((clampPercent(opacityPercent) / 100) * 255)];
}

function hexByte(v: number): string {
  return Math.round(Math.min(255, Math.max(0, v)))
    .toString(16)
    .padStart(2, "0");
}

/** Pixel lấy bằng bút lấy màu -> mã hex; pixel trong suốt hoàn toàn -> null. */
export function rgbaToHex(
  r: number,
  g: number,
  b: number,
  a: number,
): string | null {
  if (a <= 0) return null;
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

/** Thuộc tính mặc định kiểu manga cho từng công cụ (giữ màu khi đổi tool). */
export function animToolDefaults(tool: AnimDrawTool): {
  size: number;
  opacity: number;
  flow: number;
  hardness: number;
  smoothing: number;
} {
  const base =
    tool === "bubble"
      ? defaultSettingsFor("shape")
      : defaultSettingsFor(
          tool as Parameters<typeof defaultSettingsFor>[0],
        );
  return {
    size: clampSize(base.size),
    opacity: base.opacity,
    flow: base.flow,
    hardness: base.hardness,
    smoothing: base.smoothing,
  };
}

// ------------------------------------------------------------ Vẽ ------------------------------------------------------------

function px(p: DrawPoint, width: number, height: number): { x: number; y: number } {
  return { x: p.x * width, y: p.y * height };
}

/** Vẽ một nét tự do (bút/cọ/tẩy) lên ctx, đã đổi sang px tuyệt đối. */
function paintFreePath(
  ctx: CanvasRenderingContext2D,
  op: FreeOp,
  width: number,
  height: number,
): void {
  if (op.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = op.widthPx;
  ctx.globalAlpha = op.opacity / 100;
  if (op.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.globalAlpha = (op.opacity / 100) * (op.flow / 100);
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = op.color;
    if (op.tool === "brush") {
      ctx.shadowColor = op.color;
      ctx.shadowBlur = hardnessBlurRadius(op.hardness, op.widthPx);
      ctx.globalAlpha = (op.opacity / 100) * dabAlpha(op.flow);
    }
  }
  ctx.beginPath();
  const first = px(op.points[0], width, height);
  ctx.moveTo(first.x, first.y);
  if (op.points.length === 1) {
    ctx.lineTo(first.x + 0.01, first.y + 0.01);
  } else {
    for (const p of op.points.slice(1)) {
      const q = px(p, width, height);
      ctx.lineTo(q.x, q.y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Đổ màu một op lên ctx, trả về số pixel đã đổi (0 = không đổ gì). */
export function paintFillOp(
  ctx: CanvasRenderingContext2D,
  op: FillOp,
  width: number,
  height: number,
): number {
  const at = px(op.at, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  const painted = floodFillPixels(
    img.data,
    width,
    height,
    Math.floor(at.x),
    Math.floor(at.y),
    hexToRgba(op.color, op.opacity),
    { tolerance: op.tolerance },
  );
  if (painted > 0) ctx.putImageData(img, 0, 0);
  return painted;
}
export function paintDrawOp(
  ctx: CanvasRenderingContext2D,
  op: DrawOp,
  width: number,
  height: number,
): void {
  switch (op.kind) {
    case "free": {
      if (op.symmetry === "off") {
        paintFreePath(ctx, op, width, height);
      } else {
        drawWithSymmetry(ctx, op.symmetry, width, height, () =>
          paintFreePath(ctx, op, width, height),
        );
      }
      return;
    }
    case "airbrush": {
      ctx.save();
      ctx.globalAlpha = op.opacity / 100;
      ctx.fillStyle = op.color;
      for (const s of op.stamps) {
        const p = px(s, width, height);
        ctx.beginPath();
        ctx.arc(p.x, p.y, op.dabRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    case "shape": {
      const from = px(op.from, width, height);
      const to = px(op.to, width, height);
      ctx.save();
      ctx.globalAlpha = op.opacity / 100;
      ctx.lineWidth = op.widthPx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = op.color;
      ctx.fillStyle = op.color;
      buildShapePath(ctx, op.shape, from, to, op.sides, op.widthPx);
      if (op.fill) ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    case "curve": {
      const from = px(op.from, width, height);
      const to = px(op.to, width, height);
      const [c1, c2] = curveControlPoints(from, to, op.bow);
      ctx.save();
      ctx.globalAlpha = op.opacity / 100;
      ctx.lineWidth = op.widthPx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = op.color;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, to.x, to.y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case "gradient": {
      const from = px(op.from, width, height);
      const to = px(op.to, width, height);
      const gradient = buildGradient(ctx, op.shape, from, to, op.color, op.end);
      const x = Math.min(from.x, to.x);
      const y = Math.min(from.y, to.y);
      const w = Math.abs(to.x - from.x);
      const h = Math.abs(to.y - from.y);
      ctx.save();
      ctx.globalAlpha = op.opacity / 100;
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(1, w), Math.max(1, h));
      ctx.restore();
      return;
    }
    case "fill": {
      paintFillOp(ctx, op, width, height);
      return;
    }
    case "effect": {
      const c = px(op.center, width, height);
      const r = Math.max(1, Math.round(op.radiusPx));
      const x = Math.max(0, Math.floor(c.x - r));
      const y = Math.max(0, Math.floor(c.y - r));
      const w = Math.min(width - x, r * 2);
      const h = Math.min(height - y, r * 2);
      if (w <= 0 || h <= 0) return;
      const img = ctx.getImageData(x, y, w, h);
      if (op.mode === "blur") {
        boxBlurRGBA(img.data, w, h, blurRadiusForSize(r * 2), 2);
      } else {
        sharpenRGBA(img.data, w, h, sharpenAmountForStrength(op.strength));
      }
      ctx.putImageData(img, x, y);
      return;
    }
    case "text": {
      drawTextItems(
        ctx,
        [
          {
            id: "op",
            x: op.x,
            y: op.y,
            w: op.w,
            text: op.text,
            fontScale: op.fontScale,
            ...op.style,
          },
        ],
        width,
        height,
      );
      return;
    }
    case "bubble": {
      drawBubbleShapes(ctx, [op.shape], width, height);
      return;
    }
    case "move": {
      const x = Math.round(op.from.x * width);
      const y = Math.round(op.from.y * height);
      const w = Math.round(op.from.w * width);
      const h = Math.round(op.from.h * height);
      if (w <= 0 || h <= 0) return;
      const img = ctx.getImageData(x, y, w, h);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      ctx.putImageData(
        img,
        Math.round(x + op.dx * width),
        Math.round(y + op.dy * height),
      );
      return;
    }
    case "erase": {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      op.points.forEach((p, i) => {
        const q = px(p, width, height);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
  }
}

/** Vẽ lại toàn bộ: hình gốc (nếu có) rồi mọi op theo thứ tự. */
export function renderDrawOps(
  ctx: CanvasRenderingContext2D,
  baseImage: HTMLImageElement | null,
  ops: readonly DrawOp[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (baseImage) ctx.drawImage(baseImage, 0, 0, width, height);
  for (const op of ops) paintDrawOp(ctx, op, width, height);
}

/**
 * Xuất PNG nền trong suốt ,  hợp đồng onSave của modal: luôn gọi
 * `toDataURL("image/png")` trên đúng canvas chính (không dính lớp phủ).
 */
export function exportPngDataUrl(canvas: {
  toDataURL: (type?: string) => string;
}): string {
  return canvas.toDataURL("image/png");
}

// ------------------------------------------------------------ Tiện ích chọn vùng (dùng lại logic manga, toạ độ px) ------------------------------------------------------------

/** Tạo vùng chọn từ điểm kéo. Điểm truyền vào theo px khung (đúng không
 * gian của lib manga: lasso lọc điểm dưới 2px, diện tích tối thiểu 4px²);
 * modal đổi sang tương đối 0..1 khi commit op dời/xoá vùng. */
export function selectionFromDrag(
  mode: "rect" | "lasso",
  points: readonly { x: number; y: number }[],
): Selection | null {
  if (points.length === 0) return null;
  if (mode === "rect") {
    if (points.length < 2) return null;
    return rectSelection(points[0], points[points.length - 1]);
  }
  const sel = lassoSelection(points);
  return sel.points.length >= 3 ? sel : null;
}

export function moveSelectionBy(
  sel: Selection,
  dx: number,
  dy: number,
): Selection {
  return translateSelection(sel, dx, dy);
}

export { symmetryTransforms };
export { clampSides, shapeLabel, snapToAngle };
