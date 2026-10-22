import { describe, expect, it } from "vitest";
import {
  createBubble,
  moveBubble,
  resizeBubble,
  wrapBubbleText,
} from "../lib/bubbles";

describe("SpeechBubble — tạo/dời/đổi cỡ (Slice 5)", () => {
  it("tạo bong bóng mặc định nằm trong khung, có đuôi", () => {
    const b = createBubble("b1");
    expect(b.x + b.w).toBeLessThanOrEqual(1);
    expect(b.y + b.h).toBeLessThanOrEqual(1);
    expect(b.tail).not.toBeNull();
  });

  it("dời bị kẹp ở biên khung", () => {
    const b = createBubble("b1");
    const moved = moveBubble(b, -1, 5);
    expect(moved.x).toBe(0);
    expect(moved.y).toBeCloseTo(1 - b.h);
  });

  it("đổi cỡ có sàn tối thiểu và không vượt khung", () => {
    const b = createBubble("b1");
    expect(resizeBubble(b, 0.01, 0.01).w).toBe(0.08);
    const big = resizeBubble(b, 2, 2);
    expect(big.x + big.w).toBeLessThanOrEqual(1);
    expect(big.y + big.h).toBeLessThanOrEqual(1);
  });
});

describe("wrapBubbleText — ngắt dòng theo bề rộng đo", () => {
  const measure = (s: string) => s.length * 10; // 10px mỗi ký tự

  it("ngắt khi dòng vượt bề rộng", () => {
    expect(wrapBubbleText("một hai ba bốn", 70, measure)).toEqual([
      "một hai",
      "ba bốn",
    ]);
  });

  it("chuỗi rỗng → một dòng rỗng; từ dài hơn dòng được giữ nguyên", () => {
    expect(wrapBubbleText("   ", 70, measure)).toEqual([""]);
    expect(wrapBubbleText("siêudàikhôngngắt được", 50, measure)).toEqual([
      "siêudàikhôngngắt",
      "được",
    ]);
  });
});
