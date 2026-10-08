import "reflect-metadata";
import {
  DRAWING_KNOWLEDGE_CARDS,
  DRAWING_KNOWLEDGE_VERSION,
  retrieveDrawingKnowledge,
} from "../src/ai/knowledge/drawing-knowledge.js";
import { AiDrawingTask } from "../src/ai/contracts/ai-drawing-request.dto.js";
import { parseAiDrawingResponse } from "../src/ai/contracts/ai-drawing-response.js";

describe("drawing knowledge cards", () => {
  it("provides unique, versioned cards with attribution and license metadata", () => {
    const ids = DRAWING_KNOWLEDGE_CARDS.map(({ id }) => id);
    const topics = new Set(DRAWING_KNOWLEDGE_CARDS.map(({ topic }) => topic));

    expect(new Set(ids).size).toBe(ids.length);
    expect(topics).toEqual(
      new Set([
        "composition",
        "visual_flow",
        "proportion",
        "color",
        "value_and_lighting",
        "perspective",
        "panel_storytelling",
      ]),
    );
    for (const card of DRAWING_KNOWLEDGE_CARDS) {
      expect(card.version).toBe(DRAWING_KNOWLEDGE_VERSION);
      expect(card.source.title).toBe(
        "Introduction to Art: Design, Context, and Meaning",
      );
      expect(card.source.authors).toHaveLength(4);
      expect(card.source.url).toContain("oer.galileo.usg.edu");
      expect(card.source.license).toBe("CC-BY-SA-4.0");
      expect(card.source.licenseUrl).toContain("creativecommons.org");
      expect(card.attribution).toContain("No source passages or images");
      expect(card.guidance.length).toBeGreaterThan(0);
      expect(card.exercise.length).toBeGreaterThan(0);
    }
  });

  it("retrieves lighting and shadow guidance from Vietnamese terms", () => {
    const result = retrieveDrawingKnowledge(
      "Tôi cần gợi ý hướng ánh sáng và bóng đổ",
      AiDrawingTask.CompositionGuidance,
    );

    expect(result[0]?.id).toBe("value-light-shadow-planes");
  });

  it("matches Vietnamese queries without diacritics", () => {
    const result = retrieveDrawingKnowledge(
      "bo cuc can bang va diem nhan",
      AiDrawingTask.CompositionGuidance,
    );

    expect(result.map(({ id }) => id)).toContain(
      "composition-balance-and-thirds",
    );
  });

  it("retrieves panel storytelling for a drawing review", () => {
    const result = retrieveDrawingKnowledge(
      "Kiểm tra nhịp kể chuyện giữa các panel manga",
      AiDrawingTask.DrawingReview,
    );

    expect(result[0]?.id).toBe("panel-storytelling-variation");
  });

  it("returns no unsupported source for unrelated topics", () => {
    expect(
      retrieveDrawingKnowledge(
        "Tối ưu truy vấn SQL cho trang quản trị",
        AiDrawingTask.DrawingReview,
      ),
    ).toEqual([]);
  });

  it("allows retrieved card IDs as citations in the response contract", () => {
    const retrieved = retrieveDrawingKnowledge(
      "cân bằng bố cục",
      AiDrawingTask.CompositionGuidance,
    );
    const response = {
      schemaVersion: "1",
      task: AiDrawingTask.CompositionGuidance,
      summary: "Thử cân bằng các khối trong khung.",
      sourceIds: retrieved.map(({ id }) => id),
      recommendations: [
        {
          principle: "composition",
          explanation: "Thử cân bằng các khối trong khung.",
          overlay: [
            {
              kind: "line",
              from: { x: 0.1, y: 0.8 },
              to: { x: 0.8, y: 0.2 },
              style: "flow",
              opacity: 0.2,
            },
          ],
        },
      ],
    };

    expect(() =>
      parseAiDrawingResponse(
        response,
        AiDrawingTask.CompositionGuidance,
        new Set(retrieved.map(({ id }) => id)),
      ),
    ).not.toThrow();
  });

  it("limits the result count and uses deterministic tie ordering", () => {
    const result = retrieveDrawingKnowledge(
      "bố cục điểm nhấn cân bằng",
      AiDrawingTask.CompositionGuidance,
      2,
    );
    const repeated = retrieveDrawingKnowledge(
      "bố cục điểm nhấn cân bằng",
      AiDrawingTask.CompositionGuidance,
      2,
    );

    expect(result).toHaveLength(2);
    expect(result.map(({ id }) => id)).toEqual(repeated.map(({ id }) => id));
  });

  it("rejects empty or oversized queries", () => {
    expect(() =>
      retrieveDrawingKnowledge("  ", AiDrawingTask.DrawingReview),
    ).toThrow(RangeError);
    expect(() =>
      retrieveDrawingKnowledge("x".repeat(801), AiDrawingTask.DrawingReview),
    ).toThrow(RangeError);
  });

  it("rejects invalid result limits and task identifiers", () => {
    expect(() =>
      retrieveDrawingKnowledge("color", AiDrawingTask.DrawingReview, 0),
    ).toThrow(RangeError);
    expect(() =>
      retrieveDrawingKnowledge("color", "unknown-task" as AiDrawingTask),
    ).toThrow(RangeError);
  });
});
