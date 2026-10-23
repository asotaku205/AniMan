import { describe, expect, it } from "vitest";
import {
  audioClipBlobKey,
  clampAudioClip,
  createSceneAudioClip,
} from "../lib/audioClips";
import { createAnimProject, createAnimScene } from "../lib/animProject";
import { buildFilmAudioPlan } from "../lib/filmAudio";

describe("clip âm thanh của cảnh (R2)", () => {
  it("tạo clip mặc định nghe toàn bộ file, key kho khớp quy ước", () => {
    const clip = createSceneAudioClip({
      name: "Tiếng bước chân",
      kind: "sfx",
      sourceDurationSec: 3.2,
    });
    expect(clip.durationSec).toBe(3.2);
    expect(clip.offsetSec).toBe(0);
    expect(clip.volume).toBe(1);
    expect(audioClipBlobKey(clip.id)).toBe(`audio-${clip.id}`);
  });

  it("kẹp: cắt không vượt file gốc, clip không vượt cuối cảnh, fade ≤ nửa clip", () => {
    const clip = createSceneAudioClip({
      name: "Mưa",
      kind: "music",
      sourceDurationSec: 10,
    });
    const clamped = clampAudioClip(
      { ...clip, startSec: 4, offsetSec: 9.5, durationSec: 8, fadeInSec: 9, volume: 3 },
      5,
    );
    expect(clamped.offsetSec).toBeLessThanOrEqual(9.9);
    expect(clamped.offsetSec + clamped.durationSec).toBeLessThanOrEqual(10);
    expect(clamped.startSec + clamped.durationSec).toBeLessThanOrEqual(5);
    expect(clamped.fadeInSec).toBeLessThanOrEqual(clamped.durationSec / 2);
    expect(clamped.volume).toBe(1.5);
  });

  it("kế hoạch tiếng toàn phim gồm clip âm thanh theo mốc tuyệt đối", () => {
    const project = createAnimProject("Phim", "2d");
    const s1 = createAnimScene("Mở đầu", 5);
    const s2 = createAnimScene("Cao trào", 6);
    const clip = createSceneAudioClip({
      name: "Tiếng sấm",
      kind: "sfx",
      sourceDurationSec: 4,
      startSec: 1.5,
    });
    s2.audioClips = [{ ...clip, fadeInSec: 0.5, offsetSec: 0.25, durationSec: 3 }];
    project.scenes = [s1, s2];
    const plan = buildFilmAudioPlan(project);
    const found = plan.clips.find((c) => c.takeId === audioClipBlobKey(clip.id));
    expect(found).toBeDefined();
    expect(found?.atSec).toBe(6.5); // 5s cảnh 1 + 1.5s trong cảnh 2
    expect(found?.playDurationSec).toBe(3);
    expect(found?.sourceOffsetSec).toBe(0.25);
    expect(found?.fadeInSec).toBe(0.5);
  });
});
