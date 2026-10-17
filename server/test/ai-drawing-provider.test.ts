import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  normalizeGeminiOutput,
} from "../src/ai/driver/gemini-drawing-provider.js";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import {
  AI_STROKE_OPACITY_MAX,
  AI_STROKE_OPACITY_MIN,
  MAX_AI_GHOST_STROKES,
  MAX_AI_STROKE_LABEL_LENGTH,
  MAX_AI_STROKE_POINTS,
  parseAiDrawingResponse,
} from "../src/ai/contracts/ai-drawing-response.js";
import type { AiDrawingProviderRequest } from "../src/ai/driver/ai-drawing-driver.js";

function providerRequest(
  task: AiDrawingTask = AiDrawingTask.StrokeGuidance,
): AiDrawingProviderRequest {
  return {
    modelId: "test-vision-model",
    task,
    templateId: "test-template",
    templateVersion: "1",
    systemInstruction: "test",
    prompt: "vẽ một dáng người đang vung kiếm",
    evidence: [],
    maxOutputTokens: 4096,
  };
}

function baseResponse(strokes: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: "1",
    task: AiDrawingTask.StrokeGuidance,
    summary: "Gợi ý nét.",
    sourceIds: [],
    strokes,
  };
}

describe("normalizeGeminiOutput — nét gợi ý (Phase 5A)", () => {
  it("điền group/label mặc định để parser chặt luôn nhận được", () => {
    const request = providerRequest();
    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow",
          opacity: 0.5,
          strokeWidth: 0.005,
        },
      ]),
      request,
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect(strokes).toHaveLength(1);
    expect(strokes[0].group).toBe("detail");
    expect(strokes[0].label).toBe("");

    // Kết quả chuẩn hoá phải qua được parser chặt.
    expect(() =>
      parseAiDrawingResponse(normalized, request.task, new Set()),
    ).not.toThrow();
  });

  it("giữ nhóm hợp lệ và gộp khoảng trắng của nhãn", () => {
    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow",
          group: "subject",
          label: "  viền   tóc\nbên phải ",
          opacity: 0.6,
          strokeWidth: 0.008,
        },
        {
          kind: "line",
          from: { x: 0.2, y: 0.2 },
          to: { x: 0.8, y: 0.8 },
          style: "flow",
          group: "foreground", // nhóm lạ → detail
          opacity: 0.6,
          strokeWidth: 0.008,
        },
      ]),
      providerRequest(),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect(strokes[0].group).toBe("subject");
    expect(strokes[0].label).toBe("viền tóc bên phải");
    expect(strokes[1].group).toBe("detail");
  });

  it("cắt nhãn quá dài theo giới hạn hợp đồng", () => {
    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow",
          label: "x".repeat(MAX_AI_STROKE_LABEL_LENGTH + 20),
          opacity: 0.6,
          strokeWidth: 0.008,
        },
      ]),
      providerRequest(),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect((strokes[0].label as string).length).toBeLessThanOrEqual(
      MAX_AI_STROKE_LABEL_LENGTH,
    );
    expect(strokes[0].label).toMatch(/\.\.\.$/);
  });

  it("kẹp opacity vào 0.15..0.9 và mặc định 0.55 khi model bỏ trống", () => {
    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow",
          opacity: 0.02, // dưới sàn
          strokeWidth: 0.005,
        },
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow",
          opacity: 1.6, // trên trần
          strokeWidth: 0.005,
        },
        {
          kind: "line",
          from: { x: 0.1, y: 0.1 },
          to: { x: 0.9, y: 0.9 },
          style: "flow", // không khai opacity
          strokeWidth: 0.005,
        },
      ]),
      providerRequest(),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect(strokes[0].opacity).toBe(AI_STROKE_OPACITY_MIN);
    expect(strokes[1].opacity).toBe(AI_STROKE_OPACITY_MAX);
    expect(strokes[2].opacity).toBe(0.55);
  });

  it("tự khép path khi có màu tô, và bỏ màu tô không hợp lệ", () => {
    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "path",
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.6, y: 0.2 },
            { x: 0.6, y: 0.6 },
          ],
          style: "lighting",
          group: "effects",
          label: "mảng tối",
          opacity: 0.5,
          strokeWidth: 0.01,
          fill: "#AABBCC", // hoa → hạ về chữ thường
        },
        {
          kind: "path",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.2, y: 0.2 },
          ],
          style: "lighting",
          group: "effects",
          label: "màu sai",
          opacity: 0.5,
          strokeWidth: 0.01,
          fill: "red",
        },
        {
          kind: "path",
          points: [
            { x: 0.1, y: 0.1 },
            { x: 0.3, y: 0.3 },
          ],
          style: "lighting",
          group: "effects",
          label: "không tô",
          opacity: 0.5,
          strokeWidth: 0.01,
          fill: "none",
        },
      ]),
      providerRequest(),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect(strokes[0].fill).toBe("#aabbcc");
    expect(strokes[0].closed).toBe(true);
    expect(strokes[1].fill).toBeUndefined();
    expect(strokes[1].closed).toBeUndefined();
    expect(strokes[2].fill).toBe("none");
    expect(strokes[2].closed).toBeUndefined();

    // Parser chặt vẫn nhận (điểm mấu chốt của "provider normalize, parser strict").
    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.StrokeGuidance,
        new Set(),
      ),
    ).not.toThrow();
  });

  it("bỏ trường lạ và chặn trần số nét/số điểm", () => {
    const manyPoints = Array.from(
      { length: MAX_AI_STROKE_POINTS + 25 },
      (_, index) => ({ x: index / 1000, y: index / 1000 }),
    );
    const manyStrokes = Array.from(
      { length: MAX_AI_GHOST_STROKES + 5 },
      () => ({
        kind: "line",
        from: { x: 0.1, y: 0.1 },
        to: { x: 0.9, y: 0.9 },
        style: "flow",
        opacity: 0.5,
        strokeWidth: 0.005,
        color: "#ff0000", // trường lạ → phải bị bỏ
      }),
    );

    const normalized = normalizeGeminiOutput(
      baseResponse([
        {
          kind: "path",
          points: manyPoints,
          style: "flow",
          opacity: 0.5,
          strokeWidth: 0.005,
        },
        ...manyStrokes,
      ]),
      providerRequest(),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<Record<string, unknown>>;
    expect(strokes).toHaveLength(MAX_AI_GHOST_STROKES);
    expect((strokes[0].points as unknown[]).length).toBe(
      MAX_AI_STROKE_POINTS,
    );
    expect(strokes[1].color).toBeUndefined();
  });

  it("không đụng vào strokes của task không phải nét gợi ý", () => {
    const raw = {
      schemaVersion: "1",
      task: AiDrawingTask.CompositionGuidance,
      summary: "Bố cục.",
      sourceIds: [],
      recommendations: [],
      strokes: [{ kind: "line", style: "flow" }],
    };
    const normalized = normalizeGeminiOutput(
      raw,
      providerRequest(AiDrawingTask.CompositionGuidance),
    ) as Record<string, unknown>;

    expect(normalized.strokes).toEqual([{ kind: "line", style: "flow" }]);
  });
});
