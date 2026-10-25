import { describe, expect, it } from "vitest";
import {
  CAMERA_DRAFT_EPS,
  resolveShotCamera,
} from "../lib/cameraDraft";
import type { PrevizCameraKey } from "../lib/previz";

const keys: PrevizCameraKey[] = [
  {
    id: "k1",
    timeSec: 0,
    position: { x: 0, y: 1.6, z: 6 },
    target: { x: 0, y: 1.1, z: 0 },
    easing: "ease-in-out",
  },
  {
    id: "k2",
    timeSec: 4,
    position: { x: 4, y: 1.6, z: 6 },
    target: { x: 0, y: 1.1, z: 0 },
    easing: "ease-in-out",
  },
];

const draft = {
  draftPos: { x: 9, y: 9, z: 9 },
  draftTarget: { x: 1, y: 2, z: 3 },
};

describe("resolveShotCamera — bản nháp camera chỉ áp tại giây đã sửa", () => {
  it("không có nháp thì lấy đúng key đã lưu tại thời điểm đó", () => {
    const cam = resolveShotCamera({
      draftDirty: false,
      draftTimeSec: 2,
      ...draft,
      keys,
      timeSec: 0,
    });
    expect(cam.position).toEqual({ x: 0, y: 1.6, z: 6 });
  });

  it("có nháp và đang đúng giây đã sửa thì dùng bản nháp", () => {
    const cam = resolveShotCamera({
      draftDirty: true,
      draftTimeSec: 2,
      ...draft,
      keys,
      timeSec: 2,
    });
    expect(cam.position).toEqual({ x: 9, y: 9, z: 9 });
    expect(cam.target).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("có nháp nhưng rê sang giây khác thì quay về key đã lưu", () => {
    const cam = resolveShotCamera({
      draftDirty: true,
      draftTimeSec: 2,
      ...draft,
      keys,
      timeSec: 0,
    });
    expect(cam.position).toEqual({ x: 0, y: 1.6, z: 6 });
  });

  it("sai số nhỏ quanh giây đã sửa vẫn tính là đúng giây đó", () => {
    const cam = resolveShotCamera({
      draftDirty: true,
      draftTimeSec: 2,
      ...draft,
      keys,
      timeSec: 2 + CAMERA_DRAFT_EPS / 2,
    });
    expect(cam.position).toEqual({ x: 9, y: 9, z: 9 });
  });

  it("không có key nào thì về góc mặc định dù có nháp ở giây khác", () => {
    const cam = resolveShotCamera({
      draftDirty: true,
      draftTimeSec: 2,
      ...draft,
      keys: [],
      timeSec: 0,
    });
    expect(cam.position).toEqual({ x: 0, y: 1.6, z: 6 });
  });
});
