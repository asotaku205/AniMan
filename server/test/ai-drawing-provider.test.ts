import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  buildGeminiDrawingOutput,
  normalizeGeminiOutput,
} from "../src/ai/driver/gemini-drawing-provider.js";
import {
  AiDrawingProviderTruncatedError,
} from "../src/ai/driver/ai-drawing-driver.js";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import {
  AI_STROKE_OPACITY_MAX,
  AI_STROKE_OPACITY_MIN,
  MAX_AI_BLUEPRINT_LAYERS,
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

// ─── Scene blueprint (Phase 5B) ─────────────────────────────────────────────

const BLUEPRINT_ORDER = [
  "background",
  "midground",
  "subject",
  "effects",
  "guide",
] as const;

function rawStroke(overrides: Record<string, unknown> = {}) {
  return {
    kind: "line",
    from: { x: 0.1, y: 0.1 },
    to: { x: 0.8, y: 0.9 },
    style: "flow",
    opacity: 0.5,
    strokeWidth: 0.005,
    ...overrides,
  };
}

function rawLayer(group: unknown, strokeCount = 3, extra: Record<string, unknown> = {}) {
  return {
    group,
    name: `Lớp ${String(group)}`,
    description: `Mô tả lớp ${String(group)}`,
    strokes: Array.from({ length: strokeCount }, () => rawStroke()),
    ...extra,
  };
}

function blueprintResponse(layers: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: "1",
    task: AiDrawingTask.SceneBlueprint,
    summary: "Toàn cảnh.",
    sourceIds: [],
    blueprint: {
      title: "  Toàn cảnh   thành phố  ",
      composition: "Chủ thể lệch phải.",
      lighting: "Sáng từ trái.",
      camera: "Góc thấp, 35mm.",
    },
    layers,
    strokes: [],
  };
}

describe("normalizeGeminiOutput — blueprint toàn cảnh (Phase 5B)", () => {
  it("buộc nét mang group của lớp và dựng lại strokes từ layers", () => {
    const normalized = normalizeGeminiOutput(
      blueprintResponse(BLUEPRINT_ORDER.map((group) => rawLayer(group))),
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    const layers = normalized.layers as Array<{
      group: string;
      strokes: Array<Record<string, unknown>>;
    }>;
    expect(layers).toHaveLength(5);
    expect(layers.map((layer) => layer.group)).toEqual([...BLUEPRINT_ORDER]);
    for (const layer of layers) {
      expect(layer.strokes).toHaveLength(3);
      // Nét model không khai group vẫn phải nằm đúng lớp của nó.
      for (const stroke of layer.strokes) {
        expect(stroke.group).toBe(layer.group);
      }
    }

    const strokes = normalized.strokes as unknown[];
    expect(strokes).toHaveLength(15);
    expect((normalized.blueprint as Record<string, unknown>).title).toBe(
      "Toàn cảnh thành phố",
    );

    // Kết quả chuẩn hoá phải qua được parser chặt.
    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.SceneBlueprint,
        new Set(),
      ),
    ).not.toThrow();
  });

  it("tự nối strokes khi model không trả mảng nét phẳng (Phase 5D)", () => {
    const layers = BLUEPRINT_ORDER.map((group) => rawLayer(group));
    const response = blueprintResponse(layers);
    // Prompt v2 (Phase 5D) không xin mảng nét phẳng nữa: provider phải tự nối
    // đúng bằng phép trải phẳng `layers[].strokes` thì parser mới nhận.
    delete response.strokes;

    const normalized = normalizeGeminiOutput(
      response,
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    const strokes = normalized.strokes as Array<{ group: string }>;
    expect(strokes).toHaveLength(15);
    expect(strokes.map((stroke) => stroke.group)).toEqual(
      BLUEPRINT_ORDER.flatMap((group) => [group, group, group]),
    );

    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.SceneBlueprint,
        new Set(),
      ),
    ).not.toThrow();
  });

  it("bỏ lớp sai nhóm, lớp trùng nhóm và lớp quá thưa nét", () => {
    const normalized = normalizeGeminiOutput(
      blueprintResponse([
        rawLayer("background"),
        rawLayer("background"),
        rawLayer("skyline"),
        rawLayer("midground", 2),
        rawLayer("subject"),
        rawLayer("effects"),
        rawLayer("guide"),
      ]),
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    const layers = normalized.layers as Array<{ group: string }>;
    expect(layers.map((layer) => layer.group)).toEqual([
      "background",
      "subject",
      "effects",
      "guide",
    ]);
    expect(normalized.strokes).toHaveLength(12);
  });
  it("không bịa tên/mô tả: lớp thiếu mô tả bị bỏ khỏi blueprint", () => {
    const layers = BLUEPRINT_ORDER.map((group) => rawLayer(group));
    layers[3] = rawLayer("effects", 3, { description: "   " });

    const normalized = normalizeGeminiOutput(
      blueprintResponse(layers),
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    const normalizedLayers = normalized.layers as Array<{ group: string }>;
    expect(normalizedLayers.map((layer) => layer.group)).not.toContain(
      "effects",
    );
  });

  it("chia ngân sách nét để blueprint đông nét vẫn đủ 5 lớp", () => {
    const normalized = normalizeGeminiOutput(
      blueprintResponse(BLUEPRINT_ORDER.map((group) => rawLayer(group, 40))),
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    const layers = normalized.layers as Array<{ strokes: unknown[] }>;
    expect(layers).toHaveLength(MAX_AI_BLUEPRINT_LAYERS - 1);
    expect(normalized.strokes).toHaveLength(MAX_AI_GHOST_STROKES);

    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.SceneBlueprint,
        new Set(),
      ),
    ).not.toThrow();
  });

  it("bỏ blueprint khi model không trả đủ bốn mô tả", () => {
    const response = blueprintResponse(
      BLUEPRINT_ORDER.map((group) => rawLayer(group)),
    );
    delete (response.blueprint as Record<string, unknown>).lighting;

    const normalized = normalizeGeminiOutput(
      response,
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    expect(normalized.blueprint).toBeUndefined();
    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.SceneBlueprint,
        new Set(),
      ),
    ).toThrow();
  });

  it("bỏ layers khi không lớp nào dùng được thay vì trả blueprint rỗng", () => {
    const normalized = normalizeGeminiOutput(
      blueprintResponse([rawLayer("skyline"), rawLayer("background", 1)]),
      providerRequest(AiDrawingTask.SceneBlueprint),
    ) as Record<string, unknown>;

    expect(normalized.layers).toBeUndefined();
    expect(normalized.strokes).toBeUndefined();
  });
});

describe("buildGeminiDrawingOutput — cắt output & tên model (Phase 5E)", () => {
  const sceneRequest = providerRequest(AiDrawingTask.SceneBlueprint);

  it("ném lỗi cắt khi finishReason là MAX_TOKENS, kèm số token để ghi log", () => {
    let caught: unknown;
    try {
      buildGeminiDrawingOutput(
        {
          text: '{"schemaVersion":"1","task":"scene_blueprint","summary":"dở',
          candidates: [{ finishReason: "MAX_TOKENS" }],
          usageMetadata: { candidatesTokenCount: 6871 },
        },
        sceneRequest,
        "gemini-flash-latest",
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AiDrawingProviderTruncatedError);
    const truncated = caught as AiDrawingProviderTruncatedError;
    expect(truncated.finishReason).toBe("MAX_TOKENS");
    expect(truncated.outputTokens).toBe(6871);
    expect(truncated.textLength).toBe(59);
  });

  it("kiểm finishReason TRƯỚC khi đọc JSON, để không núp dưới lỗi parse", () => {
    // JSON hợp lệ nhưng bị cắt: nếu kiểm parse trước thì lỗi ra là "parse", đúng cái ngụy trang cũ.
    expect(() =>
      buildGeminiDrawingOutput(
        {
          text: '{"schemaVersion":"1","task":"scene_blueprint"}',
          candidates: [{ finishReason: "MAX_TOKENS" }],
        },
        sceneRequest,
        "gemini-flash-latest",
      ),
    ).toThrow(AiDrawingProviderTruncatedError);
  });

  it("điền model thật đã phục vụ vào phản hồi", () => {
    const output = buildGeminiDrawingOutput(
      {
        text: JSON.stringify({
          schemaVersion: "1",
          task: "stroke_guidance",
          summary: "Gợi ý nét.",
          sourceIds: [],
          strokes: [],
        }),
        candidates: [{ finishReason: "STOP" }],
      },
      providerRequest(),
      "gemini-2.5-flash-fallback",
    ) as Record<string, unknown>;

    expect(output.model).toBe("gemini-2.5-flash-fallback");
    expect(parseAiDrawingResponse(output, AiDrawingTask.StrokeGuidance, new Set())).toMatchObject({
      model: "gemini-2.5-flash-fallback",
    });
  });

  it("phân biệt text rỗng với output bị cắt", () => {
    expect(() =>
      buildGeminiDrawingOutput(
        { text: "", candidates: [{ finishReason: "STOP" }] },
        sceneRequest,
        "gemini-flash-latest",
      ),
    ).toThrow(/empty or non-text/);
  });

  it("JSON hỏng mà không bị cắt vẫn là lỗi provider thường", () => {
    expect(() =>
      buildGeminiDrawingOutput(
        { text: "{ không phải JSON", candidates: [{ finishReason: "STOP" }] },
        sceneRequest,
        "gemini-flash-latest",
      ),
    ).toThrow(/could not be parsed as JSON/);
  });
});

describe("normalizeReviewFindings — góp ý chấm tranh (Phase 5G)", () => {
  const reviewRequest = providerRequest(AiDrawingTask.DrawingReview);

  function reviewResponse(findings: unknown[]): Record<string, unknown> {
    return {
      schemaVersion: "1",
      task: AiDrawingTask.DrawingReview,
      summary: "Chấm tranh.",
      sourceIds: [],
      findings,
    };
  }

  const validFinding = {
    principle: "proportion",
    region: { x: 0.2, y: 0.3, width: 0.2, height: 0.4 },
    issue: "Đầu hơi lớn so với thân.",
    recommendation: "Thu nhỏ đầu khoảng 10%.",
    severity: "medium",
    confidence: 0.7,
  };

  it("bỏ khoá lạ trong region và trong finding rồi parser vẫn nhận", () => {
    const normalized = normalizeGeminiOutput(
      reviewResponse([
        {
          ...validFinding,
          region: { ...validFinding.region, label: "vùng đầu" },
          note: "model tự thêm",
        },
      ]),
      reviewRequest,
    ) as Record<string, unknown>;

    const findings = normalized.findings as Array<Record<string, unknown>>;
    expect(findings).toHaveLength(1);
    expect(findings[0].region).toEqual({
      x: 0.2,
      y: 0.3,
      width: 0.2,
      height: 0.4,
    });
    expect(findings[0]).not.toHaveProperty("note");

    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.DrawingReview,
        new Set(),
      ),
    ).not.toThrow();
  });

  it("nhận bí danh w/h cho vùng lỗi", () => {
    const normalized = normalizeGeminiOutput(
      reviewResponse([
        {
          ...validFinding,
          region: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
        },
      ]),
      reviewRequest,
    ) as Record<string, unknown>;

    const findings = normalized.findings as Array<Record<string, unknown>>;
    expect(findings[0].region).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.5,
      height: 0.5,
    });
  });

  it("bỏ finding có vùng không dựng được, giữ finding còn đọc được", () => {
    const normalized = normalizeGeminiOutput(
      reviewResponse([
        validFinding,
        { ...validFinding, region: { x: 0.1, y: 0.1 } },
        { ...validFinding, region: "góc trên trái" },
      ]),
      reviewRequest,
    ) as Record<string, unknown>;

    expect(normalized.findings).toHaveLength(1);
  });

  it("không còn finding nào thì xoá findings để parser vẫn báo lỗi hợp đồng", () => {
    const normalized = normalizeGeminiOutput(
      reviewResponse([{ ...validFinding, region: { x: 2, y: 0, width: 0.1, height: 0.1 } }]),
      reviewRequest,
    ) as Record<string, unknown>;

    expect(normalized).not.toHaveProperty("findings");
    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.DrawingReview,
        new Set(),
      ),
    ).toThrow(/findings/);
  });

  it("cắt lời góp ý quá dài thay vì loại cả phản hồi", () => {
    const normalized = normalizeGeminiOutput(
      reviewResponse([
        {
          ...validFinding,
          issue: "a".repeat(600),
          recommendation: "b".repeat(600),
        },
      ]),
      reviewRequest,
    ) as Record<string, unknown>;

    const findings = normalized.findings as Array<Record<string, unknown>>;
    expect((findings[0].issue as string).length).toBe(400);
    expect((findings[0].recommendation as string).length).toBe(400);

    expect(() =>
      parseAiDrawingResponse(
        normalized,
        AiDrawingTask.DrawingReview,
        new Set(),
      ),
    ).not.toThrow();
  });
});
