import { describe, expect, it } from "vitest";
import {
  MODEL_DEFS,
  clampGround,
  createPlacement,
  hexToGround,
  migrateLegacyWorld,
  rotatePlacement,
  snapToGrid,
  starterPlacements,
} from "../lib/diorama";

describe("lưới sa bàn", () => {
  it("snap 0.5 và kẹp trong mặt đất 40×40", () => {
    expect(snapToGrid(3.26)).toBe(3.5);
    expect(snapToGrid(3.24)).toBe(3);
    expect(clampGround(99)).toBe(19.5);
    expect(clampGround(-99)).toBe(-19.5);
  });

  it("ô hex cũ ánh xạ vào trong mặt đất", () => {
    const { x, z } = hexToGround(0, 0);
    expect(Math.abs(x)).toBeLessThanOrEqual(19.5);
    expect(Math.abs(z)).toBeLessThanOrEqual(19.5);
    const corner = hexToGround(13, 8);
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(19.5);
    expect(Math.abs(corner.z)).toBeLessThanOrEqual(19.5);
  });
});

describe("chuyển dữ liệu nhân vật cũ", () => {
  it("mỗi nhân vật thành 1 thực thể + 1 vật Nhân vật gắn đúng id", () => {
    const { entities, placements } = migrateLegacyWorld([
      { id: "c1", name: "Kira", role: "Chiến binh", traits: ["Dũng cảm"], backstory: "Xưa…", hexCol: 3, hexRow: 4, color: "#ef4444" },
      { id: "c2", name: "Luna", role: "Thương nhân", traits: [], backstory: "", hexCol: 4, hexRow: 3, color: "#f59e0b" },
    ]);
    expect(entities).toHaveLength(2);
    expect(placements).toHaveLength(2);
    expect(placements[0].modelId).toBe("character");
    expect(placements[0].storyEntityId).toBe("c1");
    expect(placements[0].name).toBe("Kira");
    expect(placements[1].storyEntityId).toBe("c2");
  });
});

describe("mẫu vật và vật khởi điểm", () => {
  it("mọi mẫu đều có ít nhất 1 chi tiết, màu hợp lệ, footprint dương", () => {
    for (const m of MODEL_DEFS) {
      expect(m.parts.length).toBeGreaterThan(0);
      expect(m.footprint).toBeGreaterThan(0);
      for (const part of m.parts) {
        expect(part.color === "__entity__" || /^#[0-9a-fA-F]{6}$/.test(part.color)).toBe(true);
      }
    }
  });

  it("vật khởi điểm nằm trong mặt đất; xoay thêm 45° mỗi lần", () => {
    for (const p of starterPlacements()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(19.5);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(19.5);
    }
    const p = createPlacement("house", 0, 0);
    expect(rotatePlacement(p).rotationY).toBeCloseTo(Math.PI / 4);
    expect(rotatePlacement(rotatePlacement(p)).rotationY).toBeCloseTo(Math.PI / 2);
  });
});

describe("đặc điểm và quan hệ của thực thể", () => {
  it("thêm/xoá đặc điểm, trùng và rỗng thì bỏ qua", async () => {
    const mod = await import("../lib/diorama");
    const base = {
      id: "e1", kind: "character", name: "Kira", role: "",
      traits: ["Dũng cảm"], description: "", color: "#ef4444", relations: [],
      customFields: [], design2d: { palette: [], expressions: [] },
    };
    expect(mod.addTrait(base, "Dũng cảm").traits).toEqual(["Dũng cảm"]);
    expect(mod.addTrait(base, "  ").traits).toEqual(["Dũng cảm"]);
    expect(mod.addTrait(base, "Kiên cường").traits).toEqual(["Dũng cảm", "Kiên cường"]);
    expect(mod.removeTrait(base, "Dũng cảm").traits).toEqual([]);
  });

  it("thêm quan hệ: ghi đè nhãn khi trùng, chặn tự quan hệ", async () => {
    const mod = await import("../lib/diorama");
    const base = {
      id: "e1", kind: "character", name: "Kira", role: "",
      traits: [], description: "", color: "#ef4444", relations: [],
      customFields: [], design2d: { palette: [], expressions: [] },
    };
    const withRel = mod.addRelation(base, "e2", "Bạn thân");
    expect(withRel.relations).toEqual([{ entityId: "e2", label: "Bạn thân" }]);
    expect(mod.addRelation(withRel, "e2", "Bạn chí cốt").relations).toEqual([
      { entityId: "e2", label: "Bạn chí cốt" },
    ]);
    expect(mod.addRelation(base, "e1", "Tôi").relations).toEqual([]);
    expect(mod.removeRelation(withRel, "e2").relations).toEqual([]);
  });
});

describe("W2: loại & trường tự do, thiết kế 2D, sự kiện, GLB", () => {
  it("entityKindLabel: loại chuẩn dịch, loại tự đặt giữ nguyên", async () => {
    const mod = await import("../lib/diorama");
    expect(mod.entityKindLabel("character")).toBe("Nhân vật");
    expect(mod.entityKindLabel("place")).toBe("Địa điểm");
    expect(mod.entityKindLabel("Quốc gia")).toBe("Quốc gia");
  });

  it("trường tự do: thêm/cập nhật theo key/xoá", async () => {
    const mod = await import("../lib/diorama");
    const base = {
      id: "e1", kind: "character", name: "Kira", role: "",
      traits: [], description: "", color: "#ef4444", relations: [],
      customFields: [], design2d: { palette: [], expressions: [] },
    };
    const one = mod.addCustomField(base, "Sức mạnh", "90");
    expect(one.customFields).toEqual([{ key: "Sức mạnh", value: "90" }]);
    expect(mod.addCustomField(one, "Sức mạnh", "95").customFields).toEqual([
      { key: "Sức mạnh", value: "95" },
    ]);
    expect(mod.addCustomField(base, "  ", "x")).toBe(base);
    expect(mod.removeCustomField(one, "Sức mạnh").customFields).toEqual([]);
  });

  it("bảng màu + biểu cảm: trùng thì ghi đè/bỏ qua, xoá được", async () => {
    const mod = await import("../lib/diorama");
    const base = {
      id: "e1", kind: "character", name: "Kira", role: "",
      traits: [], description: "", color: "#ef4444", relations: [],
      customFields: [], design2d: { palette: [], expressions: [] },
    };
    const withColor = mod.addPaletteColor(base, "#123456");
    expect(mod.addPaletteColor(withColor, "#123456").design2d.palette).toEqual(["#123456"]);
    expect(mod.removePaletteColor(withColor, "#123456").design2d.palette).toEqual([]);
    const withExpr = mod.addDesignExpression(base, "Vui", "data:,a");
    expect(mod.addDesignExpression(withExpr, "Vui", "data:,b").design2d.expressions).toEqual([
      { label: "Vui", dataUrl: "data:,b" },
    ]);
    expect(mod.removeDesignExpression(withExpr, "Vui").design2d.expressions).toEqual([]);
  });

  it("sự kiện: order tự tăng, xếp theo order, xoá được", async () => {
    const mod = await import("../lib/diorama");
    const evs = mod.addWorldEvent([], { title: "A", dateLabel: "", entityIds: [], description: "" });
    const evs2 = mod.addWorldEvent(evs, { title: "B", dateLabel: "", entityIds: [], description: "" });
    expect(evs2[1].order).toBeGreaterThan(evs2[0].order);
    expect(mod.sortedEvents([evs2[1], evs2[0]]).map((e) => e.title)).toEqual(["A", "B"]);
    expect(mod.removeWorldEvent(evs2, evs2[0].id)).toHaveLength(1);
  });

  it("placement GLB: footprint mặc định 2, khối dùng footprint mẫu", async () => {
    const mod = await import("../lib/diorama");
    const glb = mod.createPlacement("character", 0, 0, null, "Robot", "asset-1");
    expect(glb.glbAssetId).toBe("asset-1");
    expect(mod.placementFootprint(glb)).toBe(2);
    expect(mod.placementFootprint(mod.createPlacement("school", 0, 0))).toBe(4.2);
  });
});

describe("gói bàn giao ZIP (STORE, không nén)", () => {
  it("đóng gói đúng chữ ký PK, đọc lại được tên file + dữ liệu", async () => {
    const mod = await import("../lib/handoffZip");
    const payload = new TextEncoder().encode("hello world");
    const zip = mod.buildZip([
      { name: "prompt.txt", data: payload },
      { name: "view-front.png", data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("prompt.txt");
    expect(text).toContain("view-front.png");
    expect(text).toContain("hello world");
    expect(mod.crc32(payload)).toBeGreaterThan(0);
  });

  it("prompt tiếng Anh chứa tên, vai trò, palette", async () => {
    const mod = await import("../lib/handoffZip");
    const prompt = mod.handoffPromptText({
      name: "Kira", role: "Pháp sư", traits: ["Dũng cảm"],
      description: "Người giữ đền", palette: ["#ef4444"],
    });
    expect(prompt).toContain("Kira");
    expect(prompt).toContain("GLB");
    expect(prompt).toContain("#ef4444");
  });
});

describe("W3: địa hình", () => {
  it("heightAt: phẳng = 0, nội suy đúng giữa 2 đỉnh", async () => {
    const t = await import("../lib/terrain");
    const flat = t.createFlatTerrain();
    expect(t.heightAt(flat, 40, 0, 0)).toBe(0);
    const raised = t.brushTerrain(flat, 40, 0, 0, "raise", 1, 1);
    // Tâm cọ (0,0) là đỉnh lưới (i=40,j=40) nên cao đúng 1 * falloff(0)=1
    expect(t.heightAt(raised, 40, 0, 0)).toBeCloseTo(1, 5);
    // Xa hơn bán kính thì không đổi
    expect(t.heightAt(raised, 40, 10, 10)).toBe(0);
  });

  it("cọ hạ/san phẳng: hạ xuống âm, san phẳng kéo về cao độ tâm", async () => {
    const t = await import("../lib/terrain");
    const flat = t.createFlatTerrain();
    const pit = t.brushTerrain(flat, 40, 0, 0, "lower", 2, 0.8);
    expect(t.heightAt(pit, 40, 0, 0)).toBeLessThan(0);
    const levelled = t.brushTerrain(pit, 40, 0, 0, "flatten", 2, 1);
    expect(Math.abs(t.heightAt(levelled, 40, 0, 0) - t.heightAt(pit, 40, 0, 0))).toBeLessThan(0.01);
  });

  it("tô biome: trong bán kính đổi, ngoài bán kính giữ nguyên", async () => {
    const t = await import("../lib/terrain");
    const flat = t.createFlatTerrain();
    const painted = t.paintBiome(flat, 40, 0, 0, 1, "sand");
    expect(painted.biomes[40][40]).toBe("sand");
    expect(painted.biomes[0][0]).toBe("grass");
  });

  it("màu đỉnh: cao thì ngả đá/tuyết, thấp gần nước thì ngả cát", async () => {
    const t = await import("../lib/terrain");
    const wet = { ...t.createFlatTerrain(), waterLevel: 0 };
    const low = t.terrainVertexColor(wet, 40, 40);
    const high = t.terrainVertexColor(
      { ...wet, heights: wet.heights.map((row, j) => row.map((_, i) => (i === 40 && j === 40 ? 8 : 0))) },
      40, 40,
    );
    // Đỉnh cao 8m phải sáng hơn (tuyết) so với đỉnh thấp gần nước
    expect(high[0] + high[1] + high[2]).toBeGreaterThan(low[0] + low[1] + low[2]);
  });

  it("clampGround theo cỡ sa bàn mới", async () => {
    const mod = await import("../lib/diorama");
    expect(mod.clampGround(30, 0, 20)).toBeLessThan(10);
    expect(mod.clampGround(30, 0, 60)).toBe(29.5);
  });
});
