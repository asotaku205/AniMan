import { describe, expect, it } from "vitest";
import { buildTemplateProject } from "../lib/projectTemplates";
import { projectDurationSec } from "../lib/animProject";

describe("mẫu dự án phim", () => {
  it("phim ngắn: đúng 3 cảnh 3D, mỗi cảnh có camera", () => {
    const p = buildTemplateProject("short-3scenes");
    expect(p.kind).toBe("3d");
    expect(p.scenes).toHaveLength(3);
    for (const s of p.scenes) {
      expect((s.previz?.cameraKeys ?? []).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("quảng cáo: tổng đúng 30 giây", () => {
    const p = buildTemplateProject("ad");
    expect(projectDurationSec(p)).toBe(30);
    expect(p.exportPreset).toBe("ad-30s");
  });

  it("MV: kiểu xuất dọc 9:16, cảnh có chữ chạy dưới", () => {
    const p = buildTemplateProject("mv");
    expect(p.exportPreset).toBe("mv-9x16");
    expect(p.scenes.some((s) => !!s.lowerThird)).toBe(true);
  });
});
