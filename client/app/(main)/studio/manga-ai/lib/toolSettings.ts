/**
 * toolSettings — thuộc tính nét theo từng công cụ (BR-T01…BR-T04, AC-T2.1,
 * AC-T2.3, AC-T2.5). Module thuần: không React, không DOM, test trực tiếp được.
 */

import type { DrawTool } from "../data";

/** Thuộc tính nét của một công cụ (BR-T02). */
export interface ToolSettings {
  /** Đường kính nét, px artwork (1–200). */
  size: number;
  /** Độ mờ **cả nét**, % (1–100) — nhân với opacity layer lúc render (AC-T2.6). */
  opacity: number;
  /** Lượng mực mỗi nhát cọ, % (1–100) — các nhát chồng nhau thì đậm dần. */
  flow: number;
  /** Độ cứng đầu cọ, % (0–100) — 100 = cứng, càng thấp viền càng mờ. */
  hardness: number;
  /** Làm mượt nét tự do, % (0–100) — BR-T03. */
  smoothing: number;
  /** Chế độ tẩy (BR-T04). */
  eraserMode: "clear" | "alpha";
}

export const SIZE_MIN = 1;
export const SIZE_MAX = 200;

/** Preset thanh trượt size (AC-T2.5). */
export const SIZE_PRESETS: readonly number[] = [1, 4, 8, 16, 32, 64];

/**
 * Bảng màu nhanh 16 màu manga (AC-T2.3): đen mực, **xám 5 bậc**, trắng giấy,
 * rồi tới các màu nhấn dùng cho bìa/nhãn truyện.
 */
export const MANGA_PALETTE: readonly string[] = [
  "#000000", // đen mực
  "#2b2b2b", // xám 1
  "#575757", // xám 2
  "#828282", // xám 3
  "#adadad", // xám 4
  "#d6d6d6", // xám 5
  "#ffffff", // trắng giấy
  "#a32222", // son đỏ
  "#d96a6a", // hồng nhạt
  "#4f7fbf", // xanh mực
  "#7fb8e0", // xanh lơ
  "#3f7f5f", // xanh rêu
  "#8a5a2b", // nâu đất
  "#d8b23f", // vàng giấy
  "#7a4fa3", // tím mực
  "#e89a3c", // cam đất
];

/**
 * Thuộc tính mặc định **riêng của từng công cụ** (BR-T01): đổi công cụ thì giữ
 * màu, nhưng nét trở về mặc định của công cụ đó. `smoothing` mặc định 35 cho
 * các công cụ vẽ tay (BR-T03); tẩy mặc định `clear` (BR-T04).
 */
export const DEFAULT_SETTINGS: Record<DrawTool, ToolSettings> = {
  pen: {
    size: 3,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 35,
    eraserMode: "clear",
  },
  brush: {
    size: 16,
    opacity: 100,
    flow: 55,
    hardness: 35,
    smoothing: 45,
    eraserMode: "clear",
  },
  eraser: {
    size: 24,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 35,
    eraserMode: "clear",
  },
  fill: {
    size: 3,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
  select: {
    size: 1,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
  shape: {
    size: 3,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
  text: {
    size: 4,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
  pan: {
    size: 3,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
  eyedropper: {
    size: 3,
    opacity: 100,
    flow: 100,
    hardness: 100,
    smoothing: 0,
    eraserMode: "clear",
  },
};

/** Kẹp size về 1–200 và làm tròn; giá trị không hợp lệ → `SIZE_MIN`. */
export function clampSize(value: number): number {
  if (!Number.isFinite(value)) return SIZE_MIN;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(value)));
}

/** Kẹp phần trăm về 0–100 và làm tròn; giá trị không hợp lệ → 0. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Đổi size theo bước `delta` (AC-T2.4: `[`/`]` ±2, `Shift` ±10). */
export function adjustSize(size: number, delta: number): number {
  const base = Number.isFinite(size) ? size : SIZE_MIN;
  return clampSize(base + delta);
}

/** `#RRGGBB` hoặc `RRGGBB` (không phân biệt hoa/thường) → hợp lệ. */
export function isValidHex(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

/** Nhập tay → `#rrggbb`; sai định dạng → `null` (để UI giữ nguyên màu cũ). */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!isValidHex(trimmed)) return null;
  return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toLowerCase();
}

/**
 * Thuộc tính mặc định của công cụ (BR-T01) — trả về **bản sao** để chỗ gọi sửa
 * thoải mái mà không làm hỏng bảng mặc định dùng chung.
 */
export function defaultSettingsFor(tool: DrawTool): ToolSettings {
  return { ...(DEFAULT_SETTINGS[tool] ?? DEFAULT_SETTINGS.pen) };
}
