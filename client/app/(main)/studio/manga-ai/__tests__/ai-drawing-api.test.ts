import { describe, expect, it } from "vitest";
import {
  AI_DRAWING_ERROR_CODES,
  AI_DRAWING_MODEL_LABEL,
  AI_PANEL_CAMERAS,
  AI_STROKE_GROUPS,
  MAX_STORY_FLOW_PANELS,
  MIN_BLUEPRINT_LAYERS,
  extractErrorMessage,
  isPageStoryFlowResponse,
  isSceneBlueprintResponse,
  selectStoryFlowPanelsForLayout,
  type AiBlueprintLayer,
  type AiPageStoryFlowPanelHint,
  type AiPageStoryFlowResponse,
  type AiSceneBlueprintResponse,
  type AiStrokeGroup,
  type AiStrokePath,
} from "@/lib/ai-drawing-api";

const validResponse: AiPageStoryFlowResponse = {
  schemaVersion: "1",
  task: "page_story_flow",
  summary: "Trang dồn nhịp từ toàn cảnh xuống cận cảnh gương mặt.",
  sourceIds: [],
  flow: "Sân trường vắng → tiếng bước chân → quay đầu → gương mặt sững lại.",
  panels: [
    { panelId: "p1", order: 1, hint: "Toàn cảnh sân trường.", camera: "toàn cảnh" },
    { panelId: "p2", order: 2, hint: "Cận đôi giày dừng lại.", camera: "cận cảnh" },
    { panelId: "p3", order: 3, hint: "Nhân vật quay đầu.", camera: "trung cảnh" },
  ],
};

describe("Hợp đồng page_story_flow phía client (D-1)", () => {
  it("nhận phản hồi hợp lệ", () => {
    expect(isPageStoryFlowResponse(validResponse)).toBe(true);
  });

  it("nhãn model khớp profile server đang dùng", () => {
    expect(AI_DRAWING_MODEL_LABEL).toBe("gemini-flash-latest");
  });

  it("có đúng bốn cỡ cảnh hợp lệ", () => {
    expect([...AI_PANEL_CAMERAS]).toEqual([
      "toàn cảnh",
      "trung cảnh",
      "cận cảnh",
      "chuyển động",
    ]);
  });

  it("loại phản hồi thiếu mạch truyện", () => {
    const withoutFlow: Record<string, unknown> = { ...validResponse };
    delete withoutFlow.flow;
    expect(isPageStoryFlowResponse(withoutFlow)).toBe(false);
  });

  it("loại phản hồi không có khung nào", () => {
    expect(isPageStoryFlowResponse({ ...validResponse, panels: [] })).toBe(
      false,
    );
  });

  it("loại phản hồi vượt trần số khung mỗi trang", () => {
    const panels = Array.from(
      { length: MAX_STORY_FLOW_PANELS + 1 },
      (_, index): AiPageStoryFlowPanelHint => ({
        panelId: `p${index + 1}`,
        order: index + 1,
        hint: "Khung thừa.",
        camera: "trung cảnh",
      }),
    );

    expect(isPageStoryFlowResponse({ ...validResponse, panels })).toBe(false);
  });

  it("loại cỡ cảnh ngoài hợp đồng", () => {
    const panels = [
      { ...validResponse.panels[0], camera: "góc rộng" },
    ] as unknown;

    expect(isPageStoryFlowResponse({ ...validResponse, panels })).toBe(false);
  });

  it("loại thứ tự khung không phải số nguyên", () => {
    const panels = [{ ...validResponse.panels[0], order: 1.5 }];

    expect(isPageStoryFlowResponse({ ...validResponse, panels })).toBe(false);
  });

  it("loại task khác", () => {
    expect(
      isPageStoryFlowResponse({ ...validResponse, task: "drawing_review" }),
    ).toBe(false);
  });
});

describe("Đối chiếu gợi ý khung với layout đang mở (VD-5)", () => {
  const hint = (
    panelId: string,
    order: number,
    extra: Partial<AiPageStoryFlowPanelHint> = {},
  ): AiPageStoryFlowPanelHint => ({
    panelId,
    order,
    hint: `Gợi ý ${panelId}`,
    camera: "trung cảnh",
    ...extra,
  });

  it("bỏ khung không có trong layout", () => {
    const kept = selectStoryFlowPanelsForLayout(
      [hint("p1", 1), hint("p7", 2), hint("p2", 3)],
      ["p1", "p2", "p3"],
    );

    expect(kept.map((p) => p.panelId)).toEqual(["p1", "p2"]);
  });

  it("sắp theo thứ tự đọc của AI, không theo thứ tự layout", () => {
    const kept = selectStoryFlowPanelsForLayout(
      [hint("p3", 1), hint("p1", 2), hint("p2", 3)],
      ["p1", "p2", "p3"],
    );

    expect(kept.map((p) => p.panelId)).toEqual(["p3", "p1", "p2"]);
  });

  it("gộp khung trùng id, giữ gợi ý có thứ tự đọc nhỏ hơn", () => {
    const kept = selectStoryFlowPanelsForLayout(
      [hint("p2", 5, { hint: "Bản đến sau" }), hint("p2", 2, { hint: "Bản chính" })],
      ["p1", "p2"],
    );

    expect(kept).toHaveLength(1);
    expect(kept[0].hint).toBe("Bản chính");
  });

  it("khi hai khung cùng thứ tự thì xếp theo thứ tự layout", () => {
    const kept = selectStoryFlowPanelsForLayout(
      [hint("p3", 1), hint("p1", 1)],
      ["p1", "p2", "p3"],
    );

    expect(kept.map((p) => p.panelId)).toEqual(["p1", "p3"]);
  });

  it("bỏ gợi ý rỗng", () => {
    const kept = selectStoryFlowPanelsForLayout(
      [hint("p1", 1, { hint: "   " }), hint("p2", 2)],
      ["p1", "p2"],
    );

    expect(kept.map((p) => p.panelId)).toEqual(["p2"]);
  });

  it("trả mảng rỗng khi layout không khớp gì (không ném lỗi)", () => {
    expect(selectStoryFlowPanelsForLayout([hint("p9", 1)], ["p1"])
    ).toEqual([]);
  });
});

describe("Nét AI v2 phía client (Phase 5A)", () => {
  it("có đúng sáu nhóm nội dung, đúng thứ tự vẽ của server", () => {
    expect([...AI_STROKE_GROUPS]).toEqual([
      "background",
      "midground",
      "subject",
      "detail",
      "effects",
      "guide",
    ]);
  });

  it("kiểu nét v2 nhận group/label và tùy chọn closed/fill", () => {
    const stroke: AiStrokePath = {
      kind: "path",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.6, y: 0.3 },
        { x: 0.5, y: 0.7 },
      ],
      style: "lighting",
      group: "effects",
      label: "mảng bóng đổ dưới cằm",
      opacity: 0.62,
      strokeWidth: 0.012,
      closed: true,
      fill: "#223344",
    };

    expect(stroke.group).toBe("effects");
    expect(stroke.label).toContain("bóng đổ");
    expect(stroke.closed).toBe(true);
  });
});

describe("Hợp đồng scene_blueprint phía client (Phase 5B)", () => {
  function stroke(group: AiStrokeGroup): AiStrokePath {
    return {
      kind: "line",
      from: { x: 0.1, y: 0.1 },
      to: { x: 0.8, y: 0.8 },
      style: "composition",
      group,
      label: "nét",
      opacity: 0.5,
      strokeWidth: 0.005,
    };
  }

  function blueprintResponse(): AiSceneBlueprintResponse {
    const layers: AiBlueprintLayer[] = (
      ["background", "midground", "subject", "effects", "guide"] as const
    ).map((group, index) => ({
      group,
      name: `Lớp ${index + 1}`,
      description: `Mô tả ${index + 1}`,
      strokes: [stroke(group), stroke(group), stroke(group)],
    }));

    return {
      schemaVersion: "1",
      task: "scene_blueprint",
      summary: "Toàn cảnh.",
      sourceIds: [],
      blueprint: {
        title: "Toàn cảnh",
        composition: "Chủ thể lệch phải.",
        lighting: "Sáng từ trái.",
        camera: "Góc thấp.",
      },
      layers,
      strokes: layers.flatMap((layer) => layer.strokes),
    };
  }

  function asRaw(response: AiSceneBlueprintResponse): Record<string, unknown> {
    return response as unknown as Record<string, unknown>;
  }

  it("nhận phản hồi toàn cảnh hợp lệ", () => {
    const response = blueprintResponse();
    expect(isSceneBlueprintResponse(response)).toBe(true);
    expect(response.layers).toHaveLength(MIN_BLUEPRINT_LAYERS);
    expect(response.strokes).toHaveLength(15);
  });

  it("loại blueprint thiếu mô tả toàn cảnh", () => {
    const response = asRaw(blueprintResponse());
    response.blueprint = { title: "Thiếu" };
    expect(isSceneBlueprintResponse(response)).toBe(false);
  });

  it("loại blueprint dưới năm lớp", () => {
    const response = asRaw(blueprintResponse());
    const layers = response.layers as unknown[];
    response.layers = layers.slice(0, MIN_BLUEPRINT_LAYERS - 1);
    expect(isSceneBlueprintResponse(response)).toBe(false);
  });

  it("loại lớp mang nhóm nội dung ngoài hợp đồng", () => {
    const response = asRaw(blueprintResponse());
    const layers = response.layers as Array<Record<string, unknown>>;
    layers[2] = { ...layers[2], group: "skyline" };
    expect(isSceneBlueprintResponse(response)).toBe(false);
  });

  it("loại khi strokes không trải phẳng đúng bằng layers", () => {
    const response = asRaw(blueprintResponse());
    response.strokes = (response.strokes as unknown[]).slice(0, -1);
    expect(isSceneBlueprintResponse(response)).toBe(false);
  });

  it("loại task khác dù cấu trúc giống", () => {
    const response = asRaw(blueprintResponse());
    response.task = "stroke_guidance";
    expect(isSceneBlueprintResponse(response)).toBe(false);
  });
});

describe("Thông báo lỗi AI theo mã lỗi (Phase 5E)", () => {
  it("có đúng sáu mã lỗi và khớp khoá hợp đồng phía server", () => {
    expect(Object.values(AI_DRAWING_ERROR_CODES).sort()).toEqual([
      "ai_invalid_response",
      "ai_model_unavailable",
      "ai_output_truncated",
      "ai_provider_error",
      "ai_provider_overloaded",
      "ai_timeout",
    ]);
  });

  it("đọc `code` trong body để nói đúng nguyên nhân, không gộp vào một câu 503", () => {
    expect(
      extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.outputTruncated }, 502),
    ).toMatch(/cắt giữa dòng/);
    expect(
      extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.providerOverloaded }, 503),
    ).toMatch(/quá tải/);
    expect(
      extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.modelUnavailable }, 503),
    ).toMatch(/đang tắt/);
    expect(
      extractErrorMessage(
        { code: AI_DRAWING_ERROR_CODES.providerRequestFailed },
        502,
      ),
    ).toMatch(/Không nhận được phản hồi dùng được/);
    expect(
      extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.invalidResponse }, 502),
    ).toMatch(/không đúng định dạng/);
    expect(extractErrorMessage({ code: AI_DRAWING_ERROR_CODES.timeout }, 504)).toMatch(
      /quá lâu/,
    );
  });

  it("không hiện chuỗi kỹ thuật tiếng Anh của server khi có mã lỗi", () => {
    const message = extractErrorMessage(
      {
        statusCode: 502,
        code: AI_DRAWING_ERROR_CODES.outputTruncated,
        message: "AI provider stopped before finishing the response",
      },
      502,
    );
    expect(message).not.toMatch(/provider|response/i);
  });

  it("vẫn theo `status` khi server chưa có mã (bản cũ)", () => {
    expect(extractErrorMessage({ message: "unavailable" }, 503)).toMatch(
      /chờ kích hoạt hoặc bảo trì/,
    );
    expect(extractErrorMessage(undefined, 504)).toMatch(/quá lâu/);
    expect(extractErrorMessage(undefined, 429)).toMatch(/quá số lượt/);
    expect(extractErrorMessage(undefined, 403)).toMatch(/đăng nhập/);
  });

  it("mã lỗi lạ vẫn quay về câu theo status, không hiện mã thô", () => {
    expect(extractErrorMessage({ code: "ai_something_new" }, 503)).toMatch(
      /chờ kích hoạt hoặc bảo trì/,
    );
    expect(extractErrorMessage({ code: "ai_something_new" }, 502)).toMatch(
      /Không thể hoàn thành/,
    );
  });
});
