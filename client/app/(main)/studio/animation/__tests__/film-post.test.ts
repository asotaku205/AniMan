import { describe, expect, it } from "vitest";
import { DEFAULT_SCENE_POST } from "../lib/scenePost";
import {
  effectiveFilmPost,
  filmPostActive,
  verticalFrame,
} from "../lib/filmPost";

describe("hậu kỳ cảnh khi xuất phim", () => {
  it("mặc định tắt hết → không có hậu kỳ", () => {
    expect(filmPostActive(DEFAULT_SCENE_POST)).toBe(false);
  });

  it("bật bất kỳ hiệu ứng nào → có hậu kỳ", () => {
    expect(
      filmPostActive({
        ...DEFAULT_SCENE_POST,
        bloom: { ...DEFAULT_SCENE_POST.bloom, enabled: true },
      }),
    ).toBe(true);
    expect(
      filmPostActive({
        ...DEFAULT_SCENE_POST,
        dof: { ...DEFAULT_SCENE_POST.dof, enabled: true },
      }),
    ).toBe(true);
    expect(
      filmPostActive({
        ...DEFAULT_SCENE_POST,
        afterimage: { ...DEFAULT_SCENE_POST.afterimage, enabled: true },
      }),
    ).toBe(true);
  });

  it("tắt công tắc hậu kỳ khi xuất → về mặc định tắt hết dù cảnh có bật", () => {
    const scene = {
      scenePost: {
        ...DEFAULT_SCENE_POST,
        bloom: { ...DEFAULT_SCENE_POST.bloom, enabled: true, strength: 2 },
      },
    };
    expect(effectiveFilmPost(scene, false)).toBe(DEFAULT_SCENE_POST);
    expect(filmPostActive(effectiveFilmPost(scene, false))).toBe(false);
  });

  it("bật công tắc → dùng đúng cài đặt đã kẹp của cảnh", () => {
    const scene = {
      scenePost: {
        ...DEFAULT_SCENE_POST,
        bloom: {
          ...DEFAULT_SCENE_POST.bloom,
          enabled: true,
          strength: 99,
          threshold: -1,
        },
      },
    };
    const post = effectiveFilmPost(scene, true);
    expect(post.bloom.enabled).toBe(true);
    expect(post.bloom.strength).toBe(3);
    expect(post.bloom.threshold).toBe(0);
  });
});

describe("khung dọc 9:16 trong trình dựng", () => {
  it("ô xem ngang 800x600 → khung dọc cao đúng 600, căn giữa", () => {
    const { frame, safe } = verticalFrame(800, 600);
    expect(frame.height).toBe(600);
    expect(frame.width).toBeCloseTo(337.5, 5);
    expect(frame.x).toBeCloseTo(231.25, 5);
    expect(frame.y).toBe(0);
    // Khung an toàn = khung trừ lề 5% mỗi phía.
    expect(safe.width).toBeCloseTo(frame.width * 0.9, 5);
    expect(safe.height).toBeCloseTo(frame.height * 0.9, 5);
    expect(safe.x).toBeCloseTo(frame.x + frame.width * 0.05, 5);
    expect(safe.y).toBeCloseTo(frame.y + frame.height * 0.05, 5);
  });

  it("ô xem dọc 400x800 → khung dọc rộng đúng 400, căn giữa theo chiều cao", () => {
    const { frame } = verticalFrame(400, 800);
    expect(frame.width).toBe(400);
    expect(frame.height).toBeCloseTo(711.111, 2);
    expect(frame.x).toBe(0);
    expect(frame.y).toBeCloseTo(44.444, 2);
  });

  it("kích thước không hợp lệ → khung rỗng", () => {
    expect(verticalFrame(0, 600).frame.width).toBe(0);
    expect(verticalFrame(800, 0).frame.height).toBe(0);
  });
});
