import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../../users/users.service.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { ConfirmAiDrawingConsentDto } from "./dto/confirm-ai-drawing-consent.dto.js";
import { AiDrawingConsentService } from "./ai-drawing-consent.service.js";
import type { AiDrawingConsentStatus } from "./ai-drawing-consent.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Controller("ai/consent")
@UseGuards(JwtAuthGuard)
export class AiDrawingConsentController {
  constructor(private readonly consentService: AiDrawingConsentService) {}

  @Get()
  getStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<AiDrawingConsentStatus> {
    return this.consentService.getStatus(request.user.id);
  }

  @Post()
  confirm(
    @Req() request: AuthenticatedRequest,
    @Body() _confirmation: ConfirmAiDrawingConsentDto,
  ): Promise<AiDrawingConsentStatus> {
    return this.consentService.confirm(request.user.id);
  }

  @Delete()
  revoke(
    @Req() request: AuthenticatedRequest,
  ): Promise<AiDrawingConsentStatus> {
    return this.consentService.revoke(request.user.id);
  }
}
