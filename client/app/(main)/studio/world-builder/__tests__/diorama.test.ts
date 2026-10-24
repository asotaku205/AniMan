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
      id: "e1", kind: "character" as const, name: "Kira", role: "",
      traits: ["Dũng cảm"], description: "", color: "#ef4444", relations: [],
    };
    expect(mod.addTrait(base, "Dũng cảm").traits).toEqual(["Dũng cảm"]);
    expect(mod.addTrait(base, "  ").traits).toEqual(["Dũng cảm"]);
    expect(mod.addTrait(base, "Kiên cường").traits).toEqual(["Dũng cảm", "Kiên cường"]);
    expect(mod.removeTrait(base, "Dũng cảm").traits).toEqual([]);
  });

  it("thêm quan hệ: ghi đè nhãn khi trùng, chặn tự quan hệ", async () => {
    const mod = await import("../lib/diorama");
    const base = {
      id: "e1", kind: "character" as const, name: "Kira", role: "",
      traits: [], description: "", color: "#ef4444", relations: [],
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
