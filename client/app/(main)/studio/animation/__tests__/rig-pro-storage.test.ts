// @vitest-environment node
/**
 * Kiểm thử tích hợp thư viện dáng Rig Pro trên fake-indexeddb: dáng ghi
 * rồi đọc lại còn nguyên, xoá thì mất, store cũ (projects/assets) vẫn
 * mở được sau khi bump DB v3 → v4.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

describe("animStorage v4 — thư viện dáng", () => {
  it("dáng ghi/đọc/xoá còn nguyên, store cũ không vỡ", async () => {
    const storage = await import("../lib/animStorage");
    await storage.savePoseEntry({
      id: "pose-test-1",
      name: "Vẫy tay",
      createdAt: 100,
      bones: { LeftArm: [0, 0, 0.9], LeftForeArm: [0, 0, 0.5] },
    });
    await storage.savePoseEntry({
      id: "pose-test-2",
      name: "Ngồi",
      createdAt: 200,
      bones: { LeftUpLeg: [-1.4, 0, 0] },
    });
    const all = await storage.listSavedPoses();
    expect(all.map((p) => p.id)).toContain("pose-test-1");
    expect(all.map((p) => p.id)).toContain("pose-test-2");
    expect(all.find((p) => p.id === "pose-test-1")!.bones.LeftArm).toEqual([
      0, 0, 0.9,
    ]);
    await storage.deletePoseEntry("pose-test-1");
    const after = await storage.listSavedPoses();
    expect(after.map((p) => p.id)).not.toContain("pose-test-1");
    // Store cũ vẫn đọc được (không throw, trả mảng).
    expect(await storage.listAnimAssets()).toEqual([]);
    expect(await storage.listAnimProjects()).toEqual([]);
  });
});
