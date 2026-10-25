/**
 * Kiểu xuất phim (giai đoạn D): mỗi kiểu đặt sẵn khổ khung, độ phân
 * giải, tốc độ khung hình và hậu kỳ mặc định. Chọn kiểu xuất sẽ đặt
 * lại hậu kỳ mặc định đó — chỉnh lại sau nếu muốn.
 */

import type { ColorGrade, TransitionType } from "./postFx";

export type ExportPresetId = "short-16x9" | "mv-9x16" | "ad-30s";

export interface ExportPreset {
  id: ExportPresetId;
  label: string;
  desc: string;
  width: number;
  height: number;
  /** Tốc độ khung hình ghi hình (khung/giây). */
  fps: number;
  transition: TransitionType;
  grade: ColorGrade;
  titleCard: boolean;
}

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPreset> = {
  "short-16x9": {
    id: "short-16x9",
    label: "Phim ngắn 16:9",
    desc: "Khung ngang điện ảnh, 720p, 30 khung/giây.",
    width: 1280,
    height: 720,
    fps: 30,
    transition: "crossfade",
    grade: "cinema",
    titleCard: true,
  },
  "mv-9x16": {
    id: "mv-9x16",
    label: "MV dọc 9:16",
    desc: "Khung dọc cho điện thoại, 720x1280, 30 khung/giây.",
    width: 720,
    height: 1280,
    fps: 30,
    transition: "crossfade",
    grade: "fresh",
    titleCard: true,
  },
  "ad-30s": {
    id: "ad-30s",
    label: "Quảng cáo 30s",
    desc: "Khung ngang 720p, 30 khung/giây, không màn hình tiêu đề.",
    width: 1280,
    height: 720,
    fps: 30,
    transition: "fade",
    grade: "fresh",
    titleCard: false,
  },
};

export const EXPORT_PRESET_LIST: ExportPreset[] = [
  EXPORT_PRESETS["short-16x9"],
  EXPORT_PRESETS["mv-9x16"],
  EXPORT_PRESETS["ad-30s"],
];

/** Kiểu xuất hiệu lực của dự án (dự án cũ chưa có thì mặc định phim ngắn). */
export function exportPresetOf(project: {
  exportPreset?: ExportPresetId;
}): ExportPresetId {
  return project.exportPreset ?? "short-16x9";
}

/** Khổ khung + tốc độ khung hình của một kiểu xuất. */
export function resolveExportSize(presetId: ExportPresetId): {
  width: number;
  height: number;
  fps: number;
} {
  const p = EXPORT_PRESETS[presetId] ?? EXPORT_PRESETS["short-16x9"];
  return { width: p.width, height: p.height, fps: p.fps };
}
