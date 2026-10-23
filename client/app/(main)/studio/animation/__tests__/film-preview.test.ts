import { describe, expect, it } from "vitest";
import { createAnimProject, createAnimScene } from "../lib/animProject";
import { dialogueAtFilmTime } from "../lib/filmPreview";

function projectWithDialogue() {
  const project = createAnimProject("Phim thử", "2d");
  const s1 = createAnimScene("Mở đầu", 5);
  s1.dialogue = [
    { id: "l1", speaker: "Linh", text: "Chào!", startSec: 1, durationSec: 2 },
  ];
  const s2 = createAnimScene("Tiếp theo", 4);
  s2.dialogue = [
    { id: "l2", speaker: "Hùng", text: "Đi thôi", startSec: 0.5, durationSec: 1.5 },
  ];
  project.scenes = [s1, s2];
  return project;
}

describe("phát thử đồng bộ (S1): phụ đề theo mốc phim tuyệt đối", () => {
  it("đúng dòng thoại theo thời gian tuyệt đối qua ranh giới cảnh", () => {
    const p = projectWithDialogue();
    expect(dialogueAtFilmTime(p, 0.5)).toBeNull();
    expect(dialogueAtFilmTime(p, 1.5)?.line.id).toBe("l1");
    expect(dialogueAtFilmTime(p, 1.5)?.sceneIndex).toBe(0);
    expect(dialogueAtFilmTime(p, 4)).toBeNull();
    // cảnh 2 bắt đầu ở 5s; dòng l2 ở 5.5–7s
    expect(dialogueAtFilmTime(p, 6)?.line.id).toBe("l2");
    expect(dialogueAtFilmTime(p, 6)?.sceneIndex).toBe(1);
    expect(dialogueAtFilmTime(p, 9.5)).toBeNull();
  });
});
