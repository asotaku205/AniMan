import { describe, expect, it } from "vitest";
import {
  PAGE_DRAWING_SCHEMA_VERSION,
  migrateStoredPageToStacks,
  normalizePanelStacks,
} from "../lib/mangaStorage";
import { createAiLayer, createDefaultPanelStack, createUserLayer } from "../data";

describe("Schema v2 — kiểu dữ liệu (spec 02 §3.1)", () => {
  it("đúng phiên bản 2", () => {
    expect(PAGE_DRAWING_SCHEMA_VERSION).toBe(2);
  });

  it("createDefaultPanelStack: 4 layer người dùng, active = lớp trên cùng", () => {
    const stack = createDefaultPanelStack("p1");
    expect(stack.panelId).toBe("p1");
    expect(stack.layers).toHaveLength(4);
    expect(stack.layers.every((l) => l.kind === "user")).toBe(true);
    expect(stack.activeLayerId).toBe(stack.layers[0].id);
    expect(stack.pixels).toEqual({});
  });
});

describe("migrateStoredPageToStacks — đọc bản ghi v1 (spec 02 §3.2)", () => {
  it("v1 không có layers meta → mỗi panel 1 layer mặc định 'Sketch', pixel giao layer đó", () => {
    const stacks = migrateStoredPageToStacks({
      panels: { p1: "data:image/png;base64,AAA", p2: "data:image/png;base64,BBB" },
    });

    expect(Object.keys(stacks)).toEqual(["p1", "p2"]);
    const s = stacks.p1;
    expect(s.panelId).toBe("p1");
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0].name).toBe("Sketch (Phác thảo)");
    expect(s.layers[0].kind).toBe("user");
    expect(s.pixels[s.layers[0].id]).toBe("data:image/png;base64,AAA");
    expect(s.activeLayerId).toBe(s.layers[0].id);
  });

  it("v1 có layers meta → dùng meta (chuẩn hoá v2), pixel giao layer người dùng đầu tiên", () => {
    const stacks = migrateStoredPageToStacks({
      panels: { p1: "URL1" },
      // shape legacy (thiếu kind/blend/createdAt)
      layers: [
        { id: "a1", name: "Sketch", visible: true, locked: false, opacity: 50 },
        { id: "a2", name: "Ink", visible: false, locked: true },
      ],
      activeLayerId: "a2",
    });

    const s = stacks.p1;
    expect(s.layers.map((l) => l.id)).toEqual(["a1", "a2"]);
    expect(s.layers[0].kind).toBe("user");
    expect(s.layers[0].opacity).toBe(50);
    expect(s.layers[0].blend).toBe("normal");
    expect(s.pixels).toEqual({ a1: "URL1" });
    expect(s.activeLayerId).toBe("a2");
  });

  it("activeLayerId không tồn tại trong layers → fallback về layer đầu tiên", () => {
    const stacks = migrateStoredPageToStacks({
      panels: { p1: "U" },
      layers: [{ id: "x", name: "X", visible: true, locked: false }],
      activeLayerId: "ghost",
    });
    expect(stacks.p1.activeLayerId).toBe("x");
  });

  it("layer AI đầu danh sách không nhận pixel — pixel về layer người dùng đầu tiên", () => {
    const stacks = migrateStoredPageToStacks({
      panels: { p1: "U" },
      layers: [createAiLayer("AI test"), { id: "u1", name: "Ink", visible: true, locked: false }],
    });
    expect(stacks.p1.layers[0].kind).toBe("ai");
    expect(stacks.p1.pixels).toEqual({ u1: "U" });
  });

  it("mỗi panel có mảng/đối tượng layer RIÊNG (không dùng chung tham chiếu)", () => {
    const stacks = migrateStoredPageToStacks({
      panels: { p1: "U1", p2: "U2" },
      layers: [{ id: "a1", name: "Sketch", visible: true, locked: false }],
    });
    expect(stacks.p1.layers).not.toBe(stacks.p2.layers);
    expect(stacks.p1.layers[0]).not.toBe(stacks.p2.layers[0]);
  });

  it("panels rỗng hoặc thiếu → không có stack nào", () => {
    expect(migrateStoredPageToStacks({})).toEqual({});
    expect(migrateStoredPageToStacks({ panels: {} })).toEqual({});
  });
});

describe("normalizePanelStacks — đọc bản ghi v2 (spec 02 §3.1)", () => {
  it("bản ghi hợp lệ → giữ nguyên nội dung", () => {
    const raw = {
      p1: {
        panelId: "p1",
        layers: [createUserLayer("Ink (Đi nét)", { id: "l2" })],
        activeLayerId: "l2",
        pixels: { l2: "URL" },
        aiOverlay: {
          strokes: [{ id: "s1" }],
          summary: "gợi ý",
          generatedAt: 123,
          model: "gemini-flash-latest",
        },
      },
    };

    const out = normalizePanelStacks(raw);
    expect(out.p1.panelId).toBe("p1");
    expect(out.p1.layers[0].name).toBe("Ink (Đi nét)");
    expect(out.p1.activeLayerId).toBe("l2");
    expect(out.p1.pixels).toEqual({ l2: "URL" });
    expect(out.p1.aiOverlay?.strokes).toHaveLength(1);
    expect(out.p1.aiOverlay?.model).toBe("gemini-flash-latest");
  });

  it("activeLayerId trỏ sai → sửa về layer đầu tiên; pixel mồ côi bị loại", () => {
    const out = normalizePanelStacks({
      p1: {
        panelId: "p1",
        layers: [{ id: "l1", name: "A", visible: true, locked: false }],
        activeLayerId: "ghost",
        pixels: { l1: "U1", ghost: "U2" },
      },
    });
    expect(out.p1.activeLayerId).toBe("l1");
    expect(out.p1.pixels).toEqual({ l1: "U1" });
  });

  it("bỏ entry hỏng: layers rỗng, giá trị không phải object, aiOverlay thiếu strokes", () => {
    const out = normalizePanelStacks({
      pEmpty: { panelId: "pEmpty", layers: [] },
      pString: "not-an-object",
      pBadAi: {
        panelId: "pBadAi",
        layers: [{ id: "l1", name: "A", visible: true, locked: false }],
        aiOverlay: { strokes: "not-an-array" },
      },
      nullEntry: null,
    });
    expect(out.pEmpty).toBeUndefined();
    expect(out.pString).toBeUndefined();
    expect(out.nullEntry).toBeUndefined();
    expect(out.pBadAi.aiOverlay).toBeUndefined();
    expect(out.pBadAi.layers).toHaveLength(1);
  });

  it("input không phải object → {}", () => {
    expect(normalizePanelStacks(undefined)).toEqual({});
    expect(normalizePanelStacks(null)).toEqual({});
    expect(normalizePanelStacks("x")).toEqual({});
  });
});
