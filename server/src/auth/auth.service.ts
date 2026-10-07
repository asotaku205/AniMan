import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { PublicUser, UsersService } from "../users/users.service.js";
import { User } from "../users/user.entity.js";
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./auth.config.js";

export interface AccessTokenPayload {
  sub: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash(randomUUID(), {
    type: argon2.argon2id,
  });

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

    return this.toPublicUser(user);
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

  private async verifyAgainstDummyHash(password: string): Promise<void> {
    const hash = await this.dummyPasswordHash;
    await argon2.verify(hash, password);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
