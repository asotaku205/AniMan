/**
 * Hình **bóng thoại mẫu** (hỗ trợ thiết kế bong bóng — Sơn chốt 22/10/2026:
 * bỏ bong bóng tự sinh cả cụm, thay bằng hình mẫu người dùng tự đặt/dời/đổi
 * cỡ/kéo đuôi rồi đặt chữ dạng đối tượng lên trên).
 *
 * 4 mẫu theo chuẩn manga: `ellipse` (thoại thường), `rect` (khung thoại/
 * dẫn chuyện), `thought` (suy nghĩ — viền mây + chấm đuôi), `shout` (hét —
 * viền răng cưa). Hình là dữ liệu vector theo khung, lưu kèm trang trong
 * IndexedDB, vẽ vào composite bằng `drawBubbleShapes` TRƯỚC lớp chữ.
 */

export type BubbleShapeKind = "ellipse" | "rect" | "thought" | "shout";

export const BUBBLE_SHAPE_OPTIONS: Array<{ kind: BubbleShapeKind; label: string }> = [
  { kind: "ellipse", label: "Bóng thoại" },
  { kind: "rect", label: "Khung thoại" },
  { kind: "thought", label: "Bóng nghĩ" },
  { kind: "shout", label: "Bóng hét" },
];

export interface BubbleShape {
  id: string;
  kind: BubbleShapeKind;
  /** Góc trái-trên + kích thước, normalized 0..1 theo khung. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Đầu nhọn của đuôi (normalized, toạ độ tuyệt đối trong khung); null = không đuôi. */
  tail: { x: number; y: number } | null;
  fill: string;
  strokeColor: string;
  /** Độ dày viền theo tỉ lệ cạnh nhỏ của khung (0.004 mặc định). */
  strokeScale: number;
}

export type PanelBubbleShapes = Record<string, BubbleShape[]>;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function createBubbleShape(id: string, kind: BubbleShapeKind): BubbleShape {
  return {
    id,
    kind,
    x: 0.28,
    y: 0.1,
    w: 0.44,
    h: 0.24,
    tail:
      kind === "rect"
        ? null
        : { x: 0.5, y: 0.52 },
    fill: "#ffffff",
    strokeColor: "#111111",
    strokeScale: 0.004,
  };
}

export function moveBubbleShape(
  shape: BubbleShape,
  dx: number,
  dy: number,
): BubbleShape {
  const nx = clamp(shape.x + dx, 0, 1 - shape.w);
  const ny = clamp(shape.y + dy, 0, 1 - shape.h);
  const movedX = nx - shape.x;
  const movedY = ny - shape.y;
  return {
    ...shape,
    x: nx,
    y: ny,
    // Đuôi đi theo thân để khỏi phải kéo lại sau mỗi lần dời
    tail: shape.tail
      ? {
          x: clamp(shape.tail.x + movedX, 0, 1),
          y: clamp(shape.tail.y + movedY, 0, 1),
        }
      : null,
  };
}

export function resizeBubbleShape(
  shape: BubbleShape,
  w: number,
  h: number,
): BubbleShape {
  return {
    ...shape,
    w: clamp(w, 0.1, 1 - shape.x),
    h: clamp(h, 0.08, 1 - shape.y),
  };
}

/** Đường viền răng cưa của bóng hét: các điểm sao quanh ellipse. */
export function shoutPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spikes = 16,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const factor = i % 2 === 0 ? 1 : 0.86;
    points.push({
      x: cx + Math.cos(angle) * rx * factor,
      y: cy + Math.sin(angle) * ry * factor,
    });
  }
  return points;
}

function drawTailTriangle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tx: number,
  ty: number,
  fill: string,
  strokeColor: string,
  lineWidth: number,
): void {
  const angle = Math.atan2(ty - cy, tx - cx);
  const spread = 0.3;
  const p1 = {
    x: cx + Math.cos(angle - spread) * rx,
    y: cy + Math.sin(angle - spread) * ry,
  };
  const p2 = {
    x: cx + Math.cos(angle + spread) * rx,
    y: cy + Math.sin(angle + spread) * ry,
  };
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(tx, ty);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();
}

/** Vẽ toàn bộ hình bóng của một khung lên ctx (hệ pixel của canvas đích). */
export function drawBubbleShapes(
  ctx: CanvasRenderingContext2D,
  shapes: readonly BubbleShape[],
  w: number,
  h: number,
): void {
  if (!(w > 0) || !(h > 0)) return;
  const unit = Math.min(w, h);
  ctx.save();
  ctx.lineJoin = "round";
  for (const shape of shapes) {
    const bx = shape.x * w;
    const by = shape.y * h;
    const bw = shape.w * w;
    const bh = shape.h * h;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const lineWidth = Math.max(1.2, shape.strokeScale * unit * 2.2);

    if (shape.kind === "thought") {
      // Viền mây: vòng các hình tròn nhỏ chồng nhau quanh ellipse
      const bumps = 14;
      ctx.beginPath();
      for (let i = 0; i < bumps; i++) {
        const angle = (i / bumps) * Math.PI * 2;
        const px = cx + Math.cos(angle) * (bw / 2);
        const py = cy + Math.sin(angle) * (bh / 2);
        const r = Math.min(bw, bh) * 0.16;
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = shape.fill;
      ctx.fill();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = shape.strokeColor;
      ctx.stroke();
      // Thân trong để che các nét vòng cung phía trong
      ctx.beginPath();
      ctx.ellipse(cx, cy, bw / 2 - lineWidth, bh / 2 - lineWidth, 0, 0, Math.PI * 2);
      ctx.fillStyle = shape.fill;
      ctx.fill();
      // Đuôi dạng 2 chấm nhỏ dần về phía đầu nhọn
      if (shape.tail) {
        const tx = shape.tail.x * w;
        const ty = shape.tail.y * h;
        const steps = [
          { t: 0.45, r: 0.045 },
          { t: 0.78, r: 0.028 },
        ];
        for (const step of steps) {
          const px = cx + (tx - cx) * step.t;
          const py = cy + (ty - cy) * step.t;
          ctx.beginPath();
          ctx.arc(px, py, Math.min(bw, bh) * step.r, 0, Math.PI * 2);
          ctx.fillStyle = shape.fill;
          ctx.fill();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = shape.strokeColor;
          ctx.stroke();
        }
      }
      continue;
    }

    if (shape.tail) {
      drawTailTriangle(
        ctx,
        cx,
        cy,
        bw / 2,
        bh / 2,
        shape.tail.x * w,
        shape.tail.y * h,
        shape.fill,
        shape.strokeColor,
        lineWidth,
      );
    }

    ctx.beginPath();
    if (shape.kind === "ellipse") {
      ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    } else if (shape.kind === "rect") {
      ctx.roundRect(bx, by, bw, bh, Math.min(bw, bh) * 0.08);
    } else {
      const pts = shoutPoints(cx, cy, bw / 2, bh / 2);
      pts.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
    }
    ctx.fillStyle = shape.fill;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = shape.strokeColor;
    ctx.stroke();
  }
  ctx.restore();
}
