import { describe, expect, it } from "vitest";
import {
  addScene,
  createAnimProject,
  createAnimScene,
  duplicateScene,
  formatDuration,
  moveScene,
  projectDurationSec,
  removeScene,
  updateScene,
} from "../lib/animProject";

describe("AnimProject — tạo dự án", () => {
  it("dự án mang loại hình đã chọn và có sẵn cảnh đầu tiên", () => {
    const p = createAnimProject("Phim của tôi", "3d");
    expect(p.kind).toBe("3d");
    expect(p.scenes).toHaveLength(1);
    expect(p.fps).toBe(24);
    expect(p.sourceMangaProjectId).toBeNull();
  });

  it("tên trống → tên mặc định theo loại hình; gắn nguồn manga khi được cấp", () => {
    const p = createAnimProject("  ", "2d", { sourceMangaProjectId: "m1" });
    expect(p.name).toContain("2D");
    expect(p.sourceMangaProjectId).toBe("m1");
  });

  it("cảnh kẹp thời lượng trong [0.5, 120] giây", () => {
    expect(createAnimScene("A", 0.1).durationSec).toBe(0.5);
    expect(createAnimScene("A", 999).durationSec).toBe(120);
  });
});

describe("AnimProject — thao tác cảnh", () => {
  it("thêm/xoá/nhân đôi cảnh giữ đúng thứ tự và id riêng", () => {
    let p = createAnimProject("X", "2d");
    p = addScene(p, "Cảnh B");
    expect(p.scenes.map((s) => s.name)).toEqual(["Cảnh 1", "Cảnh B"]);
    const dup = duplicateScene(p, p.scenes[0].id);
    expect(dup.scenes).toHaveLength(3);
    expect(dup.scenes[1].name).toContain("bản sao");
    expect(dup.scenes[1].id).not.toBe(dup.scenes[0].id);
    const removed = removeScene(dup, dup.scenes[1].id);
    expect(removed.scenes.map((s) => s.name)).toEqual(["Cảnh 1", "Cảnh B"]);
  });

  it("dời cảnh đổi thứ tự phát; dời ở biên là no-op", () => {
    let p = createAnimProject("X", "2d");
    p = addScene(p, "B");
    const moved = moveScene(p, p.scenes[1].id, -1);
    expect(moved.scenes.map((s) => s.name)).toEqual(["B", "Cảnh 1"]);
    expect(moveScene(p, p.scenes[0].id, -1)).toBe(p);
  });

  it("cập nhật cảnh kẹp lại thời lượng", () => {
    const p = createAnimProject("X", "2d");
    const next = updateScene(p, p.scenes[0].id, { durationSec: 500 });
    expect(next.scenes[0].durationSec).toBe(120);
  });

  it("tổng thời lượng và định dạng m:ss", () => {
    let p = createAnimProject("X", "2d");
    p = addScene(p, "B");
    p = updateScene(p, p.scenes[1].id, { durationSec: 62 });
    expect(projectDurationSec(p)).toBe(65);
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(9)).toBe("0:09");
  });
});
