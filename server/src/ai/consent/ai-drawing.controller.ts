import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../../users/users.service.js";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard.js";
import { AiDrawingDriver } from "../driver/ai-drawing-driver.service.js";
import type { AiDrawingResponse } from "../contracts/ai-drawing-response.js";
import { AiDrawingConsentService } from "./ai-drawing-consent.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Controller("ai/drawing")
@UseGuards(JwtAuthGuard)
export class AiDrawingController {
  constructor(
    private readonly consentService: AiDrawingConsentService,
    private readonly drawingDriver: AiDrawingDriver,
  ) {}

  @Post()
  async execute(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AiDrawingResponse> {
    await this.consentService.assertEligible(request.user.id);
    return this.drawingDriver.execute(body);
  }
}
