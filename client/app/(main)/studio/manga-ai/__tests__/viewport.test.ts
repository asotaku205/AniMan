import { describe, expect, it } from "vitest";
import {
  artworkToScreen,
  clampPan,
  clampScale,
  fitView,
  MAX_SCALE,
  MAX_ZOOM,
  MIN_SCALE,
  MIN_ZOOM,
  panBy,
  screenToArtwork,
  zoomAt,
} from "../lib/viewport";

/**
 * Test thuần, số viết tay (không suy từ code).
 * Quy ước: screen = artwork * scale + t.
 */

describe("fitView (letterbox mặc định — khớp RC-1)", () => {
  it("khung cùng tỉ lệ với ảnh → khít, không lệch", () => {
    const v = fitView(1200, 1600, 600, 800);
    expect(v.scale).toBeCloseTo(0.5, 10);
    expect(v.tx).toBeCloseTo(0, 10);
    expect(v.ty).toBeCloseTo(0, 10);
  });

  it("hộp rộng hơn ảnh → căn giữa theo trục ngang", () => {
    const v = fitView(1200, 1600, 800, 800);
    expect(v.scale).toBeCloseTo(0.5, 10);
    expect(v.tx).toBeCloseTo(100, 10);
    expect(v.ty).toBeCloseTo(0, 10);
  });

  it("kích thước <= 0 → view an toàn, không NaN/Infinity", () => {
    const v = fitView(1200, 1600, 0, 800);
    expect(Number.isFinite(v.scale)).toBe(true);
    expect(v.scale).toBe(1);
  });
});

describe("clampScale", () => {
  it("giá trị trong khoảng → giữ nguyên", () => {
    expect(clampScale(1, 0.1, 8)).toBe(1);
  });

  it("kẹp về biên dưới và biên trên", () => {
    expect(clampScale(0.01, 0.1, 8)).toBe(0.1);
    expect(clampScale(99, 0.1, 8)).toBe(8);
  });

  it("mặc định 1–8 (BR-T06 chốt 17/10: không thu nhỏ dưới khung vừa khít)", () => {
    expect(MIN_SCALE).toBe(1);
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(1000)).toBe(MAX_SCALE);
  });

  it("zoom tương đối không xuống dưới 100% khung vừa khít", () => {
    const fitScale = 0.5;
    expect(clampScale(0, fitScale * MIN_SCALE, fitScale * MAX_ZOOM)).toBe(0.5);
    expect(clampScale(0.4, fitScale * MIN_SCALE, fitScale * MAX_ZOOM)).toBe(0.5);
    expect(clampScale(9, fitScale * MIN_SCALE, fitScale * MAX_ZOOM)).toBe(4);
  });
});

describe("zoomAt (giữ điểm dưới con trỏ đứng yên)", () => {
  it("phóng to 2× quanh điểm (100,200)", () => {
    const v = zoomAt({ scale: 0.5, tx: 0, ty: 0 }, 2, 100, 200);
    expect(v.scale).toBeCloseTo(1, 10);
    expect(v.tx).toBeCloseTo(-100, 10);
    expect(v.ty).toBeCloseTo(-200, 10);
  });

  it("điểm artwork dưới con trỏ không đổi trước/sau khi zoom", () => {
    const before = { scale: 0.5, tx: 0, ty: 0 };
    const a = screenToArtwork(before, 100, 200);
    const after = zoomAt(before, 2, 100, 200);
    const a2 = screenToArtwork(after, 100, 200);
    expect(a2.x).toBeCloseTo(a.x, 10);
    expect(a2.y).toBeCloseTo(a.y, 10);
  });

  it("kẹp theo min/max truyền vào (fitScale × 1..8)", () => {
    const v = zoomAt({ scale: 4, tx: 0, ty: 0 }, 10, 10, 10, 0.1, 8);
    expect(v.scale).toBe(8);
  });
});

describe("panBy", () => {
  it("dịch gốc theo screen px, không đổi scale", () => {
    expect(panBy({ scale: 0.5, tx: 0, ty: 0 }, 10, -5)).toEqual({
      scale: 0.5,
      tx: 10,
      ty: -5,
    });
  });
});

describe("clampPan (không hở khoảng trắng)", () => {
  it("ảnh nhỏ hơn khung → ép căn giữa", () => {
    expect(clampPan(50, -30, 400, 300, 600, 300)).toEqual({ x: 0, y: 0 });
  });

  it("ảnh lớn hơn khung → đi xa nhất là vừa chạm biên", () => {
    // ảnh 1000×800 trong khung 600×400 → lệch ngang tối đa 200, dọc tối đa 200
    expect(clampPan(999, -999, 1000, 800, 600, 400)).toEqual({
      x: 200,
      y: -200,
    });
    expect(clampPan(-50, 20, 1000, 800, 600, 400)).toEqual({ x: -50, y: 20 });
  });

  it("ảnh đúng bằng khung → không cho lệch", () => {
    expect(clampPan(10, 10, 600, 400, 600, 400)).toEqual({ x: 0, y: 0 });
  });

  it("giá trị không hợp lệ → coi như 0", () => {
    expect(clampPan(NaN, Infinity, 600, 400, 600, 400)).toEqual({ x: 0, y: 0 });
  });
});

describe("screenToArtwork / artworkToScreen", () => {
  it("ánh xạ đúng theo view = { scale 2, t (30,-40) }", () => {
    const v = { scale: 2, tx: 30, ty: -40 };
    expect(artworkToScreen(v, 15, 25)).toEqual({ x: 60, y: 10 });
  });

  it("nghịch đảo của nhau", () => {
    const v = { scale: 2, tx: 30, ty: -40 };
    const s = artworkToScreen(v, 15, 25);
    const a = screenToArtwork(v, s.x, s.y);
    expect(a.x).toBeCloseTo(15, 10);
    expect(a.y).toBeCloseTo(25, 10);
  });
});
