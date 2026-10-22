import { describe, expect, it } from "vitest";
import {
  createTextItem,
  moveTextItem,
  textItemBox,
  wrapTextLines,
  type TextItem,
} from "../lib/textItems";

const measure = (s: string) => s.length * 10; // 10px mỗi ký tự

function item(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: "t1",
    x: 0.1,
    y: 0.1,
    text: "Xin chào",
    fontScale: 0.05,
    color: "#111111",
    ...overrides,
  };
}

describe("TextItem — tạo/dời (chữ dạng đối tượng)", () => {
  it("tạo item kẹp điểm neo trong khung", () => {
    const t = createTextItem("t1", 1.4, -0.2, "A", 0.05, "#000");
    expect(t.x).toBe(1);
    expect(t.y).toBe(0);
  });

  it("dời bị kẹp ở biên 0..1", () => {
    const moved = moveTextItem(item(), -1, 5);
    expect(moved.x).toBe(0);
    expect(moved.y).toBe(1);
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
  it("rộng theo dòng dài nhất, cao theo số dòng", () => {
    const box = textItemBox(item({ text: "một hai ba bốn" }), 100, 200, measure);
    // fontPx = 0.05*200 = 10 → mỗi dòng cao 12.5px; bề rộng tối đa còn lại 90px
    // → "một hai" (70px) + "ba bốn" (60px) = 2 dòng
    expect(box.w).toBeCloseTo(0.7);
    expect(box.h).toBeCloseTo((2 * 12.5) / 200);
  });

  it("canvas suy biến → hộp rỗng", () => {
    expect(textItemBox(item(), 0, 100, measure)).toEqual({ w: 0, h: 0 });
  });
});
