import type { AiStrokePath } from "@/lib/ai-drawing-api";
import {
  aiStrokeAlpha,
  aiStrokeColor,
  aiStrokePixelWidth,
  aiStrokeShape,
  orderStrokesByGroup,
  type AiStrokeShape,
} from "./aiStrokeGeometry";

/** Một lớp AI ở dạng cần cho việc vẽ xuống bitmap. */
export interface RasterizeLayerInput {
  strokes: readonly AiStrokePath[];
  /** Độ mờ của lớp AI (0..1) */
  opacity: number;
}

/**
 * Vẽ nét AI (vector) xuống một context 2D — dùng cho **"Áp dụng về lớp tôi"** (5C.2).
 *
 * Đây là **con đường duy nhất** để nét AI đi vào canvas người dùng, và chỉ chạy khi
 * người dùng bấm nút: theo bất biến C1/C2 nét AI không bao giờ tự ghi xuống layer và
 * không bao giờ được xuất ra file.
 *
 * Vẽ theo thứ tự nhóm nội dung, có viền trắng mảnh dưới nét màu giống hệt lớp phủ
 * để bản rasterize trông đúng như những gì người dùng nhìn thấy.
 *
 * @returns số nét đã vẽ được (nét thiếu dữ liệu hình học bị bỏ qua).
 */
export function rasterizeAiStrokes(
  ctx: CanvasRenderingContext2D,
  layers: readonly RasterizeLayerInput[],
  width: number,
  height: number,
  sliderOpacity = 1,
): number {
  if (width <= 0 || height <= 0) return 0;
  let painted = 0;

  for (const layer of layers) {
    for (const stroke of orderStrokesByGroup(layer.strokes)) {
      const shape = aiStrokeShape(stroke, width, height);
      if (!shape) continue;

      const alpha = aiStrokeAlpha(stroke, layer.opacity, sliderOpacity);
      const strokeWidth = aiStrokePixelWidth(stroke, width, height);
      const color = aiStrokeColor(stroke);
      const fill =
        shape.kind === "path" && shape.closed && stroke.fill && stroke.fill !== "none"
          ? stroke.fill
          : null;

      // Viền trắng trước, nét màu sau — cùng thứ tự với lớp phủ SVG (5C.3).
      drawShape(ctx, shape, {
        color: "#ffffff",
        width: strokeWidth + 2,
        alpha: Math.min(1, alpha + 0.25),
        fill: null,
        dashed: false,
      });
      drawShape(ctx, shape, {
        color,
        width: strokeWidth,
        alpha,
        fill,
        dashed: stroke.dashed === true,
      });
      painted += 1;
    }
  }

  return painted;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: AiStrokeShape,
  style: {
    color: string;
    width: number;
    alpha: number;
    fill: string | null;
    dashed: boolean;
  },
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = style.alpha;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(style.dashed ? [style.width * 4, style.width * 2] : []);

  if (shape.kind === "path") {
    // `d` dùng được cho cả SVG lẫn Path2D (một nguồn hình học duy nhất).
    if (typeof Path2D !== "undefined") {
      const path = new Path2D(shape.d);
      if (style.fill) {
        ctx.fillStyle = style.fill;
        ctx.fill(path);
      }
      ctx.stroke(path);
      ctx.restore();
      return;
    }
    // Môi trường không có Path2D (test/SSR): bỏ nét cong thay vì vẽ sai chỗ.
    ctx.restore();
    return;
  }

  ctx.beginPath();
  if (shape.kind === "line") {
    ctx.moveTo(shape.x1, shape.y1);
    ctx.lineTo(shape.x2, shape.y2);
  } else if (shape.kind === "ellipse") {
    ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
  } else {
    const radius = Math.min(shape.radius, shape.width / 2, shape.height / 2);
    if (typeof ctx.roundRect === "function" && radius > 0) {
      ctx.roundRect(shape.x, shape.y, shape.width, shape.height, radius);
    } else {
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
    }
  }

  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}
