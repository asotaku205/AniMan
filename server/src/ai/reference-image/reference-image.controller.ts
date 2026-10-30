import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../../users/users.service.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { AiDrawingRateLimiter } from "../ai-drawing-rate-limiter.service.js";
import {
  CLOUDFLARE_KLEIN_4B_MODEL_ID,
  REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS,
} from "./reference-image.constants.js";
import { CreateReferenceImageJobDto } from "./reference-image.dto.js";
import {
  ReferenceImageJobsService,
  type ReferenceImageJobView,
} from "./reference-image-jobs.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

/**
 * Job sinh ảnh mẫu tham khảo (Cloudflare Workers AI), chạy bất đồng bộ.
 * Tạo job tốn một lượt quota AI chung (5/phút, 30/ngày) giống đường
 * Gemini, vì cùng một tài khoản server và cùng một người dùng cuối.
 */
@Controller("ai/reference-image")
@UseGuards(JwtAuthGuard)
export class ReferenceImageController {
  constructor(
    private readonly rateLimiter: AiDrawingRateLimiter,
    private readonly jobsService: ReferenceImageJobsService,
  ) {}

  @Get("status")
  getStatus(): {
    enabled: boolean;
    model: string;
    providerTimeoutMs: number;
  } {
    return {
      enabled: this.jobsService.isEnabled(),
      model: CLOUDFLARE_KLEIN_4B_MODEL_ID,
      providerTimeoutMs: REFERENCE_IMAGE_PROVIDER_TIMEOUT_MS,
    };
  }

  @Post("jobs")
  @HttpCode(202)
  async createJob(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateReferenceImageJobDto,
  ): Promise<ReferenceImageJobView> {
    this.rateLimiter.assertCanRequest(request.user.id);
    return this.jobsService.createJob(request.user.id, dto);
  }

  @Get("jobs/:id")
  getJob(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): ReferenceImageJobView {
    return this.jobsService.getJob(request.user.id, id);
  }

  @Delete("jobs/:id")
  cancelJob(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): ReferenceImageJobView {
    return this.jobsService.cancelJob(request.user.id, id);
  }
}
