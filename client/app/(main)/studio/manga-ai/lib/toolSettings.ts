/**
 * toolSettings — thuộc tính nét theo từng công cụ (BR-T01…BR-T04, AC-T2.1,
 * AC-T2.3, AC-T2.5). Module thuần: không React, không DOM, test trực tiếp được.
 */

import type { DrawTool } from "../data";
import type { GradientEnd, GradientShape } from "./gradient";
import type { SymmetryMode } from "./symmetry";

/** Chế độ của công cụ "Làm mờ / Làm sắc nét" (BRD T-1 #16). */
export type EffectMode = "blur" | "sharpen";

export const EFFECT_MODES: readonly EffectMode[] = ["blur", "sharpen"];

/** Nhãn chế độ công cụ Mờ / Sắc nét. */
const EFFECT_MODE_LABELS: Record<EffectMode, string> = {
  blur: "Làm mờ",
  sharpen: "Làm sắc nét",
};

export function effectModeLabel(mode: EffectMode): string {
  return EFFECT_MODE_LABELS[mode] ?? EFFECT_MODE_LABELS.blur;
}

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
  /** Trục đối xứng khi vẽ, `"off"` là vẽ thường (BRD T-1 #13). */
  symmetry: SymmetryMode;
  /** Đầu màu thứ hai của công cụ Gradient (BRD T-1 #11). */
  gradientEnd: GradientEnd;
  /** Cách trải màu của công cụ Gradient. */
  gradientShape: GradientShape;
  /** Độ cong của công cụ Đường cong, -100…+100 (BRD T-1 #15). */
  curveBow: number;
  /** Công cụ Mờ / Sắc nét: mỗi nhát làm mờ hay làm nét (BRD T-1 #16). */
  effectMode: EffectMode;
  /** Công cụ Mờ / Sắc nét: độ mạnh mỗi nhát, % (0–100). */
  effectStrength: number;
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
 * Bộ khung thuộc tính dùng chung (BR-T01): mỗi công cụ chỉ ghi lại phần **khác**
 * bộ khung, nên thêm công cụ mới không phải chép lại cả chục dòng giống nhau.
 */
const BASE_SETTINGS: ToolSettings = {
  size: 3,
  opacity: 100,
  flow: 100,
  hardness: 100,
  smoothing: 35,
  eraserMode: "clear",
  symmetry: "off",
  gradientEnd: "transparent",
  gradientShape: "linear",
  curveBow: 40,
  effectMode: "blur",
  effectStrength: 55,
};

/**
 * Thuộc tính mặc định **riêng của từng công cụ** (BR-T01): đổi công cụ thì giữ
 * màu, nhưng nét trở về mặc định của công cụ đó. `smoothing` mặc định 35 cho
 * các công cụ vẽ tay (BR-T03); tẩy mặc định `clear` (BR-T04).
 */
export const DEFAULT_SETTINGS: Record<DrawTool, ToolSettings> = {
  pen: { ...BASE_SETTINGS },
  brush: { ...BASE_SETTINGS, size: 16, flow: 55, hardness: 35, smoothing: 45 },
  eraser: { ...BASE_SETTINGS, size: 24 },
  fill: { ...BASE_SETTINGS, smoothing: 0 },
  select: { ...BASE_SETTINGS, size: 1, smoothing: 0 },
  shape: { ...BASE_SETTINGS, smoothing: 0 },
  text: { ...BASE_SETTINGS, size: 4, smoothing: 0 },
  pan: { ...BASE_SETTINGS, smoothing: 0 },
  eyedropper: { ...BASE_SETTINGS, smoothing: 0 },
  // ── Bộ công cụ mở rộng (Phase 3 slice D) ─────────────────────────────────
  line: { ...BASE_SETTINGS, smoothing: 0 },
  gradient: { ...BASE_SETTINGS, smoothing: 0 },
  airbrush: { ...BASE_SETTINGS, size: 48, flow: 40, hardness: 20, smoothing: 20 },
  // Công cụ Đối xứng là cọ có sẵn trục dọc (BRD T-1 #13)
  symmetry: {
    ...BASE_SETTINGS,
    size: 16,
    flow: 55,
    hardness: 35,
    smoothing: 45,
    symmetry: "vertical",
  },
  curve: { ...BASE_SETTINGS, smoothing: 0 },
  effect: { ...BASE_SETTINGS, size: 40, smoothing: 0, effectStrength: 55 },
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
