import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST,
  GRADE_FILTERS,
  TRANSITION_SEC,
  crossfadeBlend,
  fadeBlackAlpha,
} from "../lib/postFx";

describe("hậu kỳ bản xuất (Đ3)", () => {
  it("mặc định: hoà tan + có màn hình tiêu đề; bảng màu đủ 5 tông", () => {
    expect(DEFAULT_POST.transition).toBe("crossfade");
    expect(DEFAULT_POST.titleCard).toBe(true);
    expect(Object.keys(GRADE_FILTERS)).toHaveLength(5);
  });

  it("fade: mờ vào đầu cảnh giữa phim, mờ ra cuối cảnh, không mờ ở biên phim", () => {
    const post = { ...DEFAULT_POST, transition: "fade" as const };
    expect(fadeBlackAlpha(0, 5, false, false, post)).toBe(1);
    expect(fadeBlackAlpha(TRANSITION_SEC, 5, false, false, post)).toBe(0);
    expect(fadeBlackAlpha(5, 5, false, false, post)).toBe(1);
    expect(fadeBlackAlpha(0, 5, true, false, post)).toBe(0);
    expect(fadeBlackAlpha(5, 5, false, true, post)).toBe(0);
  });

  it("crossfade: chỉ cảnh từ thứ hai, giảm dần trong cửa sổ chuyển cảnh", () => {
    expect(crossfadeBlend(0, 0, DEFAULT_POST)).toBe(0);
    expect(crossfadeBlend(0, 1, DEFAULT_POST)).toBe(1);
    expect(crossfadeBlend(TRANSITION_SEC / 2, 1, DEFAULT_POST)).toBeCloseTo(0.5);
    expect(crossfadeBlend(TRANSITION_SEC, 1, DEFAULT_POST)).toBe(0);
  });

  it("không chuyển cảnh thì mọi hệ số đều 0", () => {
    const post = { ...DEFAULT_POST, transition: "none" as const };
    expect(crossfadeBlend(0, 2, post)).toBe(0);
    expect(fadeBlackAlpha(0, 5, false, false, post)).toBe(0);
  });
});
