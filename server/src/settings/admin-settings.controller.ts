import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../users/users.service.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../users/user-role.enum.js";
import { UpdateSiteSettingsDto } from "./settings.dto.js";
import type { AdminStats, SiteSettings } from "./settings.service.js";
import { SettingsService } from "./settings.service.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

/**
 * Cai dat he thong va so lieu dashboard cho trang Admin (Lat 4).
 * Dang ky trong AuthModule giong AuditController (Lat 3) de tranh
 * vong tron phu thuoc: SettingsModule khong import AuthModule.
 */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("settings")
  getSettings(): Promise<SiteSettings> {
    return this.settingsService.getSettings();
  }

  @Patch("settings")
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateSiteSettingsDto,
  ): Promise<SiteSettings> {
    return this.settingsService.updateSettings(
      { id: request.user.id, username: request.user.username },
      body,
      request.ip ?? null,
    );
  }

  @Get("stats")
  getStats(): Promise<AdminStats> {
    return this.settingsService.getStats();
  }
}
