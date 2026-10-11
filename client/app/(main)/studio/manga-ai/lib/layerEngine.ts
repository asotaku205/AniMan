/**
 * layerEngine — bộ não render cho kiến trúc multi-canvas (Spec 02 §1, RC-1..RC-7).
 *
 * Nguyên tắc:
 * - Phần **thuần** (buildCompositePlan, layerAlpha, blendToComposite,
 *   layerCanvasSize) không đụng DOM → test được trong Node.
 * - Phần **DOM** (createLayerCanvas, compositeTo) chỉ là lớp vỏ mỏng.
 *
 * Thứ tự mảng `layers` (RC-4, chốt lại): **index 0 = lớp trên cùng** —
 * trùng với cách tab Layer đang hiển thị (layer mới thêm vào đầu danh sách,
 * nút "lên" dịch chuyển về index 0). Khi composite thì vẽ từ cuối lên đầu
 * để index 0 nằm trên tất cả.
 */

import type { LayerBlend, LayerItem } from "../data";

export type LayerSourceMap = Map<string, HTMLCanvasElement>;

/** Một bước vẽ trong lần composite — đã sắp thứ tự từ dưới đáy lên. */
export interface CompositeOp {
  layerId: string;
  canvas: HTMLCanvasElement;
  /** 0..1 — suy ra từ layer.opacity (0..100) */
  alpha: number;
  blend: GlobalCompositeOperation;
  /** 0 = vẽ trước (dưới đáy), số lớn = vẽ sau (trên cùng) */
  order: number;
}

const BLEND_MAP: Record<LayerBlend, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
};

/** Map LayerBlend → globalCompositeOperation của Canvas 2D. */
export function blendToComposite(blend: LayerBlend): GlobalCompositeOperation {
  return BLEND_MAP[blend] ?? "source-over";
}

/** opacity layer (0..100) → alpha canvas (0..1), có clamp. */
export function layerAlpha(opacity: number): number {
  if (!Number.isFinite(opacity)) return 1;
  return Math.min(1, Math.max(0, opacity / 100));
}

/**
 * Kích thước canvas theo RC-1: kích thước khung × devicePixelRatio,
 * dpr không hợp lệ hoặc ≤ 0 → co về 1.
 */
export function layerCanvasSize(
  width: number,
  height: number,
  devicePixelRatio: number,
): { width: number; height: number; scale: number } {
  const scale =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Lập kế hoạch render: lọc layer không hiển thị / không có bitmap / là layer AI,
 * rồi sắp thứ tự từ dưới đáy lên.
 *
 * - `layers[0]` là lớp trên cùng → vẽ **sau cùng** (order lớn nhất).
 * - Layer `kind:"ai"` không có pixel (RC-5) nên không bao giờ xuất hiện.
 */
export function buildCompositePlan(
  layers: readonly LayerItem[],
  sources: LayerSourceMap,
): CompositeOp[] {
  const ops: CompositeOp[] = [];
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;
    if (layer.kind === "ai") continue;
    const canvas = sources.get(layer.id);
    if (!canvas) continue;
    ops.push({
      layerId: layer.id,
      canvas,
      alpha: layerAlpha(layer.opacity),
      blend: blendToComposite(layer.blend),
      order: ops.length,
    });
  }
  return ops;
}

// ─── Phần DOM (chỉ chạy trên trình duyệt) ────────────────────────────────────

/**
 * Tạo canvas offscreen cho một layer theo RC-1
 * (kích thước khung × dpr, không gắn vào DOM).
 */
export function createLayerCanvas(
  width: number,
  height: number,
  devicePixelRatio = 1,
): HTMLCanvasElement {
  const { width: w, height: h } = layerCanvasSize(
    width,
    height,
    devicePixelRatio,
  );
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/**
 * Render toàn bộ plan lên canvas hiển thị.
 * @param background nền đằng sau (mặc định trắng — snapshot gửi AI là nền trắng, RC-6)
 */
export function compositeTo(
  target: HTMLCanvasElement,
  ops: readonly CompositeOp[],
  options: { background?: string; width?: number; height?: number } = {},
): void {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  const width = options.width ?? target.width;
  const height = options.height ?? target.height;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = options.background ?? "#ffffff";
  ctx.fillRect(0, 0, width, height);

  for (const op of ops) {
    ctx.globalAlpha = op.alpha;
    ctx.globalCompositeOperation = op.blend;
    ctx.drawImage(op.canvas, 0, 0, width, height);
  }

  ctx.restore();
}
