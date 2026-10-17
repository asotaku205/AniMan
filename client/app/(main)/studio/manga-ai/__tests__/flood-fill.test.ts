import { describe, expect, it } from "vitest";
import {
  floodFillPixels,
  maskFromAlpha,
  type FloodFillOptions,
} from "../lib/floodFill";

type Rgba = [number, number, number, number];
const WHITE: Rgba = [255, 255, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const RED: Rgba = [255, 0, 0, 255];

function canvasData(w: number, h: number, bg: Rgba = WHITE) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = bg[3];
  }
  return data;
}

function setPixel(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  rgba: Rgba,
) {
  const idx = (y * w + x) * 4;
  data[idx] = rgba[0];
  data[idx + 1] = rgba[1];
  data[idx + 2] = rgba[2];
  data[idx + 3] = rgba[3];
}

function pixelAt(data: Uint8ClampedArray, w: number, x: number, y: number): Rgba {
  const idx = (y * w + x) * 4;
  return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
}

describe("floodFillPixels (BR-T10)", () => {
  it("loang hết vùng cùng màu và dừng ở đường viền khác màu", () => {
    const w = 5;
    const h = 5;
    const data = canvasData(w, h);
    // Tường đen dọc theo x = 2
    for (let y = 0; y < h; y += 1) setPixel(data, w, 2, y, BLACK);

    const painted = floodFillPixels(data, w, h, 0, 0, RED);

    expect(painted).toBe(10); // cột x=0 và x=1
    expect(pixelAt(data, w, 1, 4)).toEqual(RED);
    expect(pixelAt(data, w, 2, 0)).toEqual(BLACK); // tường còn nguyên
    expect(pixelAt(data, w, 3, 0)).toEqual(WHITE); // bên kia tường chưa đổ
    expect(pixelAt(data, w, 4, 4)).toEqual(WHITE);
  });

  it("điểm bấm đã đúng màu đổ → không đổi gì (tránh undo rỗng)", () => {
    const data = canvasData(3, 3);
    expect(floodFillPixels(data, 3, 3, 1, 1, WHITE)).toBe(0);
  });

  it("điểm bấm ngoài khung → không đổi gì", () => {
    const data = canvasData(3, 3);
    expect(floodFillPixels(data, 3, 3, -1, 0, RED)).toBe(0);
    expect(floodFillPixels(data, 3, 3, 3, 0, RED)).toBe(0);
    expect(floodFillPixels(data, 3, 3, 0, 99, RED)).toBe(0);
  });

  it("tolerance quyết định pixel gần giống có bị gộp vào vùng hay không", () => {
    const make = () => {
      const data = canvasData(2, 1);
      setPixel(data, 2, 1, 0, [250, 250, 250, 255]);
      return data;
    };

    const tight = make();
    expect(floodFillPixels(tight, 2, 1, 0, 0, RED, { tolerance: 2 })).toBe(1);
    expect(pixelAt(tight, 2, 1, 0)).toEqual([250, 250, 250, 255]);

    const loose = make();
    expect(floodFillPixels(loose, 2, 1, 0, 0, RED, { tolerance: 36 })).toBe(2);
    expect(pixelAt(loose, 2, 1, 0)).toEqual(RED);
  });

  it("có mặt nạ vùng chọn: chỉ đổ trong vùng chọn, và không loang ra ngoài (BR-T10)", () => {
    const w = 5;
    const h = 5;
    const data = canvasData(w, h);
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) mask[y * w + x] = 1;
    }

    const painted = floodFillPixels(data, w, h, 0, 0, RED, { mask });

    expect(painted).toBe(4);
    expect(pixelAt(data, w, 1, 1)).toEqual(RED);
    expect(pixelAt(data, w, 2, 0)).toEqual(WHITE); // ngoài vùng chọn
    expect(pixelAt(data, w, 0, 2)).toEqual(WHITE);
  });

  it("mặt nạ không đúng chỗ bấm → không đổ gì", () => {
    const w = 3;
    const h = 3;
    const data = canvasData(w, h);
    const mask = new Uint8Array(w * h);
    mask[0] = 1; // chỉ pixel (0,0)
    expect(floodFillPixels(data, w, h, 2, 2, RED, { mask })).toBe(0);
  });

  it("không truyền mặt nạ thì loang toàn khung", () => {
    const data = canvasData(3, 3);
    const options: FloodFillOptions = {};
    expect(floodFillPixels(data, 3, 3, 0, 0, RED, options)).toBe(9);
  });

  it("khung rỗng → không đổi gì", () => {
    expect(floodFillPixels(new Uint8ClampedArray(0), 0, 0, 0, 0, RED)).toBe(0);
  });
});

describe("maskFromAlpha", () => {
  it("pixel đục → 1, pixel trong suốt → 0", () => {
    const data = new Uint8ClampedArray(3 * 4);
    data[3] = 255; // pixel 0 đục
    data[7] = 0; // pixel 1 trong suốt
    data[11] = 1; // pixel 2 mờ nhẹ vẫn tính là trong vùng chọn
    expect(Array.from(maskFromAlpha(data, 3))).toEqual([1, 0, 1]);
  });
});
