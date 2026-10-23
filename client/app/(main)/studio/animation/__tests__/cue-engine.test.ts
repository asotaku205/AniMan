import { describe, expect, it } from "vitest";
import {
  formatTimecode,
  parseTimecode,
  snapToFrame,
} from "../lib/timecode";
import {
  mergeCueWithNext,
  nudgeCue,
  setCueInOut,
  snapCueStart,
  snapTargetsFor,
  splitCue,
} from "../lib/cueEngine";
import { computePeaks } from "../lib/waveform";
import { createCue } from "../lib/library";

describe("timecode — HH:MM:SS:FF theo fps", () => {
  it("format/parse khứ hồi và snap về biên frame", () => {
    expect(formatTimecode(3661.5, 25)).toBe("01:01:01:12");
    expect(formatTimecode(0, 24)).toBe("00:00:00:00");
    expect(parseTimecode("01:01:01:12", 25)).toBeCloseTo(3661.48);
    expect(parseTimecode("02:10", 25)).toBeCloseTo(2.4);
    expect(parseTimecode("x:y", 25)).toBeNull();
    expect(snapToFrame(1.03, 25)).toBeCloseTo(1.04);
    expect(snapToFrame(1.01, 25)).toBeCloseTo(1.0);
  });
});

describe("cueEngine — spotting/biên tập cue", () => {
  const mk = () => {
    const a = createCue("ep", 1, 3);
    a.text = "Câu một";
    const b = createCue("ep", 5, 2);
    b.text = "Câu hai";
    return { a, b, cues: [a, b] };
  };

  it("split tại playhead tạo 2 cue liên tiếp, phần hai trống nội dung", () => {
    const { a, cues } = mk();
    const out = splitCue(cues, a.id, 2.5);
    expect(out).toHaveLength(3);
    expect(out[0].durationSec).toBeCloseTo(1.5);
    expect(out[1].startSec).toBeCloseTo(2.5);
    expect(out[1].text).toBe("");
    // split quá sát biên → không đổi
    expect(splitCue(cues, a.id, 1.05)).toHaveLength(2);
  });

  it("merge gộp nội dung và kéo dài tới hết cue sau", () => {
    const { a, cues } = mk();
    const out = mergeCueWithNext(cues, a.id);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Câu một Câu hai");
    expect(out[0].startSec + out[0].durationSec).toBeCloseTo(7);
  });

  it("nudge/snap/in-out hoạt động đúng biên", () => {
    const { a, b, cues } = mk();
    expect(nudgeCue(cues, a.id, -5)[0].startSec).toBe(0);
    const targets = snapTargetsFor(cues, a.id);
    expect(targets).toContain(5);
    expect(snapCueStart(5.08, targets)).toBe(5);
    expect(snapCueStart(5.4, targets)).toBeCloseTo(5.4);
    const set = setCueInOut(cues, b.id, 4.5, 8);
    const nb = set.find((c) => c.id === b.id)!;
    expect(nb.startSec).toBeCloseTo(4.5);
    expect(nb.durationSec).toBeCloseTo(3.5);
  });
});

describe("waveform — computePeaks", () => {
  it("lấy trị tuyệt đối lớn nhất mỗi bucket", () => {
    const data = new Float32Array([0.1, -0.5, 0.2, 0.9, -0.3, 0.05]);
    expect(computePeaks(data, 3)).toEqual([
      expect.closeTo(0.5),
      expect.closeTo(0.9),
      expect.closeTo(0.3),
    ]);
    expect(computePeaks(new Float32Array(0), 4)).toEqual([]);
  });
});
