import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOVEL_DISPLAY,
  loadNovelDisplaySettings,
  sanitizeNovelDisplaySettings,
} from "../lib/novelDisplay";

describe("novelDisplay — chuẩn hoá cài đặt", () => {
  it("không có storage thì trả mặc định", () => {
    expect(loadNovelDisplaySettings()).toEqual(DEFAULT_NOVEL_DISPLAY);
  });

  it("giữ giá trị hợp lệ, rơi về mặc định khi giá trị lạ", () => {
    expect(
      sanitizeNovelDisplaySettings({
        theme: "dark",
        fontSize: "xxl",
        lineHeight: "relaxed",
        outlineMode: "book",
      }),
    ).toEqual({
      theme: "dark",
      fontSize: "xl",
      lineHeight: "relaxed",
      outlineMode: "book",
    });
  });

  it("dữ liệu rỗng/lỗi thì trả toàn mặc định", () => {
    expect(sanitizeNovelDisplaySettings(null)).toEqual(DEFAULT_NOVEL_DISPLAY);
    expect(sanitizeNovelDisplaySettings("giấy")).toEqual(
      DEFAULT_NOVEL_DISPLAY,
    );
  });
});
