import { describe, expect, it } from "vitest";
import {
  createBubbleShape,
  moveBubbleShape,
  resizeBubbleShape,
  shoutPoints,
} from "../lib/bubbleShapes";

describe("BubbleShape — hình bóng mẫu", () => {
  it("khung thoại (rect) mặc định không đuôi, các mẫu khác có đuôi", () => {
    expect(createBubbleShape("s1", "rect").tail).toBeNull();
    expect(createBubbleShape("s2", "ellipse").tail).not.toBeNull();
    expect(createBubbleShape("s3", "thought").tail).not.toBeNull();
    expect(createBubbleShape("s4", "shout").tail).not.toBeNull();
  });

  it("dời bị kẹp trong khung và đuôi đi theo thân", () => {
    const s = createBubbleShape("s1", "ellipse");
    const moved = moveBubbleShape(s, 5, 5);
    expect(moved.x).toBeCloseTo(1 - s.w);
    expect(moved.y).toBeCloseTo(1 - s.h);
    expect(moved.tail!.x).toBeGreaterThan(s.tail!.x);
    expect(moved.tail!.y).toBeGreaterThan(s.tail!.y);
  });

  it("đổi cỡ có sàn và không vượt khung", () => {
    const s = createBubbleShape("s1", "ellipse");
    expect(resizeBubbleShape(s, 0.01, 0.01).w).toBe(0.1);
    const big = resizeBubbleShape(s, 5, 5);
    expect(big.x + big.w).toBeLessThanOrEqual(1);
    expect(big.y + big.h).toBeLessThanOrEqual(1);
  });

  it("shoutPoints: gấp đôi số gai, điểm ngoài xa tâm hơn điểm trong", () => {
    const pts = shoutPoints(100, 100, 50, 40, 8);
    expect(pts).toHaveLength(16);
    const outer = Math.hypot(pts[0].x - 100, pts[0].y - 100);
    const inner = Math.hypot(pts[1].x - 100, pts[1].y - 100);
    expect(outer).toBeGreaterThan(inner);
  });
});
