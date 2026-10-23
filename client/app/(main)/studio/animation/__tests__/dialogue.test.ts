import { describe, expect, it } from "vitest";
import {
  addDialogueTake,
  buildDialogueTrack,
  lineHasSelectedVoice,
  removeDialogueTake,
  selectDialogueTake,
  selectedDialogueTake,
  setDialogueTakeVolume,
  type DialogueTakeMeta,
} from "../lib/dialogue";

const take = (id: string): DialogueTakeMeta => ({
  id,
  durationSec: 2,
  volume: 1,
  createdAt: 1,
});

describe("dialogue takes (Slice B1)", () => {
  it("bản thu đầu tiên tự được chọn; thêm bản sau không đổi lựa chọn", () => {
    const { lines } = buildDialogueTrack(["Câu thoại một."]);
    let line = addDialogueTake(lines[0], take("t1"));
    expect(line.selectedTakeId).toBe("t1");
    line = addDialogueTake(line, take("t2"));
    expect(line.selectedTakeId).toBe("t1");
    expect(lineHasSelectedVoice(line)).toBe(true);
    expect(selectedDialogueTake(line)?.id).toBe("t1");
  });

  it("chọn bản khác + xoá bản đang chọn thì rơi về bản còn lại đầu tiên", () => {
    const { lines } = buildDialogueTrack(["Câu thoại hai."]);
    let line = addDialogueTake(lines[0], take("t1"));
    line = addDialogueTake(line, take("t2"));
    line = selectDialogueTake(line, "t2");
    expect(line.selectedTakeId).toBe("t2");
    line = removeDialogueTake(line, "t2");
    expect(line.selectedTakeId).toBe("t1");
    line = removeDialogueTake(line, "t1");
    expect(line.selectedTakeId).toBeUndefined();
    expect(lineHasSelectedVoice(line)).toBe(false);
  });

  it("âm lượng bản thu bị kẹp trong [0, 1.5]", () => {
    const { lines } = buildDialogueTrack(["Câu thoại ba."]);
    let line = addDialogueTake(lines[0], take("t1"));
    line = setDialogueTakeVolume(line, "t1", 9);
    expect(line.takes?.[0].volume).toBe(1.5);
    line = setDialogueTakeVolume(line, "t1", -2);
    expect(line.takes?.[0].volume).toBe(0);
  });
});
