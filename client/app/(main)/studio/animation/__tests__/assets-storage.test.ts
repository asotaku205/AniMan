// @vitest-environment node
/**
 * Kiểm thử tích hợp kho tài sản (Đợt C) trên fake-indexeddb: 3 loại tài
 * sản ghi/đọc lại còn nguyên, xoá được. Import nằm trong test vì
 * animStorage chốt môi trường trình duyệt lúc nạp module.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

describe("animStorage — thư viện tài sản", () => {
  it("lưu các loại tài sản (nhân vật/phong cảnh/hình/mô hình 3D), đọc lại đủ, xoá đúng cái cần xoá", async () => {
    const storage = await import("../lib/animStorage");
    const { BUILTIN_SCENERY } = await import("../lib/animAssets");
    await storage.saveAnimAsset({
      kind: "character3d",
      id: "char-t",
      name: "Linh",
      color: "#a0c4e8",
      size: 1.6,
      createdAt: 1,
    });
    await storage.saveAnimAsset({
      kind: "scenery",
      id: "scn-t",
      name: "Phòng học của tôi",
      backdrop: BUILTIN_SCENERY[0].backdrop,
      objects: BUILTIN_SCENERY[0].build(),
      createdAt: 2,
    });
    await storage.saveAnimAsset({
      kind: "image",
      id: "img-t",
      name: "nen-lop",
      category: "background",
      dataUrl: "data:image/png;base64,AAAA",
      createdAt: 3,
    });
    await storage.saveAnimAsset({
      kind: "model3d",
      id: "mdl-t",
      name: "nha-go",
      dataUrl: "data:model/gltf-binary;base64,AAAA",
      createdAt: 4,
    });
    const all = await storage.listAnimAssets();
    expect(all.map((a) => a.id)).toEqual(["char-t", "scn-t", "img-t", "mdl-t"]);
    const scenery = all.find((a) => a.kind === "scenery");
    expect(
      scenery && scenery.kind === "scenery" ? scenery.objects.length : 0,
    ).toBeGreaterThanOrEqual(4);
    await storage.deleteAnimAsset("scn-t");
    expect((await storage.listAnimAssets()).map((a) => a.id)).toEqual([
      "char-t",
      "img-t",
      "mdl-t",
    ]);
  });
});
