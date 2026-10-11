import { describe, expect, it } from "vitest";
import {
  blendToComposite,
  buildCompositePlan,
  layerAlpha,
  layerCanvasSize,
} from "../lib/layerEngine";
import { createUserLayer, createAiLayer, type LayerItem } from "../data";

/** Canvas giả — engine thuần không đọc nội dung pixel, chỉ dùng identity. */
const fakeCanvas = (id: string) => ({ id }) as unknown as HTMLCanvasElement;

function layer(overrides: Partial<LayerItem> & { id: string }): LayerItem {
  return { ...createUserLayer(overrides.id, overrides), ...overrides };
}

describe("layerAlpha (AC-L1.3)", () => {
  it("opacity 100 → alpha 1, 50 → 0,5, 0 → 0", () => {
    expect(layerAlpha(100)).toBe(1);
    expect(layerAlpha(50)).toBe(0.5);
    expect(layerAlpha(0)).toBe(0);
  });

  it("clamp về 0..1 với giá trị ngoài khoảng", () => {
    expect(layerAlpha(250)).toBe(1);
    expect(layerAlpha(-20)).toBe(0);
  });
});

describe("blendToComposite (RC-4)", () => {
  it("map LayerBlend → globalCompositeOperation của Canvas", () => {
    expect(blendToComposite("normal")).toBe("source-over");
    expect(blendToComposite("multiply")).toBe("multiply");
    expect(blendToComposite("screen")).toBe("screen");
    expect(blendToComposite("overlay")).toBe("overlay");
    expect(blendToComposite("darken")).toBe("darken");
    expect(blendToComposite("lighten")).toBe("lighten");
  });
});

describe("layerCanvasSize (RC-1)", () => {
  it("kích thước canvas = kích thước khung × devicePixelRatio", () => {
    expect(layerCanvasSize(400, 300, 2)).toEqual({
      width: 800,
      height: 600,
      scale: 2,
    });
  });

  it("dpr không hợp lệ → co về tối thiểu 1", () => {
    expect(layerCanvasSize(400, 300, 0)).toEqual({
      width: 400,
      height: 300,
      scale: 1,
    });
    expect(layerCanvasSize(400, 300, Number.NaN).scale).toBe(1);
  });
});

describe("buildCompositePlan (AC-L1.1–L1.4)", () => {
  const A = layer({ id: "a" }); // index 0 — lớp trên cùng
  const B = layer({ id: "b" });
  const C = layer({ id: "c" }); // index cuối — lớp dưới đáy
  const sources = new Map<string, HTMLCanvasElement>([
    ["a", fakeCanvas("a")],
    ["b", fakeCanvas("b")],
    ["c", fakeCanvas("c")],
  ]);
  const get = (id: string) => sources.get(id);

  it("vẽ từ dưới đáy lên: index 0 vẽ sau cùng (nằm trên tất cả)", () => {
    const plan = buildCompositePlan([A, B, C], get);
    expect(plan.map((op) => op.layerId)).toEqual(["c", "b", "a"]);
    expect(plan.map((op) => op.order)).toEqual([0, 1, 2]);
  });

  it("bỏ layer ẩn (visible=false) khỏi lần render", () => {
    const plan = buildCompositePlan(
      [A, { ...B, visible: false }, C],
      get,
    );
    expect(plan.map((op) => op.layerId)).toEqual(["c", "a"]);
  });

  it("mỗi layer có alpha đúng theo opacity của nó", () => {
    const plan = buildCompositePlan(
      [{ ...A, opacity: 40 }, B, { ...C, opacity: 100 }],
      get,
    );
    const byId = Object.fromEntries(plan.map((op) => [op.layerId, op.alpha]));
    expect(byId).toEqual({ a: 0.4, b: 1, c: 1 });
  });

  it("layer không có bitmap (chưa vẽ) bị bỏ qua", () => {
    const plan = buildCompositePlan([A, B, C], get);
    const onlyA = buildCompositePlan(
      [A, B, C],
      (id) => (id === "a" ? sources.get("a") : undefined),
    );
    expect(plan).toHaveLength(3);
    // chỉ layer "a" có bitmap → b, c bị bỏ qua
    expect(onlyA.map((op) => op.layerId)).toEqual(["a"]);
  });

  it("layer kind:'ai' không tham gia composite (RC-5 — layer ảo)", () => {
    const ai = createAiLayer("AI test");
    const plan = buildCompositePlan([A, ai, C], get);
    expect(plan.map((op) => op.layerId)).toEqual(["c", "a"]);
    expect(plan.some((op) => op.layerId === ai.id)).toBe(false);
  });

  it("layer ẩn + không có bitmap + layer AI đều bị loại, giữ đúng thứ tự", () => {
    const ai = createAiLayer();
    const plan = buildCompositePlan(
      [A, { ...B, visible: false }, ai, C],
      get,
    );
    expect(plan.map((op) => op.layerId)).toEqual(["c", "a"]);
  });

  it("blend của từng layer được giữ nguyên trong plan", () => {
    const plan = buildCompositePlan(
      [{ ...A, blend: "multiply" }, B, { ...C, blend: "screen" }],
      get,
    );
    expect(plan.map((op) => op.blend)).toEqual([
      "screen",
      "source-over",
      "multiply",
    ]);
  });
});
