import { describe, expect, it } from "vitest";
import {
  createAiLayer,
  createUserLayer,
  normalizeLayer,
  normalizeLayers,
} from "../data";

describe("createUserLayer", () => {
  it("điền đủ mọi trường v2 (BR-L01)", () => {
    const layer = createUserLayer("Sketch");
    expect(layer).toMatchObject({
      name: "Sketch",
      kind: "user",
      visible: true,
      locked: false,
      opacity: 100,
      blend: "normal",
    });
    expect(typeof layer.createdAt).toBe("number");
    expect(layer.createdAt).toBeGreaterThan(0);
    expect(layer.id).toBeTruthy();
  });

  it("tạo id duy nhất cho 2 layer liên tiếp", () => {
    const a = createUserLayer("A");
    const b = createUserLayer("B");
    expect(a.id).not.toBe(b.id);
  });

  it("cho phép override id/opacity/blend nhưng không đổi được kind", () => {
    const layer = createUserLayer("Ink", {
      id: "l2",
      opacity: 40,
      blend: "multiply",
      kind: "ai",
    });
    // createUserLayer là factory người dùng — kind luôn là "user"
    expect(layer.kind).toBe("user");
    expect(layer.id).toBe("l2");
    expect(layer.opacity).toBe(40);
    expect(layer.blend).toBe("multiply");
  });
});

describe("createAiLayer", () => {
  it("luôn là layer AI chỉ đọc, bị khóa (bất biến AI không ghi pixel)", () => {
    const layer = createAiLayer();
    expect(layer.kind).toBe("ai");
    expect(layer.readOnly).toBe(true);
    expect(layer.locked).toBe(true);
  });

  it("không thể override kind/readOnly từ bên ngoài", () => {
    const layer = createAiLayer("AI", {
      kind: "user",
      readOnly: false,
      locked: false,
    });
    expect(layer.kind).toBe("ai");
    expect(layer.readOnly).toBe(true);
    expect(layer.locked).toBe(true);
  });
});

describe("normalizeLayer (đọc dữ liệu Schema v1)", () => {
  it("nâng cấp layer cũ thiếu kind/blend/createdAt về dạng user", () => {
    const legacy = {
      id: "l1",
      name: "Sketch",
      visible: false,
      locked: true,
      opacity: 55,
    };
    expect(normalizeLayer(legacy)).toMatchObject({
      id: "l1",
      name: "Sketch",
      kind: "user",
      visible: false,
      locked: true,
      opacity: 55,
      blend: "normal",
    });
  });

  it("giữ nguyên kind ai và readOnly của layer AI đã lưu", () => {
    const ai = {
      id: "ai-1",
      name: "AI",
      kind: "ai",
      visible: true,
      locked: false,
      opacity: 80,
    };
    expect(normalizeLayer(ai)).toMatchObject({
      kind: "ai",
      readOnly: true,
      opacity: 80,
    });
  });

  it("trả về null với dữ liệu thiếu id/name hoặc không phải object", () => {
    expect(normalizeLayer(null)).toBeNull();
    expect(normalizeLayer("x")).toBeNull();
    expect(normalizeLayer({ name: "thiếu id" })).toBeNull();
    expect(normalizeLayer({ id: "l1" })).toBeNull();
  });
});

describe("normalizeLayers", () => {
  it("bỏ mọi phần tử không hợp lệ, giữ thứ tự", () => {
    const raw = [
      { id: "l1", name: "A", visible: true, locked: false },
      null,
      "rác",
      { id: "l2", name: "B", visible: true, locked: false },
    ];
    const layers = normalizeLayers(raw);
    expect(layers.map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("trả về mảng rỗng khi input không phải mảng", () => {
    expect(normalizeLayers(undefined)).toEqual([]);
    expect(normalizeLayers({})).toEqual([]);
  });
});
