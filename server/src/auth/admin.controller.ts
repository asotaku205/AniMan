import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../users/users.service.js";
import { UserRole } from "../users/user-role.enum.js";
import { Roles } from "./decorators/roles.decorator.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminController {
  @Get("me")
  getAdminProfile(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }
}
