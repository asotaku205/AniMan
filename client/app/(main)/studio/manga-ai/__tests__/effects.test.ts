import { describe, expect, it } from "vitest";
import {
  blurRadiusForSize,
  boxBlurRGBA,
  sharpenAmountForStrength,
  sharpenRGBA,
} from "../lib/effects";

/** Mảng RGBA đặc một màu. */
function solid(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

/** Pixel tại (x, y) → [r, g, b, a]. */
function px(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): number[] {
  const i = (y * width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

/** Nửa trái đen, nửa phải sáng (biên dọc ở giữa) để thử mờ / làm nét. */
function halfSplit(width = 16, height = 4): Uint8ClampedArray {
  const data = solid(width, height, 0, 0, 0, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = width / 2; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  return data;
}

describe("boxBlurRGBA (công cụ Làm mờ — BRD T-1 #16)", () => {
  it("ảnh đặc một màu thì mờ xong vẫn nguyên màu", () => {
    const data = solid(8, 8, 40, 80, 120, 255);
    boxBlurRGBA(data, 8, 8, 2, 2);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(px(data, 8, x, y)).toEqual([40, 80, 120, 255]);
      }
    }
  });

  it("vùng trong suốt vẫn trong suốt (nhân trước alpha nên không bị quầng đen)", () => {
    const data = solid(9, 9, 0, 0, 0, 0);
    boxBlurRGBA(data, 9, 9, 2, 2);
    expect(px(data, 9, 4, 4)).toEqual([0, 0, 0, 0]);
  });

  it("biên đen/trắng bị san đều về hai phía", () => {
    const width = 16;
    const data = halfSplit(width);
    boxBlurRGBA(data, width, 4, 2, 2);
    const [left] = px(data, width, width / 2 - 2, 1);
    const [right] = px(data, width, width / 2 + 1, 1);
    expect(left).toBeGreaterThan(0);
    expect(right).toBeLessThan(255);
  });

  it("bán kính < 1 hoặc cỡ hỏng thì không đụng vào dữ liệu", () => {
    const data = solid(4, 4, 10, 20, 30, 255);
    const before = Array.from(data);
    boxBlurRGBA(data, 4, 4, 0, 2);
    boxBlurRGBA(data, 0, 0, 3, 2);
    expect(Array.from(data)).toEqual(before);
  });
});

describe("sharpenRGBA (công cụ Làm sắc nét)", () => {
  it("tăng chênh lệch quanh biên: phía tối tối hơn, phía sáng sáng hơn", () => {
    const width = 12;
    const data = halfSplit(width);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        // Nền xám 100 / 140 để thấy rõ tăng giảm
        if (data[i] === 0) {
          data[i] = 100;
          data[i + 1] = 100;
          data[i + 2] = 100;
        } else {
          data[i] = 140;
          data[i + 1] = 140;
          data[i + 2] = 140;
        }
      }
    }
    sharpenRGBA(data, width, 4, 1);
    const [leftEdge] = px(data, width, width / 2 - 1, 1);
    const [rightEdge] = px(data, width, width / 2, 1);
    expect(leftEdge).toBeLessThan(100);
    expect(rightEdge).toBeGreaterThan(140);
  });

  it("amount = 0 (hoặc âm) → giữ nguyên ảnh", () => {
    const data = halfSplit();
    const before = Array.from(data);
    sharpenRGBA(data, 16, 4, 0);
    sharpenRGBA(data, 16, 4, -1);
    expect(Array.from(data)).toEqual(before);
  });
});

describe("tham số suy ra cho công cụ hiệu ứng", () => {
  it("blurRadiusForSize: càng to càng mạnh, kẹp 1…24", () => {
    expect(blurRadiusForSize(0)).toBe(1);
    expect(blurRadiusForSize(8)).toBe(1);
    expect(blurRadiusForSize(80)).toBe(10);
    expect(blurRadiusForSize(100000)).toBe(24);
    expect(blurRadiusForSize(80)).toBeGreaterThan(blurRadiusForSize(40));
  });

  it("sharpenAmountForStrength: 0…1.5 theo thanh trượt", () => {
    expect(sharpenAmountForStrength(0)).toBe(0);
    expect(sharpenAmountForStrength(-5)).toBe(0);
    expect(sharpenAmountForStrength(100)).toBeCloseTo(1.5);
    expect(sharpenAmountForStrength(50)).toBeCloseTo(0.75);
  });
});
