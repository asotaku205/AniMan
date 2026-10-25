import { describe, expect, it } from "vitest";
import {
  EXPORT_PRESETS,
  exportPresetOf,
  resolveExportSize,
} from "../lib/exportPresets";

describe("kiểu xuất phim", () => {
  it("phim ngắn: ngang 16:9, độ phân giải 720p, 30 khung/giây", () => {
    expect(resolveExportSize("short-16x9")).toEqual({
      width: 1280,
      height: 720,
      fps: 30,
    });
  });

  it("MV: dọc 9:16, độ phân giải 720x1280", () => {
    const size = resolveExportSize("mv-9x16");
    expect(size.width).toBeLessThan(size.height);
    expect(size).toEqual({ width: 720, height: 1280, fps: 30 });
  });

  it("quảng cáo: ngang 720p, không màn hình tiêu đề mặc định", () => {
    expect(resolveExportSize("ad-30s")).toEqual({
      width: 1280,
      height: 720,
      fps: 30,
    });
    expect(EXPORT_PRESETS["ad-30s"].titleCard).toBe(false);
  });

  it("dự án cũ chưa có kiểu xuất thì mặc định phim ngắn 16:9", () => {
    expect(exportPresetOf({})).toBe("short-16x9");
    expect(exportPresetOf({ exportPreset: "mv-9x16" })).toBe("mv-9x16");
  });
});
