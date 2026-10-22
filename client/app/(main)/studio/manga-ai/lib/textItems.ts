/**
 * Chữ dạng **đối tượng** theo khung — tool chữ hoàn chỉnh theo chuẩn các hệ
 * thống lớn (Clip Studio Paint / Photoshop): font, độ đậm (weight), nghiêng,
 * màu, độ mờ, căn lề, giãn dòng và **viền nét** (outline) đều là thuộc tính
 * của từng khối chữ, sửa/dời được sau khi điền. Người dùng tự vẽ bóng hoặc
 * dùng hình bóng mẫu (`lib/bubbleShapes.ts`) rồi đặt chữ lên trên.
 *
 * Mỗi đoạn chữ là một TextItem lưu kèm trang trong IndexedDB, vẽ vào
 * composite bằng `drawTextItems` (hiển thị + panelData + ảnh xuất + PDF).
 * Các bản ghi cũ (trước khi có trường style) được `withTextStyleDefaults`
 * bổ sung giá trị mặc định khi đọc.
 */

/** Danh sách font để chọn — ưu tiên font có sẵn trên máy và hỗ trợ tiếng Việt tốt. */
export const TEXT_FONT_OPTIONS = [
  { id: "comic", label: "Comic (manga)", stack: '"Comic Sans MS", "Arial", sans-serif' },
  { id: "arial", label: "Arial", stack: '"Arial", sans-serif' },
  { id: "segoe", label: "Segoe UI", stack: '"Segoe UI", "Arial", sans-serif' },
  { id: "tahoma", label: "Tahoma", stack: '"Tahoma", sans-serif' },
  { id: "verdana", label: "Verdana", stack: '"Verdana", sans-serif' },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", serif' },
  { id: "georgia", label: "Georgia", stack: '"Georgia", serif' },
  { id: "courier", label: "Courier New", stack: '"Courier New", monospace' },
] as const;

export type TextFontId = (typeof TEXT_FONT_OPTIONS)[number]["id"];

/** Độ đậm nét chữ — "đậm nhạt" theo 4 nấc như các tool lớn. */
export const TEXT_WEIGHT_OPTIONS = [
  { value: 400, label: "Nhẹ" },
  { value: 600, label: "Vừa" },
  { value: 700, label: "Đậm" },
  { value: 900, label: "Rất đậm" },
] as const;

export type TextAlign = "left" | "center" | "right";

/** Phần style của một khối chữ — cũng là "style hiện hành" cho chữ sắp điền. */
export interface TextStyle {
  fontId: TextFontId;
  fontWeight: number;
  italic: boolean;
  color: string;
  /** 0..1 */
  opacity: number;
  align: TextAlign;
  /** Giãn dòng theo bội số cỡ chữ (1 = sát, 1.25 mặc định, 1.6 thoáng). */
  lineHeight: number;
  /** Độ dày viền nét theo tỉ lệ cỡ chữ (0 = không viền, 0.25 = rất dày). */
  strokeScale: number;
  strokeColor: string;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontId: "comic",
  fontWeight: 600,
  italic: false,
  color: "#111111",
  opacity: 1,
  align: "center",
  lineHeight: 1.25,
  strokeScale: 0,
  strokeColor: "#ffffff",
};

export interface TextItem extends TextStyle {
  id: string;
  /** Điểm neo trái-trên của khối chữ, normalized 0..1 theo khung. */
  x: number;
  y: number;
  /** Bề rộng khối chữ (normalized); ngắt dòng và căn lề theo bề rộng này. */
  w: number;
  text: string;
  /** Cỡ chữ theo tỉ lệ chiều cao khung (px vẽ = fontScale × chiều cao canvas). */
  fontScale: number;
}

export type PanelTextItems = Record<string, TextItem[]>;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Chuỗi font CSS đầy đủ cho canvas từ style + cỡ px. */
export function textFontCss(style: TextStyle, fontPx: number): string {
  const stack =
    TEXT_FONT_OPTIONS.find((f) => f.id === style.fontId)?.stack ??
    TEXT_FONT_OPTIONS[0].stack;
  return `${style.italic ? "italic " : ""}${style.fontWeight} ${fontPx}px ${stack}`;
}

/** Bổ sung style mặc định cho khối chữ từ bản ghi cũ (thiếu trường style). */
export function withTextStyleDefaults(raw: Partial<TextItem> & { id: string }): TextItem {
  return {
    ...DEFAULT_TEXT_STYLE,
    w: 0.45,
    ...raw,
  } as TextItem;
}

export function createTextItem(
  id: string,
  x: number,
  y: number,
  text: string,
  fontScale: number,
  style: TextStyle,
): TextItem {
  return {
    id,
    x: clamp01(x),
    y: clamp01(y),
    w: 0.45,
    text,
    fontScale,
    ...style,
  };
}

/** Dời khối chữ, kẹp điểm neo trong khung. */
export function moveTextItem(item: TextItem, dx: number, dy: number): TextItem {
  return { ...item, x: clamp01(item.x + dx), y: clamp01(item.y + dy) };
}

/** Đổi bề rộng khối chữ (tay nắm phải) — ảnh hưởng ngắt dòng + căn lề. */
export function resizeTextItem(item: TextItem, w: number): TextItem {
  return { ...item, w: Math.min(1 - item.x, Math.max(0.12, w)) };
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
  const maxWidth = Math.max(40, item.w * w);
  const lines = wrapTextLines(item.text, maxWidth, measure);
  const widest = lines.reduce((m, line) => Math.max(m, measure(line)), 0);
  return {
    w: Math.min(1, Math.max(item.w, widest / w)),
    h: Math.min(1, (lines.length * fontPx * item.lineHeight) / h),
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
  for (const raw of items) {
    const item = withTextStyleDefaults(raw);
    const fontPx = Math.max(10, item.fontScale * h);
    ctx.font = textFontCss(item, fontPx);
    const boxX = item.x * w;
    const boxY = item.y * h;
    const boxW = Math.max(40, item.w * w);
    const lines = wrapTextLines(item.text, boxW, (s) => ctx.measureText(s).width);
    const lineHeightPx = fontPx * item.lineHeight;
    ctx.globalAlpha = clamp01(item.opacity);
    lines.forEach((line, i) => {
      const lineW = ctx.measureText(line).width;
      const lx =
        item.align === "center"
          ? boxX + (boxW - lineW) / 2
          : item.align === "right"
            ? boxX + boxW - lineW
            : boxX;
      const ly = boxY + i * lineHeightPx;
      if (item.strokeScale > 0) {
        ctx.lineWidth = Math.max(1, item.strokeScale * fontPx);
        ctx.strokeStyle = item.strokeColor;
        ctx.lineJoin = "round";
        ctx.strokeText(line, lx, ly);
      }
      ctx.fillStyle = item.color;
      ctx.fillText(line, lx, ly);
    });
  }
  ctx.restore();
}
