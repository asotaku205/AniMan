import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import {
  PublicUser,
  RegisterUserInput,
  UsersService,
} from "../users/users.service.js";
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./auth.config.js";
import {
  IssuedRefreshToken,
  RefreshSessionsService,
} from "./refresh-sessions.service.js";

export interface AccessTokenPayload {
  sub: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
}

export interface SessionLoginResult extends LoginResult {
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash(randomUUID(), {
    type: argon2.argon2id,
  });

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshSessionsService: RefreshSessionsService,
  ) {}

  async validateLocalUser(
    username: string,
    password: string,
  ): Promise<PublicUser> {
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length === 0 ||
      password.length < 6
    ) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const user =
      await this.usersService.findByUsernameForAuthentication(username);
    if (!user) {
      await this.verifyAgainstDummyHash(password);
      throw new UnauthorizedException("Invalid username or password");
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid username or password");
    }

    return this.usersService.toPublicUser(user);
  }

  async createLoginResult(user: PublicUser): Promise<LoginResult> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id } satisfies AccessTokenPayload,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS },
    );

    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user,
    };
  }

  async createSessionLogin(
    user: PublicUser,
    rememberMe: boolean,
  ): Promise<SessionLoginResult> {
    const loginResult = await this.createLoginResult(user);
    const refreshToken = await this.refreshSessionsService.create(
      user.id,
      rememberMe,
    );

    return this.withRefreshToken(loginResult, refreshToken);
  }

  async registerAndCreateSession(
    input: RegisterUserInput,
  ): Promise<SessionLoginResult> {
    const user = await this.usersService.register(input);
    return this.createSessionLogin(user, false);
  }

  confirmAdultAccess(userId: string): Promise<PublicUser> {
    return this.usersService.confirmAdultAccess(userId);
  }

  async refreshLogin(token: string): Promise<SessionLoginResult> {
    const refreshToken = await this.refreshSessionsService.rotate(token);
    const user = await this.usersService.findPublicById(refreshToken.userId);

    if (!user) {
      await this.refreshSessionsService.revoke(refreshToken.token);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const loginResult = await this.createLoginResult(user);
    return this.withRefreshToken(loginResult, refreshToken);
  }

  revokeRefreshToken(token: string | undefined): Promise<void> {
    return this.refreshSessionsService.revoke(token);
  }

  private async verifyAgainstDummyHash(password: string): Promise<void> {
    const hash = await this.dummyPasswordHash;
    await argon2.verify(hash, password);
  }

  private withRefreshToken(
    loginResult: LoginResult,
    refreshToken: IssuedRefreshToken,
  ): SessionLoginResult {
    return {
      ...loginResult,
      refreshToken: refreshToken.token,
      refreshExpiresAt: refreshToken.expiresAt,
    };
  }
}
