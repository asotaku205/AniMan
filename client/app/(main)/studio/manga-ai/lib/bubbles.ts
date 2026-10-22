/**
 * Bong bóng thoại thật (Slice 5 — hoàn thiện vẽ, 22/10/2026).
 *
 * Trước Slice 5, công cụ text chỉ raster chữ thẳng vào bitmap layer: chèn
 * xong không sửa, không dời được, và không có bong bóng. Nay thoại là **dữ
 * liệu vector theo khung** (vị trí/kích thước normalized, đuôi, nội dung):
 * sửa/dời/xoá tự do, lưu kèm trang vẽ trong IndexedDB, và được **vẽ vào
 * composite** (hiển thị + panelData + ảnh xuất) bằng `drawBubbles` — một
 * nguồn sự thật duy nhất cho mọi đường render.
 */

export interface SpeechBubble {
  id: string;
  /** Góc trái-trên + kích thước, normalized 0..1 theo khung. */
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** Đầu nhọn của đuôi thoại, normalized; `null` = bong bóng không đuôi. */
  tail: { x: number; y: number } | null;
}

export type PanelBubbles = Record<string, SpeechBubble[]>;

export const MIN_BUBBLE_SIZE = 0.08;
export const MAX_BUBBLE_SIZE = 0.95;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Bong bóng mặc định ở giữa khung, đuôi chỉ xuống dưới. */
export function createBubble(id: string): SpeechBubble {
  return {
    id,
    x: 0.3,
    y: 0.12,
    w: 0.4,
    h: 0.22,
    text: "Nhập thoại...",
    tail: { x: 0.5, y: 0.55 },
  };
}

/** Dời bong bóng, kẹp để bong bóng luôn nằm trọn trong khung. */
export function moveBubble(
  bubble: SpeechBubble,
  dx: number,
  dy: number,
): SpeechBubble {
  return {
    ...bubble,
    x: clamp(bubble.x + dx, 0, 1 - bubble.w),
    y: clamp(bubble.y + dy, 0, 1 - bubble.h),
  };
}

/** Đổi kích thước từ góc phải-dưới, giữ góc trái-trên và kẹp trong khung. */
export function resizeBubble(
  bubble: SpeechBubble,
  w: number,
  h: number,
): SpeechBubble {
  return {
    ...bubble,
    w: clamp(w, MIN_BUBBLE_SIZE, Math.min(MAX_BUBBLE_SIZE, 1 - bubble.x)),
    h: clamp(h, MIN_BUBBLE_SIZE, Math.min(MAX_BUBBLE_SIZE, 1 - bubble.y)),
  };
}

/**
 * Ngắt dòng theo bề rộng đo thật (hàm đo do nơi gọi truyền — canvas
 * measureText ở runtime, hàm giả ở test). Từ dài hơn một dòng thì giữ
 * nguyên dòng đó (tràn còn hơn cắt chữ).
 */
export function wrapBubbleText(
  text: string,
  maxWidthPx: number,
  measure: (s: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${line} ${words[i]}`;
    if (measure(next) <= maxWidthPx) {
      line = next;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Vẽ toàn bộ bong bóng của một khung lên ctx (hệ pixel của canvas đích).
 * Thứ tự mỗi bong bóng: đuôi (fill trắng + viền đen) → thân ellipse fill
 * trắng (che chân đuôi) → viền ellipse → chữ căn giữa, co cỡ chữ khi nội
 * dung dài.
 */
export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: readonly SpeechBubble[],
  w: number,
  h: number,
): void {
  if (!(w > 0) || !(h > 0)) return;
  const unit = Math.min(w, h);
  ctx.save();
  ctx.lineJoin = "round";
  for (const bubble of bubbles) {
    const bx = bubble.x * w;
    const by = bubble.y * h;
    const bw = bubble.w * w;
    const bh = bubble.h * h;
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    const border = Math.max(1.5, unit * 0.004);

    if (bubble.tail) {
      const tx = bubble.tail.x * w;
      const ty = bubble.tail.y * h;
      const angle = Math.atan2(ty - cy, tx - cx);
      const spread = 0.32;
      const p1 = {
        x: cx + Math.cos(angle - spread) * (bw / 2),
        y: cy + Math.sin(angle - spread) * (bh / 2),
      };
      const p2 = {
        x: cx + Math.cos(angle + spread) * (bw / 2),
        y: cy + Math.sin(angle + spread) * (bh / 2),
      };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(tx, ty);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = border;
      ctx.strokeStyle = "#111111";
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = border;
    ctx.strokeStyle = "#111111";
    ctx.stroke();

    const fontSize = Math.max(10, Math.min(bh * 0.22, unit * 0.045));
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.fillStyle = "#111111";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = wrapBubbleText(bubble.text, bw * 0.78, (s) =>
      ctx.measureText(s).width,
    );
    const lineHeight = fontSize * 1.25;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, startY + i * lineHeight);
    });
  }
  ctx.restore();
}
