// @vitest-environment node
/**
 * Kiểm thử tích hợp xuất → nhập dự án trên fake-indexeddb (Slice B6):
 * dự án + file tiếng phải sống sót qua vòng đóng gói; dự án nhập có mã
 * MỚI; nhạc nền được trỏ sang key của mã mới.
 * LƯU Ý: mọi import đều NẰM TRONG test (sau khi stub window/indexedDB)
 * vì animStorage chốt môi trường trình duyệt ngay khi module nạp.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

describe("projectTransfer — xuất/nhập tích hợp (fake-indexeddb)", () => {
  it("xuất rồi nhập lại: dự án mới khác mã, bản thu + nhạc nền còn nguyên", async () => {
    const transfer = await import("../lib/projectTransfer");
    const storage = await import("../lib/animStorage");
    const { createAnimProject, createAnimScene } = await import(
      "../lib/animProject"
    );
    const { buildDialogueTrack, addDialogueTake } = await import(
      "../lib/dialogue"
    );

    const project = createAnimProject("Phim gốc", "2d");
    const scene = createAnimScene("C1", 4);
    const { lines } = buildDialogueTrack(["Mang tôi đi."]);
    scene.dialogue = [
      addDialogueTake(lines[0], {
        id: "tk-keep",
        durationSec: 1.2,
        volume: 1,
        createdAt: 1,
      }),
    ];
    project.scenes = [scene];
    project.bgm = {
      blobKey: storage.bgmBlobKey(project.id),
      name: "nen.mp3",
      volume: 0.3,
      loop: false,
    };
    await storage.saveVoiceBlob(
      "tk-keep",
      new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }),
    );
    await storage.saveVoiceBlob(
      project.bgm.blobKey,
      new Blob([new Uint8Array([4, 5])], { type: "audio/mpeg" }),
    );

    const json = await transfer.exportProjectPackage(project);
    const imported = await transfer.importProjectPackage(json);

    expect(imported.id).not.toBe(project.id);
    expect(imported.name).toBe("Phim gốc");
    expect(imported.bgm?.blobKey).toBe(storage.bgmBlobKey(imported.id));
    const back = await storage.getAnimProject(imported.id);
    expect(back?.scenes[0].dialogue?.[0].selectedTakeId).toBe("tk-keep");
    const bgmBlob = await storage.loadVoiceBlob(imported.bgm!.blobKey);
    expect(Array.from(new Uint8Array(await bgmBlob!.arrayBuffer()))).toEqual([
      4, 5,
    ]);
    const takeBlob = await storage.loadVoiceBlob("tk-keep");
    expect(takeBlob).not.toBeNull();
  });
});
