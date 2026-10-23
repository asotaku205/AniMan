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
  MAX_TRANSLATION_CONTEXT_LENGTH,
  MAX_TRANSLATION_LINE_LENGTH,
  MAX_TRANSLATION_LINES,
  TRANSLATION_TARGET_LANGUAGES,
  TranslationService,
  type TranslateDialogueResult,
} from "./translation.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * POST /ai/translate-dialogue — dịch cả cảnh thoại trong 1 lượt (tiết
 * kiệm quota), dùng CHUNG rate limiter với AI drawing (5/phút, 30/ngày)
 * vì cùng một ngân sách Gemini free tier.
 */
@Controller("ai/translate-dialogue")
@UseGuards(JwtAuthGuard)
export class TranslationController {
  constructor(
    private readonly rateLimiter: AiDrawingRateLimiter,
    private readonly translation: TranslationService,
  ) {}

  @Post()
  async translate(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<TranslateDialogueResult> {
    if (typeof body !== "object" || body === null) {
      throw new BadRequestException("Body must be an object");
    }
    const b = body as Record<string, unknown>;
    const targetLang = TRANSLATION_TARGET_LANGUAGES.find(
      (l) => l.id === b.targetLang,
    )?.id;
    if (!targetLang) {
      throw new BadRequestException("Unsupported targetLang");
    }
    if (!Array.isArray(b.lines) || b.lines.length === 0) {
      throw new BadRequestException("lines must be a non-empty array");
    }
    if (b.lines.length > MAX_TRANSLATION_LINES) {
      throw new BadRequestException(
        `Too many lines (max ${MAX_TRANSLATION_LINES} per request)`,
      );
    }
    const lines = b.lines.map((raw, i) => {
      if (typeof raw !== "object" || raw === null) {
        throw new BadRequestException(`lines[${i}] must be an object`);
      }
      const r = raw as Record<string, unknown>;
      const id = asString(r.id, 64);
      const text = asString(r.text, MAX_TRANSLATION_LINE_LENGTH);
      if (!id || !text.trim()) {
        throw new BadRequestException(`lines[${i}] needs id and text`);
      }
      return {
        id,
        text,
        speaker: asString(r.speaker, 80) || undefined,
      };
    });

    this.rateLimiter.assertCanRequest(request.user.id);
    return this.translation.translateDialogue({
      targetLang,
      sceneName: asString(b.sceneName, 200) || "Untitled scene",
      sceneNote: asString(b.sceneNote, MAX_TRANSLATION_CONTEXT_LENGTH),
      glossary: asString(b.glossary, MAX_TRANSLATION_CONTEXT_LENGTH),
      lines,
    });
  }
}
