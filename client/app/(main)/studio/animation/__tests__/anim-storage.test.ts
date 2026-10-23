// @vitest-environment node
/**
 * Kiểm thử tích hợp animStorage trên fake-indexeddb (Slice B1): dự án có
 * nhạc nền + dòng thoại có bản thu ghi xong đọc lại phải còn nguyên; file
 * tiếng (Blob) ghi/đọc đúng bytes; dự án cũ (chưa có trường mới) vẫn mở.
 */
import { indexedDB as fakeIdb } from "fake-indexeddb";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("indexedDB", fakeIdb);
});

describe("animStorage — dự án phim + kho file tiếng", () => {
  it("dự án có bgm + takes ghi/đọc lại còn nguyên", async () => {
    const storage = await import("../lib/animStorage");
    const { createAnimProject, createAnimScene } = await import(
      "../lib/animProject"
    );
    const { buildDialogueTrack, addDialogueTake } = await import(
      "../lib/dialogue"
    );

    const project = createAnimProject("Phim có tiếng", "2d");
    project.bgm = {
      blobKey: storage.bgmBlobKey(project.id),
      name: "nhac-nen.mp3",
      volume: 0.35,
      loop: true,
    };
    const scene = createAnimScene("Cảnh mở đầu", 5);
    const { lines } = buildDialogueTrack(["Xin chào, tớ về rồi!"]);
    scene.dialogue = [
      addDialogueTake(lines[0], {
        id: "take-1",
        durationSec: 2.1,
        volume: 1,
        createdAt: 123,
      }),
    ];
    project.scenes = [scene];
    await storage.saveAnimProject(project);

    const back = await storage.getAnimProject(project.id);
    expect(back).not.toBeNull();
    expect(back!.bgm?.name).toBe("nhac-nen.mp3");
    expect(back!.scenes[0].dialogue?.[0].selectedTakeId).toBe("take-1");
    expect(back!.scenes[0].dialogue?.[0].takes).toHaveLength(1);
  });

  it("dự án đời cũ (không có trường bgm/takes) vẫn đọc được", async () => {
    const storage = await import("../lib/animStorage");
    const { createAnimProject } = await import("../lib/animProject");
    const legacy = createAnimProject("Phim cũ", "3d") as unknown as Record<
      string,
      unknown
    >;
    delete legacy.bgm;
    await storage.saveAnimProject(
      legacy as unknown as Parameters<typeof storage.saveAnimProject>[0],
    );
    const back = await storage.getAnimProject(legacy.id as string);
    expect(back).not.toBeNull();
    expect(back!.bgm ?? null).toBeNull();
    expect(back!.scenes[0].dialogue).toBeUndefined();
  });

  it("file tiếng ghi/đọc lại đúng bytes và xoá được", async () => {
    const storage = await import("../lib/animStorage");
    const bytes = new Uint8Array([9, 8, 7, 6, 5]);
    await storage.saveVoiceBlob(
      "take-1",
      new Blob([bytes], { type: "audio/webm" }),
    );
    const back = await storage.loadVoiceBlob("take-1");
    expect(back).not.toBeNull();
    expect(Array.from(new Uint8Array(await back!.arrayBuffer()))).toEqual(
      Array.from(bytes),
    );
    await storage.deleteVoiceBlob("take-1");
    expect(await storage.loadVoiceBlob("take-1")).toBeNull();
  });
});
