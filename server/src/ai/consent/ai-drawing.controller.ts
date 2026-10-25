import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../../users/users.service.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { AiDrawingDriver } from "../driver/ai-drawing-driver.service.js";
import type { AiDrawingResponse } from "../contracts/ai-drawing-response.js";
import {
  AiDrawingRateLimiter,
  type AiDrawingQuotaStatus,
} from "../ai-drawing-rate-limiter.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Controller("ai/drawing")
@UseGuards(JwtAuthGuard)
export class AiDrawingController {
  constructor(
    private readonly rateLimiter: AiDrawingRateLimiter,
    private readonly drawingDriver: AiDrawingDriver,
  ) {}

  /**
   * Lượt AI còn lại của user — CHỈ ĐỌC, không tốn lượt (rate limiter có
   * `peekQuota` riêng, khác `assertCanRequest` của POST).
   */
  @Get("quota")
  getQuota(
    @Req() request: AuthenticatedRequest,
  ): AiDrawingQuotaStatus {
    return this.rateLimiter.peekQuota(request.user.id);
  }

  @Post()
  async execute(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AiDrawingResponse> {
    this.rateLimiter.assertCanRequest(request.user.id);
    return this.drawingDriver.execute(body);
  }
}
