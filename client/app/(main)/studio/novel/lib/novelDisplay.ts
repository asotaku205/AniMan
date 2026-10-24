/**
 * Cài đặt hiển thị của Novel Studio — lưu localStorage (không cần
 * server): theme quyển sách, cỡ chữ, giãn dòng và chế độ hiển thị dàn ý.
 * Trang Cài đặt (/settings) sửa cùng một kho này; Novel Studio đọc làm
 * mặc định thay vì cứng paper/xl/relaxed.
 */

export type NovelDisplayTheme = "paper" | "sepia" | "dark" | "night";
export type NovelDisplaySize = "sm" | "md" | "lg" | "xl";
export type NovelLineHeight = "normal" | "relaxed" | "loose";
export type OutlineMode = "book" | "default";

export interface NovelDisplaySettings {
  theme: NovelDisplayTheme;
  fontSize: NovelDisplaySize;
  lineHeight: NovelLineHeight;
  outlineMode: OutlineMode;
}

export const DEFAULT_NOVEL_DISPLAY: NovelDisplaySettings = {
  theme: "paper",
  fontSize: "xl",
  lineHeight: "relaxed",
  outlineMode: "book",
};

const KEY = "animan_novel_display_v1";

const THEMES: NovelDisplayTheme[] = ["paper", "sepia", "dark", "night"];
const SIZES: NovelDisplaySize[] = ["sm", "md", "lg", "xl"];
const HEIGHTS: NovelLineHeight[] = ["normal", "relaxed", "loose"];
const MODES: OutlineMode[] = ["book", "default"];

/** Chuẩn hoá dữ liệu thô (kể cả dữ liệu cũ/lỗi) về dạng hợp lệ. */
export function sanitizeNovelDisplaySettings(
  raw: unknown,
): NovelDisplaySettings {
  const r = (raw ?? {}) as Partial<NovelDisplaySettings>;
  return {
    theme: THEMES.includes(r.theme as NovelDisplayTheme)
      ? (r.theme as NovelDisplayTheme)
      : DEFAULT_NOVEL_DISPLAY.theme,
    fontSize: SIZES.includes(r.fontSize as NovelDisplaySize)
      ? (r.fontSize as NovelDisplaySize)
      : DEFAULT_NOVEL_DISPLAY.fontSize,
    lineHeight: HEIGHTS.includes(r.lineHeight as NovelLineHeight)
      ? (r.lineHeight as NovelLineHeight)
      : DEFAULT_NOVEL_DISPLAY.lineHeight,
    outlineMode: MODES.includes(r.outlineMode as OutlineMode)
      ? (r.outlineMode as OutlineMode)
      : DEFAULT_NOVEL_DISPLAY.outlineMode,
  };
}

export function loadNovelDisplaySettings(): NovelDisplaySettings {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_NOVEL_DISPLAY;
    }
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOVEL_DISPLAY;
    return sanitizeNovelDisplaySettings(JSON.parse(raw));
  } catch {
    return DEFAULT_NOVEL_DISPLAY;
  }
}

export function saveNovelDisplaySettings(
  patch: Partial<NovelDisplaySettings>,
): NovelDisplaySettings {
  const next = { ...loadNovelDisplaySettings(), ...patch };
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    }
  } catch {
    /* không chặn viết khi storage bị chặn */
  }
  return next;
}
