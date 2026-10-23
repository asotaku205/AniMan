import { describe, expect, it } from "vitest";
import { createAnimProject, createAnimScene } from "../lib/animProject";
import { buildDialogueTrack, addDialogueTake } from "../lib/dialogue";
import {
  collectVoiceKeys,
  parseProjectPackage,
} from "../lib/projectTransfer";

describe("projectTransfer (Slice B6)", () => {
  it("collectVoiceKeys gom đủ take + nhạc nền, không trùng", () => {
    const project = createAnimProject("Phim", "2d");
    const scene = createAnimScene("C1", 4);
    const { lines } = buildDialogueTrack(["Câu một."]);
    scene.dialogue = [
      addDialogueTake(
        addDialogueTake(lines[0], {
          id: "tk1",
          durationSec: 1,
          volume: 1,
          createdAt: 1,
        }),
        { id: "tk2", durationSec: 1, volume: 1, createdAt: 2 },
      ),
    ];
    project.scenes = [scene];
    project.bgm = {
      blobKey: "bgm-x",
      name: "n.mp3",
      volume: 0.3,
      loop: true,
    };
    expect(collectVoiceKeys(project).sort()).toEqual(["bgm-x", "tk1", "tk2"]);
  });

  it("parseProjectPackage: chấp nhận gói hợp lệ, từ chối file lạ/phiên bản khác", () => {
    const project = createAnimProject("Phim", "3d");
    const okJson = JSON.stringify({
      format: "animan-project",
      version: 1,
      exportedAt: 1,
      project,
      voiceFiles: {},
    });
    expect(parseProjectPackage(okJson).project.name).toBe("Phim");
    expect(() => parseProjectPackage("{}")).toThrow(/không phải định dạng/);
    expect(() => parseProjectPackage("không phải json")).toThrow(
      /không phải định dạng/,
    );
    expect(() =>
      parseProjectPackage(
        JSON.stringify({
          format: "animan-project",
          version: 99,
          exportedAt: 1,
          project,
          voiceFiles: {},
        }),
      ),
    ).toThrow(/chưa được hỗ trợ/);
  });
});

