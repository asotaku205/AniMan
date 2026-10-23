import { describe, expect, it } from "vitest";
import {
  createPrevizObject,
  createPrevizScene,
  poseById,
  samplePrevizCamera,
  samplePrevizObject,
  upsertPrevizKey,
  vec3,
} from "../lib/previz";
import { videoGenStatus, VIDEO_GEN_PROVIDERS } from "../lib/videoGen";

describe("previz — nội suy vật thể & pose", () => {
  it("đi bộ: vị trí nội suy tuyến tính, pose trung gian nằm giữa 2 pose", () => {
    const obj = createPrevizObject("character", "A");
    obj.keys = [
      { id: "k1", timeSec: 0, position: vec3(0, 0, 0), rotationY: 0, poseId: "stand", easing: "linear" },
      { id: "k2", timeSec: 2, position: vec3(4, 0, 0), rotationY: 90, poseId: "walk", easing: "linear" },
    ];
    const mid = samplePrevizObject(obj, 1);
    expect(mid.position.x).toBeCloseTo(2);
    expect(mid.rotationY).toBeCloseTo(45);
    const stand = poseById("stand");
    const walk = poseById("walk");
    expect(mid.pose.legL).toBeCloseTo((stand.legL + walk.legL) / 2);
    // Ngoài khoảng: giữ key biên
    expect(samplePrevizObject(obj, -1).position.x).toBe(0);
    expect(samplePrevizObject(obj, 99).position.x).toBe(4);
  });

  it("upsert ghi đè key cùng thời điểm", () => {
    const obj = createPrevizObject("box", "B");
    const keys = upsertPrevizKey(obj.keys, {
      id: "k9",
      timeSec: 0,
      position: vec3(1, 2, 3),
      rotationY: 10,
      poseId: "stand",
      easing: "linear",
    });
    expect(keys).toHaveLength(1);
    expect(keys[0].position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("camera mặc định của cảnh mới hợp lệ và nội suy được", () => {
    const scene = createPrevizScene();
    const cam = samplePrevizCamera(scene.cameraKeys, 0);
    expect(cam.position.z).toBeGreaterThan(0);
    expect(scene.objects[0].kind).toBe("character");
  });
});

describe("videoGen — cổng sinh video AI (Lớp B)", () => {
  it("bản demo chưa có provider → trạng thái chưa kết nối, nói rõ lý do", () => {
    expect(VIDEO_GEN_PROVIDERS).toHaveLength(0);
    const status = videoGenStatus();
    expect(status.connected).toBe(false);
    expect(status.label).toContain("Chưa kết nối");
  });
});
