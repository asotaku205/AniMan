import { describe, expect, it } from "vitest";
import type { AiDrawingFinding } from "@/lib/ai-drawing-api";
import { cleanupCandidates, regionToPixelRect } from "../lib/strokeCleanup";

function finding(overrides: Partial<AiDrawingFinding> = {}): AiDrawingFinding {
  return {
    principle: "composition",
    region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    issue: "Nét phác trùng ở viền tóc.",
    recommendation: "Giữ một nét, tẩy nét trùng.",
    severity: "low",
    confidence: 0.8,
    ...overrides,
  };
}

describe("cleanupCandidates — lọc vùng nét thừa (Slice 3)", () => {
  it("chỉ lấy finding có cờ cleanup, giữ chỉ số gốc", () => {
    const findings = [
      finding(),
      finding({ cleanup: { overlapRisk: false } }),
      finding({ cleanup: { overlapRisk: true } }),
    ];
    const candidates = cleanupCandidates(findings);
    expect(candidates.map((c) => c.index)).toEqual([1, 2]);
    expect(candidates[0].overlapRisk).toBe(false);
    expect(candidates[1].overlapRisk).toBe(true);
  });

  it("không có finding nét thừa → mảng rỗng", () => {
    expect(cleanupCandidates([finding(), finding()])).toEqual([]);
    expect(cleanupCandidates([])).toEqual([]);
  });
});

describe("regionToPixelRect — vùng normalized sang pixel", () => {
  it("nhân theo kích thước canvas và làm tròn ra ngoài", () => {
    expect(
      regionToPixelRect({ x: 0.125, y: 0.25, width: 0.25, height: 0.5 }, 1000, 500),
    ).toEqual({ x: 125, y: 125, width: 250, height: 250 });
  });

  it("kẹp vùng vượt biên vào trong khung", () => {
    expect(
      regionToPixelRect({ x: 0.9, y: 0.9, width: 0.3, height: 0.3 }, 100, 100),
    ).toEqual({ x: 90, y: 90, width: 10, height: 10 });
  });

  it("canvas suy biến → hình rỗng", () => {
    expect(
      regionToPixelRect({ x: 0, y: 0, width: 1, height: 1 }, 0, 100),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});
