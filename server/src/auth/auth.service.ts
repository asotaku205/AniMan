import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import {
  PublicUser,
  RegisterUserInput,
  UsersService,
} from "../users/users.service.js";
import { UserStatus } from "../users/user-status.enum.js";
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./auth.config.js";
import {
  IssuedRefreshToken,
  RefreshSessionsService,
} from "./refresh-sessions.service.js";
import { SettingsService } from "../settings/settings.service.js";

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
    private readonly settingsService: SettingsService,
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

    // Lát 2: tài khoản bị khóa không đăng nhập được, dù mật khẩu đúng.
    if (user.status === UserStatus.Suspended) {
      throw new ForbiddenException("Account is suspended");
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
    // Lát 4: đăng ký đóng thì từ chối trước khi tạo tài khoản. Thông điệp
    // tiếng Anh theo quy ước của auth service, client dịch sang tiếng Việt.
    if (!(await this.settingsService.isRegistrationOpen())) {
      throw new ForbiddenException("Registration is closed");
    }
    const user = await this.usersService.register(input);
    return this.createSessionLogin(user, false);
  }

  async refreshLogin(token: string): Promise<SessionLoginResult> {
    const refreshToken = await this.refreshSessionsService.rotate(token);
    const user = await this.usersService.findPublicById(refreshToken.userId);

    if (!user) {
      await this.refreshSessionsService.revoke(refreshToken.token);
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Lát 2: tài khoản bị khóa cũng không làm mới phiên được; thu hồi
    // refresh token để phiên hiện tại dừng hẳn, không chỉ hết hạn rồi thôi.
    if (user.status === UserStatus.Suspended) {
      await this.refreshSessionsService.revoke(refreshToken.token);
      throw new ForbiddenException("Account is suspended");
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
