/**
 * drawSceneFrame vẽ nét frame từng khung: kiểm chứng bằng ctx ghi giả
 * (Proxy ghi lại mọi lệnh vẽ), không cần canvas thật. Hai frame vẽ số
 * điểm khác nhau để phân biệt frame nào đang được vẽ.
 */
import { describe, expect, it } from "vitest";
import { createAnimScene } from "../lib/animProject";
import { createSceneTimeline } from "../lib/timeline";
import { drawSceneFrame } from "../lib/renderFrame";
import type { DrawStroke } from "../lib/drawStrokes";

interface Call {
  name: string;
  args: unknown[];
}

function makeFakeCtx() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    shadowColor: "",
    shadowBlur: 0,
  };
  const ctx = new Proxy(state, {
    get(t, prop) {
      if (prop in t) return t[prop as string];
      if (prop === "calls") return calls;
      return (...args: unknown[]) => {
        calls.push({ name: String(prop), args });
      };
    },
    set(t, prop, v) {
      t[prop as string] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D & { calls: Call[] };
  return ctx;
}

function stroke(id: string, color: string, pointCount: number): DrawStroke {
  const points = Array.from({ length: pointCount }, (_, i) => ({
    x: 0.1 + i * 0.05,
    y: 0.1 + i * 0.05,
  }));
  return { id, tool: "pen", color, widthPx: 4, points };
}

function sceneWithFrames() {
  const scene = createAnimScene("Cảnh vẽ frame", 3);
  const timeline = createSceneTimeline();
  const layer = timeline.layers[0];
  scene.timeline = timeline;
  scene.frameDrawings = [
    {
      id: "f0",
      frame: 0,
      layerId: layer.id,
      strokes: [stroke("s0", "#ff0000", 2)],
      isKeyPose: false,
    },
    {
      id: "f12",
      frame: 12,
      layerId: layer.id,
      strokes: [stroke("s12", "#0000ff", 3)],
      isKeyPose: true,
      note: "giơ tay",
    },
  ];
  return scene;
}

function lineToCount(ctx: CanvasRenderingContext2D & { calls: Call[] }) {
  return ctx.calls.filter((c) => c.name === "lineTo").length;
}

describe("drawSceneFrame - nét vẽ từng khung", () => {
  it("vẽ nét frame 0 ở t = 0, giữ hình tới frame 12, đổi nét ở frame 12", () => {
    const scene = sceneWithFrames();
    const getImage = () => null;

    // Frame 0: nét 2 điểm -> 1 lệnh lineTo.
    const ctx0 = makeFakeCtx();
    drawSceneFrame(ctx0, scene, 0, 960, 540, getImage, { fps: 12 });
    expect(lineToCount(ctx0)).toBe(1);

    // t = 0.5s là frame 6 (12fps): giữ hình, vẫn nét frame 0.
    const ctx6 = makeFakeCtx();
    drawSceneFrame(ctx6, scene, 0.5, 960, 540, getImage, { fps: 12 });
    expect(lineToCount(ctx6)).toBe(1);

    // t = 1s là frame 12: nét 3 điểm -> 2 lệnh lineTo.
    const ctx12 = makeFakeCtx();
    drawSceneFrame(ctx12, scene, 1, 960, 540, getImage, { fps: 12 });
    expect(lineToCount(ctx12)).toBe(2);
  });

  it("fps quyết định frame tại cùng một thời điểm", () => {
    const scene = sceneWithFrames();
    const getImage = () => null;
    // t = 0.5s: 12fps là frame 6 (giữ nét frame 0, 1 lineTo),
    // 24fps là frame 12 (nét frame 12, 2 lineTo).
    const ctx12 = makeFakeCtx();
    drawSceneFrame(ctx12, scene, 0.5, 960, 540, getImage, { fps: 12 });
    expect(lineToCount(ctx12)).toBe(1);
    const ctx24 = makeFakeCtx();
    drawSceneFrame(ctx24, scene, 0.5, 960, 540, getImage, { fps: 24 });
    expect(lineToCount(ctx24)).toBe(2);
  });

  it("cảnh không có frame drawing thì không vẽ thêm nét nào", () => {
    const scene = createAnimScene("Cảnh trống", 3);
    scene.timeline = createSceneTimeline();
    const ctx = makeFakeCtx();
    drawSceneFrame(ctx, scene, 0.5, 960, 540, () => null, { fps: 12 });
    expect(ctx.calls.filter((c) => c.name === "moveTo").length).toBe(0);
    expect(lineToCount(ctx)).toBe(0);
  });
});
