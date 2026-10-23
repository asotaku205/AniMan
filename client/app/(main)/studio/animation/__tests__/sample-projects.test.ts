import { describe, expect, it } from "vitest";
import {
  SAMPLE_DIALOGUE_3D,
  buildSampleProject3D,
} from "../lib/sampleProjects";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";

describe("dự án mẫu 3D (quy trình làm phim mẫu)", () => {
  it("đủ 2 cảnh dùng phong cảnh + nhân vật thư viện, có thoại, không lỗi xuất bản", () => {
    const project = buildSampleProject3D();
    expect(project.kind).toBe("3d");
    expect(project.scenes).toHaveLength(2);
    for (const scene of project.scenes) {
      expect(scene.previz?.objects.length ?? 0).toBeGreaterThanOrEqual(5);
      expect(
        scene.previz?.objects.some((o) => o.kind === "character"),
      ).toBe(true);
      expect(scene.dialogue?.length).toBe(1);
      expect(scene.dialogue?.[0].text).toBe(
        SAMPLE_DIALOGUE_3D.find((d) => d.scene === scene.name)?.text,
      );
    }
    // Nhân vật đi ngang phải quay mặt theo hướng đi (bài học từ phim mẫu)
    const street = project.scenes[1];
    const walker = street.previz?.objects.find((o) => o.name === "Linh");
    expect(walker?.keys[0].rotationY).toBe(90);
    const issues = checkProjectForExport(project);
    expect(hasExportErrors(issues)).toBe(false);
  });
});

describe("dự án mẫu có sẵn tiếng", () => {
  it("mọi dòng thoại mẫu đều có bản thu được chọn + dự án có nhạc nền mẫu", async () => {
    const { buildSampleProject3D, SAMPLE_VOICE_FILES } = await import(
      "../lib/sampleProjects"
    );
    const { selectedDialogueTake } = await import("../lib/dialogue");
    const p = buildSampleProject3D();
    for (const scene of p.scenes) {
      for (const line of scene.dialogue ?? []) {
        expect(selectedDialogueTake(line)).not.toBeNull();
      }
    }
    expect(p.bgm?.name).toContain("Nhạc nền mẫu");
    expect(SAMPLE_VOICE_FILES.filter((e) => e.kind === "3d")).toHaveLength(2);
  });
});
