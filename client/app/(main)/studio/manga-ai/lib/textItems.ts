/**
 * Chữ dạng **đối tượng** theo khung (thay bong bóng thoại tự động — Sơn chốt
 * 22/10/2026: bỏ bong bóng có sẵn, người dùng tự vẽ bóng bằng công cụ hình,
 * chữ thêm bằng công cụ Text và **sửa/dời được sau khi đã điền**).
 *
 * Trước đây công cụ Text raster chữ thẳng vào bitmap layer: điền xong là
 * "chết", muốn sửa phải tẩy cả vùng. Nay mỗi đoạn chữ là một TextItem
 * (vị trí normalized + nội dung + cỡ chữ + màu), lưu kèm trang trong
 * IndexedDB, vẽ vào composite bằng `drawTextItems` (hiển thị + panelData +
 * ảnh xuất + PDF). Người dùng tự vẽ bóng thoại bằng công cụ ellipse rồi đặt
 * chữ này lên trên.
 */

export interface TextItem {
  id: string;
  /** Điểm neo trái-trên của khối chữ, normalized 0..1 theo khung. */
  x: number;
  y: number;
  text: string;
  /** Cỡ chữ theo tỉ lệ chiều cao khung (px vẽ = fontScale × chiều cao canvas). */
  fontScale: number;
  color: string;
}

export type PanelTextItems = Record<string, TextItem[]>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function createTextItem(
  id: string,
  x: number,
  y: number,
  text: string,
  fontScale: number,
  color: string,
): TextItem {
  return { id, x: clamp01(x), y: clamp01(y), text, fontScale, color };
}

/** Dời khối chữ, kẹp điểm neo trong khung. */
export function moveTextItem(item: TextItem, dx: number, dy: number): TextItem {
  return { ...item, x: clamp01(item.x + dx), y: clamp01(item.y + dy) };
}

/**
 * Ngắt dòng theo bề rộng đo thật (hàm đo do nơi gọi truyền). Tôn trọng dấu
 * xuống dòng có sẵn trong nội dung; từ dài hơn một dòng được giữ nguyên.
 */
export function wrapTextLines(
  text: string,
  maxWidthPx: number,
  measure: (s: string) => number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`;
      if (measure(next) <= maxWidthPx) {
        line = next;
      } else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out.length > 0 ? out : [""];
}

/**
 * Hộp bao của khối chữ (normalized) theo cùng luật ngắt dòng lúc vẽ — dùng
 * để đặt tay nắm chọn/kéo và hộp sửa chữ đúng kích thước thật.
 */
export function textItemBox(
  item: TextItem,
  w: number,
  h: number,
  measure: (s: string) => number,
): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const fontPx = Math.max(10, item.fontScale * h);
  const maxWidth = Math.max(40, w - item.x * w);
  const lines = wrapTextLines(item.text, maxWidth, measure);
  const widest = lines.reduce((m, line) => Math.max(m, measure(line)), 0);
  return {
    w: Math.min(1, widest / w),
    h: Math.min(1, (lines.length * fontPx * 1.25) / h),
  };
}

/** Vẽ toàn bộ khối chữ của một khung lên ctx (hệ pixel của canvas đích). */
export function drawTextItems(
  ctx: CanvasRenderingContext2D,
  items: readonly TextItem[],
  w: number,
  h: number,
): void {
  if (!(w > 0) || !(h > 0)) return;
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  for (const item of items) {
    const fontPx = Math.max(10, item.fontScale * h);
    ctx.font = `${fontPx}px "Comic Sans MS", "Arial", sans-serif`;
    ctx.fillStyle = item.color;
    const x = item.x * w;
    const y = item.y * h;
    const maxWidth = Math.max(40, w - x);
    const lines = wrapTextLines(item.text, maxWidth, (s) =>
      ctx.measureText(s).width,
    );
    const lineHeight = fontPx * 1.25;
    lines.forEach((line, i) => {
      ctx.fillText(line, x, y + i * lineHeight);
    });
  }
  ctx.restore();
}
