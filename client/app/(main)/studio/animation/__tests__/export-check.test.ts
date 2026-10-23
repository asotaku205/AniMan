import { describe, expect, it } from "vitest";
import { addScene, createAnimProject, updateScene } from "../lib/animProject";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";
import { createSceneLayer, createSceneTimeline } from "../lib/timeline";

describe("exportCheck — kiểm tra trước xuất", () => {
  it("dự án rỗng cảnh → lỗi; cảnh 2D chưa layer → lỗi đen khung", () => {
    const empty = createAnimProject("E", "2d");
    empty.scenes = [];
    expect(hasExportErrors(checkProjectForExport(empty))).toBe(true);

    const p = createAnimProject("X", "2d");
    const noLayers = updateScene(p, p.scenes[0].id, {
      timeline: { layers: [], cameraKeys: [] },
    });
    const issues = checkProjectForExport(noLayers);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("cảnh chỉ thẻ màu → cảnh báo; có hình + thoại gọn trong cảnh → sạch", () => {
    let p = createAnimProject("X", "2d");
    const timeline = createSceneTimeline();
    p = updateScene(p, p.scenes[0].id, { timeline });
    let issues = checkProjectForExport(p);
    expect(issues.some((i) => i.message.includes("thẻ màu"))).toBe(true);

    const layer = createSceneLayer("Hình", "#000");
    layer.imageDataUrl = "data:image/png;base64,AAAA";
    p = updateScene(p, p.scenes[0].id, {
      timeline: { layers: [layer], cameraKeys: [] },
      dialogue: [
        {
          id: "d1",
          text: "Xin chào",
          startSec: 0.3,
          durationSec: 1.5,
          takes: [{ id: "t1", durationSec: 1.4, volume: 1, createdAt: 1 }],
          selectedTakeId: "t1",
        },
      ],
    });
    issues = checkProjectForExport(p);
    expect(hasExportErrors(issues)).toBe(false);
    expect(issues).toHaveLength(0);

    // Bỏ bản thu → xuất hiện cảnh báo thiếu tiếng (không phải lỗi chặn)
    p = updateScene(p, p.scenes[0].id, {
      dialogue: [
        { id: "d1", text: "Xin chào", startSec: 0.3, durationSec: 1.5 },
      ],
    });
    issues = checkProjectForExport(p);
    expect(issues.some((i) => i.message.includes("chưa có bản thu giọng"))).toBe(true);
    expect(hasExportErrors(issues)).toBe(false);
  });

  it("thoại tràn khỏi cảnh và cảnh 3D trống → cảnh báo/lỗi đúng loại", () => {
    let p = createAnimProject("Y", "2d");
    p = updateScene(p, p.scenes[0].id, {
      timeline: createSceneTimeline(),
      dialogue: [
        { id: "d1", text: "Câu rất dài", startSec: 2.5, durationSec: 2 },
      ],
    });
    const issues = checkProjectForExport(p);
    expect(issues.some((i) => i.message.includes("vượt thời lượng cảnh"))).toBe(
      true,
    );

    const p3 = createAnimProject("Z", "3d");
    const bare = { ...p3, scenes: p3.scenes.map((s) => ({ ...s, previz: { objects: [], cameraKeys: [], backdrop: "#000" } })) };
    const issues3 = checkProjectForExport(bare);
    expect(issues3.some((i) => i.level === "error" && i.message.includes("3D"))).toBe(true);
  });

  it("addScene giữ nguyên khả năng kiểm tra (không crash với cảnh mặc định)", () => {
    const p = addScene(createAnimProject("W", "3d"), "Mở đầu");
    expect(() => checkProjectForExport(p)).not.toThrow();
  });
});

describe("exportCheck — kiểm tra không gian 3D (Slice B6)", () => {
  it("vật thể lơ lửng + camera không hướng vào vật thể → cảnh báo", async () => {
    const { createPrevizScene, vec3 } = await import("../lib/previz");
    let p = createAnimProject("S", "3d");
    const previz = createPrevizScene();
    // Nhân vật bay lên 2m ở key duy nhất
    previz.objects[0].keys[0].position = vec3(0, 2, 0);
    // Camera nhìn về hướng ngược hẳn
    previz.cameraKeys[0].position = vec3(0, 1.6, 6);
    previz.cameraKeys[0].target = vec3(0, 1.6, 20);
    p = updateScene(p, p.scenes[0].id, { previz });
    const issues = checkProjectForExport(p);
    expect(issues.some((i) => i.message.includes("lơ lửng"))).toBe(true);
    expect(issues.some((i) => i.message.includes("khung hình có thể trống"))).toBe(
      true,
    );
  });

  it("cảnh 3D bình thường → không cảnh báo không gian", async () => {
    const { createPrevizScene } = await import("../lib/previz");
    let p = createAnimProject("S2", "3d");
    p = updateScene(p, p.scenes[0].id, { previz: createPrevizScene() });
    const issues = checkProjectForExport(p);
    expect(issues.some((i) => i.message.includes("lơ lửng"))).toBe(false);
    expect(issues.some((i) => i.message.includes("dưới mặt đất"))).toBe(false);
    expect(issues.some((i) => i.message.includes("khung hình có thể trống"))).toBe(
      false,
    );
  });
});
