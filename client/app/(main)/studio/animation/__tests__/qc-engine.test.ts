import { describe, expect, it } from "vitest";
import {
  applyMechanicalFixes,
  NETFLIX_QC_PROFILE,
  validateCues,
} from "../lib/qcEngine";
import { createCue } from "../lib/library";

describe("qcEngine — chuẩn Netflix", () => {
  const fps = 25;

  it("bắt CPS cao, dòng dài, cue ngắn, chồng lấp", () => {
    const a = createCue("ep", 0, 1);
    a.text = "Câu này dài thật dài để CPS vượt ngưỡng hai mươi ký tự giây";
    const b = createCue("ep", 0.8, 0.5); // chồng lấp + quá ngắn
    b.text = "Ngắn";
    const issues = validateCues([a, b], NETFLIX_QC_PROFILE, fps);
    const kinds = issues.map((i) => i.kind);
    expect(kinds).toContain("cps");
    expect(kinds).toContain("line-length");
    expect(kinds).toContain("overlap");
    expect(kinds).toContain("duration-short");
  });

  it("cue đạt chuẩn thì không có lỗi error", () => {
    const a = createCue("ep", 0, 3);
    a.text = "Xin chào mọi người";
    const b = createCue("ep", 3.2, 3);
    b.text = "Hôm nay trời đẹp";
    const issues = validateCues([a, b], NETFLIX_QC_PROFILE, fps);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("gap dưới 2 frame bị cảnh báo", () => {
    const a = createCue("ep", 0, 3);
    a.text = "Một";
    const b = createCue("ep", 3.04, 3); // gap 0.04s = 1 frame @25fps
    b.text = "Hai";
    const issues = validateCues([a, b], NETFLIX_QC_PROFILE, fps);
    expect(issues.some((i) => i.kind === "gap")).toBe(true);
  });

  it("sửa cơ học: cắt trắng, kéo cue ngắn, hết chồng lấp", () => {
    const a = createCue("ep", 0, 3);
    a.text = "  Xin chào   mọi người ";
    const b = createCue("ep", 2.5, 0.5);
    b.text = "Ngắn";
    const { cues, applied } = applyMechanicalFixes([a, b], NETFLIX_QC_PROFILE, fps);
    expect(applied.length).toBeGreaterThan(0);
    const after = validateCues(cues, NETFLIX_QC_PROFILE, fps);
    expect(after.some((i) => i.kind === "whitespace")).toBe(false);
    expect(after.some((i) => i.kind === "overlap")).toBe(false);
    const cueB = cues.find((c) => c.id === b.id)!;
    expect(cueB.durationSec).toBeGreaterThanOrEqual(NETFLIX_QC_PROFILE.minDurationSec);
  });
});
