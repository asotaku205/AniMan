import { describe, expect, it } from "vitest";
import {
  buildGradient,
  gradientEndLabel,
  gradientShapeLabel,
  gradientStops,
  GRADIENT_ENDS,
  GRADIENT_SHAPES,
  parseHexColor,
  type GradientCtx,
} from "../lib/gradient";

/** `ctx` giả ghi lại lời gọi tạo dải chuyển sắc. */
function recorder(): { ctx: GradientCtx; calls: string[]; stops: string[] } {
  const calls: string[] = [];
  const stops: string[] = [];
  const gradient = {
    addColorStop: (at: number, color: string) => stops.push(`${at}:${color}`),
  } as unknown as CanvasGradient;
  const ctx: GradientCtx = {
    createLinearGradient: (x0, y0, x1, y1) => {
      calls.push(`linear ${x0},${y0},${x1},${y1}`);
      return gradient;
    },
    createRadialGradient: (x0, y0, r0, x1, y1, r1) => {
      calls.push(`radial ${x0},${y0},${r0},${x1},${y1},${r1}`);
      return gradient;
    },
  };
  return { ctx, calls, stops };
}

describe("gradientStops (BRD T-1 #11: hai đầu màu)", () => {
  it("đầu trong suốt giữ đúng hệ màu của màu đang vẽ với alpha 0", () => {
    expect(gradientStops("#ff8800", "transparent")).toEqual({
      from: "#ff8800",
      to: "rgba(255, 136, 0, 0)",
    });
  });

  it("đầu trắng / đen", () => {
    expect(gradientStops("#123456", "white").to).toBe("#ffffff");
    expect(gradientStops("#123456", "black").to).toBe("#000000");
    expect(gradientStops("#123456", "white").from).toBe("#123456");
  });

  it("mọi lựa chọn đầu màu và kiểu trải đều có nhãn", () => {
    for (const end of GRADIENT_ENDS) expect(gradientEndLabel(end).length).toBeGreaterThan(0);
    for (const shape of GRADIENT_SHAPES) {
      expect(gradientShapeLabel(shape).length).toBeGreaterThan(0);
    }
  });
});

describe("parseHexColor", () => {
  it("nhận 3 và 6 ký tự, có hay không dấu #", () => {
    expect(parseHexColor("#f80")).toEqual([255, 136, 0]);
    expect(parseHexColor("#ff8800")).toEqual([255, 136, 0]);
    expect(parseHexColor("00ff00")).toEqual([0, 255, 0]);
  });

  it("mã hỏng → đen (không để dải màu vỡ)", () => {
    expect(parseHexColor("red")).toEqual([0, 0, 0]);
    expect(parseHexColor("")).toEqual([0, 0, 0]);
    expect(parseHexColor("#12345")).toEqual([0, 0, 0]);
  });
});

describe("buildGradient", () => {
  it("kiểu ngang dọc: hai đầu dừng đúng màu, đúng trục kéo", () => {
    const { ctx, calls, stops } = recorder();
    buildGradient(ctx, "linear", { x: 1, y: 2 }, { x: 30, y: 40 }, "#000000", "white");
    expect(calls).toEqual(["linear 1,2,30,40"]);
    expect(stops).toEqual(["0:#000000", "1:#ffffff"]);
  });

  it("kiểu toả tròn: tâm ở điểm bắt đầu, bán kính bằng độ dài cú kéo", () => {
    const { ctx, calls } = recorder();
    buildGradient(ctx, "radial", { x: 5, y: 5 }, { x: 55, y: 5 }, "#000000", "white");
    expect(calls).toEqual(["radial 5,5,0,5,5,50"]);
  });

  it("cú kéo dài 0 vẫn ra bán kính tối thiểu 1 (không lỗi canvas)", () => {
    const { ctx, calls } = recorder();
    buildGradient(ctx, "radial", { x: 7, y: 7 }, { x: 7, y: 7 }, "#000000", "black");
    expect(calls).toEqual(["radial 7,7,0,7,7,1"]);
  });
});
