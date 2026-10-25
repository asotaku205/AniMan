import { describe, expect, it } from "vitest";
import {
  cameraBasis,
  clampCameraDrag,
  frustumCorners,
  frustumFar,
  frustumLineSegments,
  rayPlanePoint,
} from "../lib/cameraRigModel";

const POS = { x: 0, y: 1.6, z: 6 };
const TARGET = { x: 0, y: 1.1, z: 0 };

const approx = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);
const len = (v: { x: number; y: number; z: number }) =>
  Math.hypot(v.x, v.y, v.z);
const dot = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

describe("mô hình máy quay", () => {
  it("hướng máy: trục trước chỉ từ vị trí về điểm nhìn, 3 trục trực chuẩn", () => {
    const { forward, right, up } = cameraBasis(POS, TARGET);
    approx(len(forward), 1);
    approx(len(right), 1);
    approx(len(up), 1);
    approx(dot(forward, right), 0);
    approx(dot(forward, up), 0);
    approx(dot(right, up), 0);
    // Nhìn từ z = 6 về gốc: phải ≈ +X, trên ≈ +Y.
    expect(forward.z).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0.9);
    expect(up.y).toBeGreaterThan(0.9);
  });

  it("nhìn thẳng lên trời vẫn có trục phải (không suy biến)", () => {
    const { forward, right, up } = cameraBasis(
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 5, z: 0 },
    );
    approx(len(forward), 1);
    approx(len(right), 1);
    approx(len(up), 1);
    approx(dot(forward, right), 0);
  });

  it("góc khung chóp: tâm mặt gần/xa nằm trên trục nhìn, nửa cao đúng fov", () => {
    const fov = 45;
    const { near: nearRect, far: farRect } = frustumCorners(POS, TARGET, fov, 16 / 9, 0.3, 8);
    const near = nearRect.corners;
    const far = farRect.corners;
    const { forward } = cameraBasis(POS, TARGET);
    const center = (corners: typeof near, d: number) => {
      const m = {
        x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
        y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
        z: (corners[0].z + corners[1].z + corners[2].z + corners[3].z) / 4,
      };
      const expectCenter = {
        x: POS.x + forward.x * d,
        y: POS.y + forward.y * d,
        z: POS.z + forward.z * d,
      };
      approx(len(sub(m, expectCenter)), 0);
    };
    center(near, 0.3);
    center(far, 8);
    // Nửa cao mặt xa = tan(fov/2) * 8.
    const halfH = Math.tan(((fov / 2) * Math.PI) / 180) * 8;
    const topMid = {
      x: (far[0].x + far[1].x) / 2,
      y: (far[0].y + far[1].y) / 2,
      z: (far[0].z + far[1].z) / 2,
    };
    const farCenter = {
      x: (far[0].x + far[1].x + far[2].x + far[3].x) / 4,
      y: (far[0].y + far[1].y + far[2].y + far[3].y) / 4,
      z: (far[0].z + far[1].z + far[2].z + far[3].z) / 4,
    };
    approx(len(sub(topMid, farCenter)), halfH);
    // Tỉ lệ khung: nửa rộng = nửa cao * aspect.
    const rightMid = {
      x: (far[1].x + far[2].x) / 2,
      y: (far[1].y + far[2].y) / 2,
      z: (far[1].z + far[2].z) / 2,
    };
    approx(len(sub(rightMid, farCenter)), halfH * (16 / 9));
  });

  it("đoạn khung chóp: 12 đoạn (2 khung + 4 đường nối), nối đúng đỉnh", () => {
    const segs = frustumLineSegments(POS, TARGET, 45, 16 / 9, 0.3, 8);
    expect(segs).toHaveLength(12);
    const { near: nearRect, far: farRect } = frustumCorners(POS, TARGET, 45, 16 / 9, 0.3, 8);
    const near = nearRect.corners;
    const far = farRect.corners;
    // 4 đường nối phải nối đỉnh gần với đỉnh xa tương ứng.
    for (let i = 0; i < 4; i++) {
      const s = segs[8 + i];
      expect(s[0]).toEqual(near[i]);
      expect(s[1]).toEqual(far[i]);
    }
  });

  it("giao tia với mặt phẳng: trúng, song song thì null, quay lưng thì null", () => {
    const hit = rayPlanePoint(
      { x: 0, y: 0, z: 5 },
      { x: 0, y: 0, z: -1 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    );
    expect(hit).not.toBeNull();
    approx(hit!.x, 0);
    approx(hit!.y, 0);
    approx(hit!.z, 0);
    expect(
      rayPlanePoint(
        { x: 0, y: 0, z: 5 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ),
    ).toBeNull();
    expect(
      rayPlanePoint(
        { x: 0, y: 0, z: 5 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
      ),
    ).toBeNull();
  });

  it("kẹp vị trí kéo: x/z trong ±14, y trong 0.2..20", () => {
    expect(clampCameraDrag({ x: 20, y: 30, z: -20 })).toEqual({
      x: 14,
      y: 20,
      z: -14,
    });
    expect(clampCameraDrag({ x: 0, y: 0.05, z: 0 }).y).toBe(0.2);
    expect(clampCameraDrag({ x: 1, y: 2, z: 3 })).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("độ dài khung chóp: xa hơn điểm nhìn 2m, tối thiểu 4m", () => {
    approx(frustumFar(POS, TARGET), len(sub(TARGET, POS)) + 2);
    expect(frustumFar({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0.5 })).toBe(4);
  });
});
