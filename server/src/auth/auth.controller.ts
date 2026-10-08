import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { PublicUser } from "../users/users.service.js";
import { AuthService } from "./auth.service.js";
import type { LoginResult } from "./auth.service.js";
import type { SessionLoginResult } from "./auth.service.js";
import {
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from "./auth.cookies.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { ConfirmAdultAccessDto } from "./dto/confirm-adult-access.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { LocalAuthGuard } from "./guards/local-auth.guard.js";
import { AllowPendingAdultAccess } from "./allow-pending-adult-access.decorator.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

interface CookieRequest extends Request {
  cookies: Record<string, unknown>;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post("login")
  async login(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Body() options: LoginDto,
  ): Promise<LoginResult> {
    const result = await this.authService.createSessionLogin(
      request.user,
      options.rememberMe,
    );
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
    return this.toLoginResult(result);
  }

  @Post("register")
  async register(
    @Body() input: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    const result = await this.authService.registerAndCreateSession({
      displayName: input.displayName,
      username: input.username,
      password: input.password,
      agree: input.agree,
      adultAccessConfirmed: input.adultAccessConfirmed,
    });
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
    return this.toLoginResult(result);
  }

  @Post("refresh")
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResult> {
    const token = this.getRefreshToken(request);
    if (!token) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const result = await this.authService.refreshLogin(token);
    this.setRefreshCookie(
      response,
      result.refreshToken,
      result.refreshExpiresAt,
    );
    return this.toLoginResult(result);
  }

  @Post("logout")
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    await this.authService.revokeRefreshToken(this.getRefreshToken(request));
    response.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getCurrentUser(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }

  @AllowPendingAdultAccess()
  @UseGuards(JwtAuthGuard)
  @Post("adult-access/confirm")
  confirmAdultAccess(
    @Req() request: AuthenticatedRequest,
    @Body() _confirmation: ConfirmAdultAccessDto,
  ): Promise<PublicUser> {
    return this.authService.confirmAdultAccess(request.user.id);
  }

  private setRefreshCookie(
    response: Response,
    token: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_COOKIE_NAME, token, {
      ...getRefreshCookieOptions(),
      expires: expiresAt,
      maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
    });
  }

  private getRefreshToken(request: CookieRequest): string | undefined {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    return typeof token === "string" ? token : undefined;
  }

  private toLoginResult(result: SessionLoginResult): LoginResult {
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }
}
