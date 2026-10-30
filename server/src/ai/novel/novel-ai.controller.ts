import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../../users/users.service.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { AiDrawingRateLimiter } from "../ai-drawing-rate-limiter.service.js";
import {
  NovelAiService,
  type NovelAiResult,
} from "./novel-ai.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

const MAX_SCENE_TEXT_LENGTH = 8000;
const MAX_BIBLE_LENGTH = 4000;
const MAX_CONTEXT_LENGTH = 2000;

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * POST /ai/novel  -  tóm tắt cảnh / kiểm tra nhất quán với sổ tay /
 * tách cảnh thành trang/khung manga (N3 + cầu nối). Dùng CHUNG rate
 * limiter với AI drawing + dịch (5/phút, 30/ngày) vì cùng một ngân
 * sách Gemini free tier. Kết quả là bản nháp, client hiển thị để người
 * dùng duyệt, không tự sửa văn bản.
 */
@Controller("ai/novel")
@UseGuards(JwtAuthGuard)
export class NovelAiController {
  constructor(
    private readonly rateLimiter: AiDrawingRateLimiter,
    private readonly novelAi: NovelAiService,
  ) {}

  @Post()
  async run(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<NovelAiResult> {
    // Log chẩn đoán: terminal của server mặc định không ghi request nào,
    // nên khi request chết trước khi tới service thì không còn dấu vết.
    // Dòng này chứng minh request đã tới controller; dòng lỗi dưới đây
    // ghi lại mọi lỗi ném ra trước/khi gọi service.
    console.log(
      `[NovelAi] request task=${typeof body === "object" && body !== null ? String((body as Record<string, unknown>).task ?? "") : "?"} user=${request.user?.id ?? "?"} textLen=${typeof body === "object" && body !== null ? String((body as Record<string, unknown>).text ?? "").length : 0}`,
    );
    try {
      return await this.runInner(request, body);
    } catch (error) {
      console.error(
        `[NovelAi] controller error: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`.slice(0, 300),
      );
      throw error;
    }
  }

  private async runInner(
    request: AuthenticatedRequest,
    body: unknown,
  ): Promise<NovelAiResult> {
    if (typeof body !== "object" || body === null) {
      throw new BadRequestException("Body must be an object");
    }
    const b = body as Record<string, unknown>;
    const task =
      b.task === "summarize" || b.task === "consistency" || b.task === "breakdown"
        ? b.task
        : null;
    if (!task) {
      throw new BadRequestException(
        "task must be summarize, consistency or breakdown",
      );
    }
    const text = asString(b.text, MAX_SCENE_TEXT_LENGTH);
    if (!text.trim()) {
      throw new BadRequestException("text must be non-empty");
    }
    const bible = asString(b.bible, MAX_BIBLE_LENGTH);
    const context = asString(b.context, MAX_CONTEXT_LENGTH);

    this.rateLimiter.assertCanRequest(request.user.id);
    return this.novelAi.run({ task, text, bible, context });
  }
}
