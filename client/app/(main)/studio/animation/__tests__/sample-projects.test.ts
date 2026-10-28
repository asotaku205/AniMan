import { describe, expect, it } from "vitest";
import {
  SAMPLE_DIALOGUE_3D,
  buildSampleProject3D,
} from "../lib/sampleProjects";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";

describe("dự án mẫu 3D (quy trình làm phim mẫu)", () => {
  it("đủ 4 cảnh có model GLB, phong cảnh, chuyển động và thoại, không lỗi xuất bản", () => {
    const project = buildSampleProject3D();
    expect(project.kind).toBe("3d");
    expect(project.scenes).toHaveLength(4);
    for (const [index, scene] of project.scenes.entries()) {
      expect(scene.previz?.objects.length ?? 0).toBeGreaterThanOrEqual(7);
      expect(
        scene.previz?.objects.some((o) => o.kind === "model" && o.modelAssetId),
      ).toBe(true);
      expect(scene.dialogue?.length).toBe(1);
      expect(scene.dialogue?.[0].text).toBe(
        SAMPLE_DIALOGUE_3D[index]?.text,
      );
      expect(scene.environment).toBeDefined();
    }
    expect(project.scenes[1].previz?.objects.find((o) => o.name === "Mai")?.actions?.[0].clipName).toBe("Walk");
    expect(project.scenes[2].previz?.objects.find((o) => o.name === "Mai")?.actions?.[1].clipName).toBe("PickUp");
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
    for (const scene of p.scenes.slice(0, 2)) {
      for (const line of scene.dialogue ?? []) {
        expect(selectedDialogueTake(line)).not.toBeNull();
      }
    }
    expect(p.scenes.slice(2).every((scene) => scene.dialogue?.[0].takes == null)).toBe(true);
    expect(p.bgm?.name).toContain("Nhạc nền mẫu");
    expect(SAMPLE_VOICE_FILES.filter((e) => e.kind === "3d")).toHaveLength(2);
  });
});
