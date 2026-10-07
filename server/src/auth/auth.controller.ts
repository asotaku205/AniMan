import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import type { LoginResult } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { LocalAuthGuard } from "./guards/local-auth.guard.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post("login")
  login(@Req() request: AuthenticatedRequest): Promise<LoginResult> {
    return this.authService.createLoginResult(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getCurrentUser(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }
}
