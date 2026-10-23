import { describe, expect, it } from "vitest";
import {
  BUILTIN_SCENERY,
  applyScenery,
  characterObjectFromAsset,
  type Character3DAsset,
} from "../lib/animAssets";
import { createPrevizObject } from "../lib/previz";

describe("animAssets (Đợt C)", () => {
  it("4 phong cảnh có sẵn đều dựng được vật thể hợp lệ", () => {
    expect(BUILTIN_SCENERY).toHaveLength(4);
    for (const s of BUILTIN_SCENERY) {
      const objects = s.build();
      expect(objects.length).toBeGreaterThanOrEqual(4);
      expect(s.backdrop).toMatch(/^#/);
      for (const o of objects) {
        expect(o.keys.length).toBeGreaterThanOrEqual(1);
        expect(o.keys[0].position.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("áp phong cảnh: thay vật thể thường + màu nền, GIỮ nhân vật đang có", () => {
    const hero = createPrevizObject("character", "Hero");
    const oldBox = createPrevizObject("box", "Hộp cũ");
    const scenery = BUILTIN_SCENERY[0];
    const next = applyScenery([hero, oldBox], {
      backdrop: scenery.backdrop,
      objects: scenery.build(),
    });
    expect(next.backdrop).toBe(scenery.backdrop);
    expect(next.objects.some((o) => o.id === hero.id)).toBe(true);
    expect(next.objects.some((o) => o.name === "Hộp cũ")).toBe(false);
  });

  it("nhân vật từ thư viện mang đúng tên/màu/chiều cao", () => {
    const asset: Character3DAsset = {
      kind: "character3d",
      id: "c1",
      name: "Linh",
      color: "#a0c4e8",
      size: 1.6,
      createdAt: 1,
    };
    const obj = characterObjectFromAsset(asset, 2, 1);
    expect(obj.kind).toBe("character");
    expect(obj.name).toBe("Linh");
    expect(obj.color).toBe("#a0c4e8");
    expect(obj.size).toBe(1.6);
    expect(obj.keys[0].position).toEqual({ x: 2, y: 0, z: 1 });
  });
});
