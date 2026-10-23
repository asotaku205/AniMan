import { describe, expect, it } from "vitest";
import { createAnimProject, createAnimScene } from "../lib/animProject";
import { buildDialogueTrack, addDialogueTake } from "../lib/dialogue";
import { buildFilmAudioPlan } from "../lib/filmAudio";

describe("buildFilmAudioPlan (Slice B4)", () => {
  it("mốc tuyệt đối = tổng thời lượng cảnh trước + mốc trong cảnh; dòng thiếu tiếng vào danh sách missing", () => {
    const project = createAnimProject("Phim", "2d");
    const s1 = createAnimScene("Mở", 4);
    const s2 = createAnimScene("Giữa", 6);
    const { lines } = buildDialogueTrack(["Câu một.", "Câu hai."]);
    const withVoice = addDialogueTake(lines[0], {
      id: "tk1",
      durationSec: 1.5,
      volume: 0.8,
      createdAt: 1,
    });
    s1.dialogue = [withVoice, lines[1]]; // dòng 2 chưa có tiếng
    const l3 = buildDialogueTrack(["Câu ba."]).lines[0];
    s2.dialogue = [
      addDialogueTake(l3, { id: "tk3", durationSec: 1, volume: 1, createdAt: 2 }),
    ];
    project.scenes = [s1, s2];

    const plan = buildFilmAudioPlan(project);
    expect(plan.totalSec).toBe(10);
    expect(plan.clips.map((c) => c.takeId)).toEqual(["tk1", "tk3"]);
    expect(plan.clips[0].atSec).toBeCloseTo(withVoice.startSec);
    expect(plan.clips[1].atSec).toBeCloseTo(4 + l3.startSec);
    expect(plan.clips[0].volume).toBe(0.8);
    expect(plan.missing).toHaveLength(1);
    expect(plan.missing[0].sceneName).toBe("Mở");
  });

  it("dòng thoại trống không tính là thiếu tiếng", () => {
    const project = createAnimProject("Phim 2", "2d");
    const s1 = createAnimScene("A", 3);
    s1.dialogue = [
      { id: "x", text: "  ", startSec: 0, durationSec: 1 },
    ];
    project.scenes = [s1];
    const plan = buildFilmAudioPlan(project);
    expect(plan.clips).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
  });
});
