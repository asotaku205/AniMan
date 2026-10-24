import { describe, expect, it } from "vitest";
import {
  createActionSegment,
  sampleActionSegment,
} from "../lib/actionTrack";

describe("Rãnh hành động", () => {
  it("đoạn đang phát tại t, ngoài đoạn trả null", () => {
    const a = { ...createActionSegment("Run", 2, 3), loop: true, speed: 1 };
    expect(sampleActionSegment([a], 1.9)).toBeNull();
    expect(sampleActionSegment([a], 2)?.segment.clipName).toBe("Run");
    expect(sampleActionSegment([a], 4.9)?.segment.clipName).toBe("Run");
    expect(sampleActionSegment([a], 5)).toBeNull();
  });

  it("thời gian trong clip đã nhân tốc độ", () => {
    const a = { ...createActionSegment("Walk", 1, 4), speed: 2 };
    expect(sampleActionSegment([a], 2)?.localSec).toBeCloseTo(2);
  });

  it("đoạn chồng nhau: đoạn bắt đầu muộn nhất thắng", () => {
    const a = createActionSegment("Idle", 0, 10);
    const b = createActionSegment("Jump", 3, 2);
    expect(sampleActionSegment([a, b], 4)?.segment.clipName).toBe("Jump");
    expect(sampleActionSegment([a, b], 6)?.segment.clipName).toBe("Idle");
  });

  it("danh sách rỗng hoặc thiếu trả null", () => {
    expect(sampleActionSegment([], 1)).toBeNull();
    expect(sampleActionSegment(undefined, 1)).toBeNull();
  });
});
