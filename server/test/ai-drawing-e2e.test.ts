import "reflect-metadata";
import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from "@nestjs/common";
import sharp from "sharp";
import {
  AiDrawingImageMimeType,
  AiDrawingTask,
} from "../src/ai/contracts/ai-drawing-request.dto.js";
import {
  AiDrawingModelProfile,
  AiDrawingProvider,
  AiDrawingProviderTimeoutError,
  AiDrawingProviderTransientError,
} from "../src/ai/driver/ai-drawing-driver.js";
import { AiDrawingDriver } from "../src/ai/driver/ai-drawing-driver.service.js";
import { AiDrawingPromptService } from "../src/ai/prompts/ai-drawing-prompt.service.js";

async function makePngBase64(width = 256, height = 256): Promise<string> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .png()
    .toBuffer();
  return buf.toString("base64");
}

describe("AI Drawing End-to-End Suite (Slice 7)", () => {
  let validPngBase64: string;

  const activeProfile: AiDrawingModelProfile = {
    id: "gemini-manga-assistant",
    provider: "google",
    modelId: "gemini-3.8-flash",
    description: "Gemini Manga Assistant candidate",
    version: "1",
    tasks: [AiDrawingTask.CompositionGuidance, AiDrawingTask.DrawingReview],
    capabilities: {
      textInput: true,
      imageInput: true,
      structuredOutput: true,
    },
    limits: {
      maxImageBytes: 4 * 1024 * 1024,
      maxOutputTokens: 2048,
      timeoutMs: 500,
    },
    enabled: true,
  };

  const disabledProfile: AiDrawingModelProfile = {
    ...activeProfile,
    enabled: false,
  };

  beforeAll(async () => {
    validPngBase64 = await makePngBase64(256, 256);
  });

  describe("Tác vụ 1: Gợi ý bố cục (composition_guidance)", () => {
    it("hoàn thành luồng end-to-end với retrieval kiến thức và overlay hợp lệ", async () => {
      let capturedRequest: unknown;

      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(async (req) => {
          capturedRequest = req;
          return {
            schemaVersion: "1",
            task: AiDrawingTask.CompositionGuidance,
            summary: "Bố cục cân bằng với điểm nhấn rõ ràng theo quy tắc một phần ba.",
            sourceIds: ["composition-balance-and-thirds"],
            recommendations: [
              {
                principle: "composition",
                explanation: "Đặt nhân vật tại giao điểm 1/3 bên trái để tạo không gian mở.",
                overlay: [
                  {
                    kind: "line",
                    from: { x: 0.33, y: 0 },
                    to: { x: 0.33, y: 1 },
                    style: "composition",
                    opacity: 0.25,
                  },
                  {
                    kind: "ellipse",
                    region: { x: 0.25, y: 0.2, width: 0.16, height: 0.25 },
                    style: "composition",
                    opacity: 0.2,
                  },
                ],
              },
            ],
          };
        }),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.CompositionGuidance,
        prompt: "Gợi ý bố cục cân bằng cho khung cảnh đối thoại",
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      const response = await driver.execute(requestPayload);

      expect(response.task).toBe(AiDrawingTask.CompositionGuidance);
      expect(response.sourceIds).toContain("composition-balance-and-thirds");
      expect(response).toHaveProperty("recommendations");
      if ("recommendations" in response) {
        expect(response.recommendations).toHaveLength(1);
        expect(response.recommendations[0].overlay).toHaveLength(2);
      }
      expect(mockProvider.generate).toHaveBeenCalledTimes(1);

      // System instruction và Prompt assembler đảm bảo tính đóng gói an toàn
      const providerReq = capturedRequest as { systemInstruction: string; evidence: unknown[] };
      expect(providerReq.systemInstruction).toContain("Bạn là trợ lý hướng dẫn vẽ manga; người dùng luôn là tác giả.");
      expect(providerReq.evidence.length).toBeGreaterThan(0);
    });
  });

  describe("Tác vụ 2: Đánh giá nét vẽ (drawing_review)", () => {
    it("hoàn thành luồng end-to-end phát hiện chỗ vẽ lệch với vùng tọa độ chuẩn hóa", async () => {
      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(async () => ({
          schemaVersion: "1",
          task: AiDrawingTask.DrawingReview,
          summary: "Nét vẽ tổng thể tốt, có một số điểm lệch về tỷ lệ và đường dẫn mắt.",
          sourceIds: ["character-proportion-gesture"],
          findings: [
            {
              principle: "proportion",
              region: { x: 0.2, y: 0.1, width: 0.3, height: 0.35 },
              issue: "Khối đầu nhân vật hơi lớn so với trục vai.",
              recommendation: "Thu hẹp tỷ lệ đầu khoảng 15% hoặc mở rộng trục vai.",
              severity: "medium",
              confidence: 0.88,
            },
          ],
        })),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.DrawingReview,
        prompt: "Xem lại tỷ lệ nhân vật trong bức phác thảo",
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      const response = await driver.execute(requestPayload);

      expect(response.task).toBe(AiDrawingTask.DrawingReview);
      expect(response.sourceIds).toContain("character-proportion-gesture");
      expect(response).toHaveProperty("findings");
      if ("findings" in response) {
        expect(response.findings).toHaveLength(1);
        expect(response.findings[0].principle).toBe("proportion");
        expect(response.findings[0].region.width).toBe(0.3);
      }
    });

    it("chặn output nếu AI trả sourceIds bịa đặt không có trong evidence", async () => {
      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(async () => ({
          schemaVersion: "1",
          task: AiDrawingTask.DrawingReview,
          summary: "Nhận xét với nguồn không tồn tại.",
          sourceIds: ["fabricated-fake-source-id"],
          findings: [
            {
              principle: "composition",
              region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
              issue: "Vấn đề mẫu",
              recommendation: "Khuyến nghị mẫu",
              severity: "low",
              confidence: 0.8,
            },
          ],
        })),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.DrawingReview,
        prompt: "Kiểm tra nét vẽ",
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      await expect(driver.execute(requestPayload)).rejects.toThrow(
        "AI provider returned a response that violates the drawing contract",
      );
    });
  });

  describe("Bảo vệ an toàn và xử lý lỗi vận hành (Safety & Operational Invariants)", () => {
    it("từ chối kích hoạt nếu profile model bị tắt (Kill switch)", async () => {
      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        disabledProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.CompositionGuidance,
        prompt: "Yêu cầu khi model bị tắt",
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      await expect(driver.execute(requestPayload)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(mockProvider.generate).not.toHaveBeenCalled();
    });

    it("từ chối request có kích thước ảnh vượt quá giới hạn (4096px)", async () => {
      const mockProvider: AiDrawingProvider = { generate: vi.fn() };
      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.CompositionGuidance,
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 5000, // vượt ngưỡng 4096
          height: 256,
        },
      };

      await expect(driver.execute(requestPayload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("thử lại đúng 1 lần khi gặp lỗi transient rồi trả kết quả thành công", async () => {
      let callCount = 0;
      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(async () => {
          callCount += 1;
          if (callCount === 1) {
            throw new AiDrawingProviderTransientError();
          }
          return {
            schemaVersion: "1",
            task: AiDrawingTask.DrawingReview,
            summary: "Đánh giá thành công ở lần thử thứ hai.",
            sourceIds: [],
            findings: [
              {
                principle: "lighting",
                region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
                issue: "Vùng tối chưa nhất quán",
                recommendation: "Căn chỉnh lại bóng đổ",
                severity: "low",
                confidence: 0.9,
              },
            ],
          };
        }),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.DrawingReview,
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      const response = await driver.execute(requestPayload);
      expect(callCount).toBe(2);
      expect(response.summary).toContain("Đánh giá thành công ở lần thử thứ hai");
    });

    it("chuyển lỗi timeout của provider thành GatewayTimeoutException không lộ thông tin", async () => {
      const mockProvider: AiDrawingProvider = {
        generate: vi.fn(async () => {
          throw new AiDrawingProviderTimeoutError();
        }),
      };

      const driver = new AiDrawingDriver(
        mockProvider,
        activeProfile,
        new AiDrawingPromptService(),
      );

      const requestPayload = {
        task: AiDrawingTask.DrawingReview,
        image: {
          data: validPngBase64,
          mimeType: AiDrawingImageMimeType.Png,
          width: 256,
          height: 256,
        },
      };

      await expect(driver.execute(requestPayload)).rejects.toBeInstanceOf(
        GatewayTimeoutException,
      );
    });
  });
});
