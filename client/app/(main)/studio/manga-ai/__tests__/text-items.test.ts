import { describe, expect, it } from "vitest";
import {
  createTextItem,
  DEFAULT_TEXT_STYLE,
  moveTextItem,
  resizeTextItem,
  textFontCss,
  textItemBox,
  withTextStyleDefaults,
  wrapTextLines,
  type TextItem,
} from "../lib/textItems";

const measure = (s: string) => s.length * 10; // 10px mỗi ký tự

function item(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: "t1",
    x: 0.1,
    y: 0.1,
    w: 0.45,
    text: "Xin chào",
    fontScale: 0.05,
    ...DEFAULT_TEXT_STYLE,
    ...overrides,
  };
}

describe("TextItem — tạo/dời/đổi bề rộng", () => {
  it("tạo item kẹp điểm neo trong khung và mang style được cấp", () => {
    const t = createTextItem("t1", 1.4, -0.2, "A", 0.05, {
      ...DEFAULT_TEXT_STYLE,
      fontWeight: 900,
    });
    expect(t.x).toBe(1);
    expect(t.y).toBe(0);
    expect(t.fontWeight).toBe(900);
  });

  it("dời bị kẹp ở biên 0..1", () => {
    const moved = moveTextItem(item(), -1, 5);
    expect(moved.x).toBe(0);
    expect(moved.y).toBe(1);
  });

  it("đổi bề rộng có sàn 0.12 và không vượt khung", () => {
    expect(resizeTextItem(item(), 0.01).w).toBe(0.12);
    expect(resizeTextItem(item(), 5).w).toBeCloseTo(0.9);
  });
});

describe("style chữ — font/đậm/nghiêng/viền", () => {
  it("textFontCss ghép đúng stack, weight và italic", () => {
    expect(textFontCss({ ...DEFAULT_TEXT_STYLE, fontId: "arial" }, 20)).toBe(
      '600 20px "Arial", sans-serif',
    );
    expect(
      textFontCss(
        { ...DEFAULT_TEXT_STYLE, italic: true, fontWeight: 900 },
        16,
      ),
    ).toContain("italic 900 16px");
  });

  it("bản ghi cũ thiếu style được bổ sung mặc định, giữ nội dung cũ", () => {
    const legacy = withTextStyleDefaults({
      id: "old",
      x: 0.2,
      y: 0.2,
      text: "chữ cũ",
      fontScale: 0.04,
      color: "#ff0000",
    } as Partial<TextItem> & { id: string });
    expect(legacy.color).toBe("#ff0000"); // màu cũ được giữ
    expect(legacy.fontWeight).toBe(DEFAULT_TEXT_STYLE.fontWeight);
    expect(legacy.align).toBe(DEFAULT_TEXT_STYLE.align);
    expect(legacy.w).toBe(0.45);
  });
});

describe("wrapTextLines — ngắt dòng cho khối chữ", () => {
  it("tôn trọng dấu xuống dòng có sẵn", () => {
    expect(wrapTextLines("dòng một\ndòng hai", 1000, measure)).toEqual([
      "dòng một",
      "dòng hai",
    ]);
  });

  it("ngắt theo bề rộng đo và giữ từ quá dài", () => {
    expect(wrapTextLines("một hai ba bốn", 70, measure)).toEqual([
      "một hai",
      "ba bốn",
    ]);
    expect(wrapTextLines("siêudàikhôngngắt được", 50, measure)).toEqual([
      "siêudàikhôngngắt",
      "được",
    ]);
  });
});

describe("textItemBox — hộp bao normalized", () => {
  it("cao theo số dòng × giãn dòng; rộng ít nhất bằng bề rộng khối", () => {
    const box = textItemBox(
      item({ text: "một hai ba bốn", w: 0.9, lineHeight: 1.25 }),
      100,
      200,
      measure,
    );
    // khối rộng 90px → "một hai" (70) + "ba bốn" ngắt dòng = 2 dòng
    // fontPx = 0.05*200 = 10 → cao = 2 * 10 * 1.25 = 25px
    expect(box.h).toBeCloseTo(25 / 200);
    expect(box.w).toBeCloseTo(0.9);
  });

  it("canvas suy biến → hộp rỗng", () => {
    expect(textItemBox(item(), 0, 100, measure)).toEqual({ w: 0, h: 0 });
  });
});
