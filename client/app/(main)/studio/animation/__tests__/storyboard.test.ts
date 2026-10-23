import { describe, expect, it } from "vitest";
import type { AnimScene } from "../lib/animProject";
import {
  projectProgress,
  sceneStatusMeta,
  sceneStatusOf,
} from "../lib/storyboard";

const scene = (patch: Partial<AnimScene>): AnimScene => ({
  id: Math.random().toString(36),
  name: "Cảnh",
  durationSec: 3,
  ...patch,
});

describe("trạng thái cảnh & tiến độ dự án (R5)", () => {
  it("cảnh chưa đặt trạng thái mặc định là Chưa làm", () => {
    expect(sceneStatusOf(scene({}))).toBe("todo");
    expect(sceneStatusMeta("todo").label).toBe("Chưa làm");
    expect(sceneStatusMeta("done").label).toBe("Hoàn thành");
  });

  it("đếm đúng từng trạng thái và phần trăm hoàn thành", () => {
    const prog = projectProgress([
      scene({ status: "done" }),
      scene({ status: "done" }),
      scene({ status: "doing" }),
      scene({}),
    ]);
    expect(prog.total).toBe(4);
    expect(prog.done).toBe(2);
    expect(prog.percent).toBe(50);
    expect(prog.counts).toEqual({
      todo: 1,
      doing: 1,
      review: 0,
      done: 2,
    });
  });

  it("dự án rỗng: tiến độ 0, không chia cho 0", () => {
    const prog = projectProgress([]);
    expect(prog.percent).toBe(0);
    expect(prog.total).toBe(0);
  });
});
