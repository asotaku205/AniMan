import { describe, expect, it } from "vitest";
import {
  createSceneLayer,
  createSceneTimeline,
} from "../lib/timeline";
import { layerAtPoint, stageToWorld } from "../lib/stageHitTest";

function timelineWithLayers() {
  const tl = createSceneTimeline();
  const back = createSceneLayer("Nền");
  back.keys = [
    { id: "a", timeSec: 0, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 }, easing: "linear" },
  ];
  const front = createSceneLayer("Nhân vật");
  front.keys = [
    { id: "b", timeSec: 0, transform: { x: 0.3, y: 0.5, scale: 0.6, rotation: 0, opacity: 1 }, easing: "linear" },
  ];
  tl.layers = [back, front];
  tl.cameraKeys = [];
  return tl;
}

describe("tương tác sân khấu 2D (S3)", () => {
  it("bấm trúng layer trên cùng tại điểm chạm; ngoài hộp thì trượt", () => {
    const tl = timelineWithLayers();
    expect(layerAtPoint(tl, 0, { x: 0.3, y: 0.5 })?.name).toBe("Nhân vật");
    expect(layerAtPoint(tl, 0, { x: 0.75, y: 0.5 })?.name).toBe("Nền");
    expect(layerAtPoint(tl, 0, { x: 0.97, y: 0.03 })).toBeNull();
  });

  it("chiếu ngược qua camera: zoom 2x thì điểm rìa quay về tâm thế giới", () => {
    const tl = timelineWithLayers();
    tl.cameraKeys = [
      { id: "c", timeSec: 0, camera: { x: 0.5, y: 0.5, zoom: 2 }, easing: "linear" },
    ];
    const world = stageToWorld(tl, 0, { x: 1, y: 0.5 });
    expect(world.x).toBeCloseTo(0.75);
    expect(world.y).toBeCloseTo(0.5);
  });
});
