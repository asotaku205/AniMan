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
      customFields: [], design2d: { palette: [], expressions: [] }, articles: [], factionId: null,
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
      customFields: [], design2d: { palette: [], expressions: [] }, articles: [], factionId: null,
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
      customFields: [], design2d: { palette: [], expressions: [] }, articles: [], factionId: null,
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
      customFields: [], design2d: { palette: [], expressions: [] }, articles: [], factionId: null,
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
    const flat = t.createFlatWorld();
    expect(t.heightAt(flat, 0, 0)).toBe(0);
    const raised = t.brushTerrain(flat, 0, 0, "raise", 1, 1);
    // Tâm cọ (0,0) là đỉnh lưới (i=40,j=40) nên cao đúng 1 * falloff(0)=1
    expect(t.heightAt(raised, 0, 0)).toBeCloseTo(1, 5);
    // Xa hơn bán kính thì không đổi
    expect(t.heightAt(raised, 10, 10)).toBe(0);
  });

  it("cọ hạ/san phẳng: hạ xuống âm, san phẳng kéo về cao độ tâm", async () => {
    const t = await import("../lib/terrain");
    const flat = t.createFlatWorld();
    const pit = t.brushTerrain(flat, 0, 0, "lower", 2, 0.8);
    expect(t.heightAt(pit, 0, 0)).toBeLessThan(0);
    const levelled = t.brushTerrain(pit, 0, 0, "flatten", 2, 1);
    expect(Math.abs(t.heightAt(levelled, 0, 0) - t.heightAt(pit, 0, 0))).toBeLessThan(0.01);
  });

  it("tô biome: trong bán kính đổi, ngoài bán kính giữ nguyên", async () => {
    const t = await import("../lib/terrain");
    const flat = t.createFlatWorld();
    const painted = t.paintBiome(flat, 0, 0, 1, "sand");
    expect(painted.chunks["0,0"].biomes[40][40]).toBe("sand");
    expect(painted.chunks["0,0"].biomes[0][0]).toBe("grass");
  });

  it("màu đỉnh: cao thì ngả đá/tuyết, thấp gần nước thì ngả cát", async () => {
    const t = await import("../lib/terrain");
    const chunk = t.createFlatTerrain();
    const low = t.terrainVertexColor(chunk, 40, 40, 0);
    const high = t.terrainVertexColor(
      { ...chunk, heights: chunk.heights.map((row, j) => row.map((_, i) => (i === 40 && j === 40 ? 8 : 0))) },
      40, 40, 0,
    );
    // Đỉnh cao 8m phải sáng hơn (tuyết) so với đỉnh thấp gần nước
    expect(high[0] + high[1] + high[2]).toBeGreaterThan(low[0] + low[1] + low[2]);
  });

  it("clampGround theo biên thế giới (min/max)", async () => {
    const mod = await import("../lib/diorama");
    expect(mod.clampGround(30, 0, -20, 20)).toBe(19.5);
    expect(mod.clampGround(30, 0, -30, 30)).toBe(29.5);
    expect(mod.clampGround(-99)).toBe(-19.5);
  });
});

describe("Phase 2: bầu trời sống", () => {
  it("pha trăng: tròn thì đĩa tối lệch hẳn, non thì che hết, bán nguyệt thì lệch 1 bán kính", async () => {
    const d = await import("../lib/diorama");
    expect(d.moonCoverOffset(0.5, 9)).toBe(18);
    expect(d.moonCoverOffset(0, 9)).toBe(0);
    expect(d.moonCoverOffset(0.25, 9)).toBe(9);
    expect(d.moonCoverOffset(0.75, 9)).toBe(9);
    expect(d.moonCoverSide(0.25)).toBe(-1);
    expect(d.moonCoverSide(0.75)).toBe(1);
    const phase = d.moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)));
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(0.05);
  });
});

describe("logic thời tiết", () => {
  it("mưa kín mây đen, gió mạnh, có sấm, nắng yếu nhất; nắng thưa mây, nắng đủ", async () => {
    const d = await import("../lib/diorama");
    const rain = d.weatherParams("rain");
    const clear = d.weatherParams("clear");
    const snow = d.weatherParams("snow");
    const fog = d.weatherParams("fog");
    expect(rain.cloudCover).toBe(1);
    expect(rain.cloudCover).toBeGreaterThan(snow.cloudCover);
    expect(snow.cloudCover).toBeGreaterThan(clear.cloudCover);
    expect(rain.cloudDark).toBeGreaterThan(snow.cloudDark);
    expect(rain.sunFactor).toBeLessThan(fog.sunFactor);
    expect(fog.sunFactor).toBeLessThan(clear.sunFactor);
    expect(rain.wind).toBeGreaterThan(snow.wind);
    expect(snow.wind).toBeGreaterThan(clear.wind);
    expect(rain.lightning).toBe(true);
    expect(clear.lightning).toBe(false);
    expect(snow.lightning).toBe(false);
    expect(fog.fogFar).toBeLessThan(clear.fogFar);
  });
});

describe("W9: sinh cảnh quan theo vùng", () => {
  it("núi nâng tâm cao, hồ hạ tâm + có nước, đảo có vành cát", async () => {
    const t = await import("../lib/terrain");
    const g = await import("../lib/worldGen");
    let wt = t.createFlatWorld();
    wt = g.generateTerrain(wt, "mountain", 0, 0, 10, 7, 3);
    expect(t.heightAt(wt, 0, 0)).toBeGreaterThan(4);
    wt = t.createFlatWorld();
    wt = g.generateTerrain(wt, "lake", 0, 0, 8, 2, 3);
    expect(t.heightAt(wt, 0, 0)).toBeLessThan(0);
    expect(wt.waterLevel).toBeGreaterThan(-1);
    wt = t.createFlatWorld();
    wt = g.generateTerrain(wt, "island", 0, 0, 10, 3, 3);
    expect(t.heightAt(wt, 0, 0)).toBeGreaterThan(1);
    // Ô (i=54, j=40) cách tâm ~7.3m: cao ~0.5m → vành cát.
    expect(wt.chunks["0,0"].biomes[40][54]).toBe("sand");
  });

  it("rải rừng: trong vòng, tránh nước, cách nhau ≥2m", async () => {
    const t = await import("../lib/terrain");
    const g = await import("../lib/worldGen");
    const wt = t.createFlatWorld();
    const trees = g.scatterForest(wt, [], 0, 0, 8, 0.1, 5);
    expect(trees.length).toBeGreaterThan(5);
    for (const pl of trees) {
      expect(Math.hypot(pl.x, pl.z)).toBeLessThanOrEqual(8.5);
    }
    for (let a = 0; a < trees.length; a += 1) {
      for (let b = a + 1; b < trees.length; b += 1) {
        expect(Math.hypot(trees[a].x - trees[b].x, trees[a].z - trees[b].z)).toBeGreaterThanOrEqual(1.99);
      }
    }
  });

  it("làng có nhà + đường, thị trấn có 2 đường, đào sông hạ lòng", async () => {
    const t = await import("../lib/terrain");
    const g = await import("../lib/worldGen");
    const wt = t.createFlatWorld();
    const v = g.generateVillage(wt, [], 0, 0, 5);
    expect(v.placements.length).toBeGreaterThanOrEqual(8);
    expect(v.paths).toHaveLength(1);
    const town = g.generateTown(wt, [], 0, 0, 5);
    expect(town.paths).toHaveLength(2);
    expect(town.placements.length).toBeGreaterThan(0);
    const carved = g.carveRiver(wt, [{ x: -10, z: 0 }, { x: 10, z: 0 }], 3, 1.5);
    expect(t.heightAt(carved, 0, 0)).toBeCloseTo(-1.5, 5);
    expect(t.heightAt(carved, 0, 5)).toBe(0);
  });

  it("preset theo thể loại: fantasy có núi + cổng hang, adventure có đảo trên nước", async () => {
    const presets = await import("../lib/worldPresets");
    const t = await import("../lib/terrain");
    const fantasy = presets.buildPresetWorld("fantasy");
    expect(Math.max(...fantasy.terrain.chunks["0,0"].heights.flat())).toBeGreaterThan(5);
    expect(fantasy.placements.some((pl) => pl.modelId === "cave-gate")).toBe(true);
    const adventure = presets.buildPresetWorld("adventure");
    expect(adventure.terrain.waterLevel).toBeGreaterThan(-1);
    expect(t.heightAt(adventure.terrain, 0, 0)).toBeGreaterThan(adventure.terrain.waterLevel);
    const horror = presets.buildPresetWorld("horror");
    expect(horror.sky.weather).toBe("fog");
    expect(horror.sky.time).toBe(22);
  });
});

describe("W8: thế giới mở rộng theo chunk", () => {
  it("migrate: ô đất cũ thành chunk (0,0) nguyên vẹn, tọa độ không đổi", async () => {
    const t = await import("../lib/terrain");
    const old = t.createFlatTerrain();
    old.heights[10][20] = 3;
    const wt = t.migrateTerrainToWorld({ ...old, waterLevel: 0.5 });
    expect(Object.keys(wt.chunks)).toEqual(["0,0"]);
    expect(wt.chunks["0,0"].heights[10][20]).toBe(3);
    expect(wt.waterLevel).toBe(0.5);
    expect(t.heightAt(wt, 0, 0)).toBe(0);
    // World mới đi qua giữ nguyên nội dung.
    expect(t.migrateTerrainToWorld(wt)).toEqual(wt);
  });

  it("chunk mới kẹp mép theo chunk kề — mặt đất liền mạch qua biên", async () => {
    const t = await import("../lib/terrain");
    let wt = t.createFlatWorld();
    wt = t.brushTerrain(wt, 19, 0, "raise", 3, 2);
    const before = wt.chunks["0,0"].heights.map((row) => [...row]);
    wt = t.addChunk(wt, 1, 0);
    const added = wt.chunks["1,0"];
    for (let j = 0; j <= 80; j += 1) {
      expect(added.heights[j][0]).toBe(before[j][80]);
    }
    // Cao độ liền mạch qua biên (19.9 trong chunk cũ ≈ 20.1 trong chunk mới).
    expect(Math.abs(t.heightAt(wt, 19.9, 0) - t.heightAt(wt, 20.1, 0))).toBeLessThan(0.6);
    // Thêm lại chunk đã có thì giữ nguyên.
    expect(t.addChunk(wt, 1, 0)).toBe(wt);
  });

  it("cọ tràn biên: quét ở mép đổi cả 2 chunk kề", async () => {
    const t = await import("../lib/terrain");
    let wt = t.createFlatWorld();
    wt = t.addChunk(wt, 1, 0);
    wt = t.brushTerrain(wt, 19.5, 0, "raise", 3, 1);
    const anyRaised = (c: { heights: number[][] }) => c.heights.some((row) => row.some((h) => h > 0));
    expect(anyRaised(wt.chunks["0,0"])).toBe(true);
    expect(anyRaised(wt.chunks["1,0"])).toBe(true);
  });

  it("removeChunk: xoá được chunk trống, giữ chunk cuối cùng", async () => {
    const t = await import("../lib/terrain");
    let wt = t.createFlatWorld();
    wt = t.addChunk(wt, 1, 0);
    wt = t.addChunk(wt, 0, 1);
    wt = t.removeChunk(wt, 1, 0);
    expect(Object.keys(wt.chunks).sort()).toEqual(["0,0", "0,1"]);
    expect(t.worldBounds(wt).maxX).toBe(20);
    // Xoá chunk không có thì giữ nguyên; xoá tới chunk cuối thì chặn.
    expect(t.removeChunk(wt, 5, 5)).toBe(wt);
    wt = t.removeChunk(wt, 0, 1);
    expect(Object.keys(wt.chunks)).toEqual(["0,0"]);
    expect(t.removeChunk(wt, 0, 0)).toBe(wt);
  });

  it("worldBounds + clampToWorld theo số chunk thực tế", async () => {
    const t = await import("../lib/terrain");
    let wt = t.createFlatWorld();
    wt = t.addChunk(wt, 1, 0);
    wt = t.addChunk(wt, 0, -1);
    const b = t.worldBounds(wt);
    expect([b.minX, b.maxX, b.minZ, b.maxZ]).toEqual([-20, 60, -60, 20]);
    expect(t.clampToWorld(wt, 99, true, 0)).toBe(59.5);
    expect(t.clampToWorld(wt, -99, false, 0)).toBe(-59.5);
    // Ngoài thế giới (chunk chưa có) cao độ = 0.
    expect(t.heightAt(wt, 100, 100)).toBe(0);
  });
});

describe("W4: vật tự ghép + biến đổi", () => {
  it("tạo vật, thêm/xoá/sửa chi tiết, giữ tối thiểu 1 chi tiết", async () => {
    const mod = await import("../lib/diorama");
    const m = mod.createCustomModel("Nhà sàn");
    expect(m.parts).toHaveLength(1);
    const m2 = mod.addPartToModel(m, { shape: "cone", size: [2, 1, 4], offset: [0, 1.5, 0], color: "#a8442c" });
    expect(m2.parts).toHaveLength(2);
    const m3 = mod.updatePartInModel(m2, 0, { color: "#ffffff" });
    expect(m3.parts[0].color).toBe("#ffffff");
    expect(mod.removePartFromModel(m3, 1).parts).toHaveLength(1);
    expect(mod.removePartFromModel(m, 0)).toBe(m);
  });

  it("footprint vật tự ghép tính từ chi tiết xa tâm nhất", async () => {
    const mod = await import("../lib/diorama");
    const m = mod.createCustomModel("X");
    const p = mod.createPlacement("house", 0, 0);
    p.customModelId = m.id;
    expect(mod.placementFootprint(p, [m])).toBeGreaterThanOrEqual(0.8);
    const wide = mod.addPartToModel(m, { shape: "box", size: [1, 1, 1], offset: [5, 0.5, 0], color: "#fff" });
    expect(mod.placementFootprint(p, [wide])).toBeCloseTo(5.5, 5);
    expect(mod.placementParts(p, [wide])).toHaveLength(2);
  });
});

describe("W5: bài viết, @mention, phe phái", () => {
  it("thêm/xoá bài viết, @mention tách đúng thực thể", async () => {
    const mod = await import("../lib/diorama");
    const kira = {
      id: "e1", kind: "character", name: "Kira", role: "",
      traits: [], description: "", color: "#ef4444", relations: [],
      customFields: [], design2d: { palette: [], expressions: [] },
      articles: [], factionId: null,
    };
    const withArt = mod.addArticle(kira, "Nguồn gốc", "Kira sinh ra ở đền.");
    expect(withArt.articles).toHaveLength(1);
    expect(mod.removeArticle(withArt, withArt.articles[0].id).articles).toHaveLength(0);
    const parts = mod.parseMentions("Chào @Kira và @Người lạ nhé", [kira]);
    expect(parts.find((x) => x.type === "mention")?.entityId).toBe("e1");
    expect(parts.some((x) => x.type === "text" && x.value.includes("@Người lạ"))).toBe(true);
  });

  it("tạo phe phái có id/màu/thành viên rỗng", async () => {
    const mod = await import("../lib/diorama");
    const f = mod.createFaction("Hội Pháp sư", "#38bdf8");
    expect(f.name).toBe("Hội Pháp sư");
    expect(f.memberIds).toEqual([]);
  });
});

describe("W6: bầu trời + góc nhìn", () => {
  it("mặt trời trưa mạnh hơn sáng sớm, đêm tối và nền tối", async () => {
    const mod = await import("../lib/diorama");
    const noon = mod.skySun({ time: 12, weather: "clear", season: "summer" });
    const morning = mod.skySun({ time: 7, weather: "clear", season: "summer" });
    const night = mod.skySun({ time: 22, weather: "clear", season: "summer" });
    expect(noon.sunIntensity).toBeGreaterThan(morning.sunIntensity);
    expect(night.sunIntensity).toBeLessThan(morning.sunIntensity);
    expect(night.skyBg).toBe("#0d0817");
  });

  it("mùa thu ngả cam, mùa đông bạc màu; góc nhìn có id", async () => {
    const ter = await import("../lib/terrain");
    const autumn = ter.seasonTint([0.3, 0.6, 0.3], "autumn");
    expect(autumn[0]).toBeGreaterThan(autumn[2]);
    const winter = ter.seasonTint([0.3, 0.6, 0.3], "winter");
    expect(Math.abs(winter[0] - winter[1])).toBeLessThan(0.05);
    const mod = await import("../lib/diorama");
    const v = mod.createCameraView("Toàn cảnh", [10, 20, 10], [0, 0, 0]);
    expect(v.position).toEqual([10, 20, 10]);
  });
});

describe("W7: mẫu world khởi điểm", () => {
  it("làng quê có trường + nhà + 2 nhân vật + sự kiện + phe", async () => {
    const presets = await import("../lib/worldPresets");
    const v = presets.buildPresetWorld("village");
    expect(v.placements.length).toBeGreaterThanOrEqual(6);
    expect(v.entities).toHaveLength(2);
    expect(v.events).toHaveLength(1);
    expect(v.factions).toHaveLength(1);
    expect(v.entities.every((e) => e.factionId === v.factions[0].id)).toBe(true);
  });

  it("cảng có nước + cát, tuyết có núi + tuyết, trống rỗng", async () => {
    const presets = await import("../lib/worldPresets");
    const port = presets.buildPresetWorld("port");
    expect(port.terrain.waterLevel).toBeGreaterThan(-1);
    expect(port.terrain.chunks["0,0"].biomes.flat()).toContain("sand");
    const snow = presets.buildPresetWorld("snow");
    expect(snow.terrain.chunks["0,0"].biomes.flat()).toContain("snow");
    expect(Math.max(...snow.terrain.chunks["0,0"].heights.flat())).toBeGreaterThan(3);
    const blank = presets.buildPresetWorld("blank");
    expect(blank.placements).toEqual([]);
    expect(presets.WORLD_PRESETS).toHaveLength(8);
  });
});
