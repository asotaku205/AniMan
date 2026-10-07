import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DataSource, IsNull, Repository } from "typeorm";
import { RefreshSession } from "./refresh-session.entity.js";

const DEFAULT_SESSION_DAYS = 1;
const REMEMBERED_SESSION_DAYS = 30;
const REMEMBERED_SESSION_THRESHOLD_DAYS = 15;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

type RotationResult =
  | { kind: "rotated"; issued: RotatedRefreshToken }
  | { kind: "invalid" }
  | { kind: "reused" };

@Injectable()
export class RefreshSessionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(RefreshSession)
    private readonly refreshSessionsRepository: Repository<RefreshSession>,
  ) {}

  async create(
    userId: string,
    rememberMe: boolean,
  ): Promise<IssuedRefreshToken> {
    const now = new Date();
    const expiresAt = this.getExpirationDate(now, rememberMe);
    const token = this.createToken();

    const session = this.refreshSessionsRepository.create({
      id: randomUUID(),
      userId,
      familyId: randomUUID(),
      tokenHash: this.hashToken(token),
      expiresAt,
      revokedAt: null,
      replacedById: null,
    });

    await this.refreshSessionsRepository.save(session);
    return { token, expiresAt };
  }

  async rotate(token: string): Promise<RotatedRefreshToken> {
    if (!this.isValidTokenFormat(token)) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const tokenHash = this.hashToken(token);
    const now = new Date();
    const result = await this.dataSource.transaction<RotationResult>(
      async (manager) => {
        const sessions = manager.getRepository(RefreshSession);
        const session = await sessions.findOne({
          where: { tokenHash },
          lock: { mode: "pessimistic_write" },
        });

        if (!session) {
          return { kind: "invalid" };
        }

        if (session.revokedAt) {
          await sessions.update(
            { familyId: session.familyId },
            { revokedAt: now },
          );
          return { kind: "reused" };
        }

        if (session.expiresAt.getTime() <= now.getTime()) {
          await sessions.update({ id: session.id }, { revokedAt: now });
          return { kind: "invalid" };
        }

        const rememberMe = this.isRememberedSession(session);
        const nextToken = this.createToken();
        const nextSession = sessions.create({
          id: randomUUID(),
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.hashToken(nextToken),
          expiresAt: this.getExpirationDate(now, rememberMe),
          revokedAt: null,
          replacedById: null,
        });

        await sessions.save(nextSession);
        await sessions.update(
          { id: session.id },
          { revokedAt: now, replacedById: nextSession.id },
        );

        return {
          kind: "rotated",
          issued: {
            token: nextToken,
            expiresAt: nextSession.expiresAt,
            userId: session.userId,
          },
        };
      },
    );

    if (result.kind !== "rotated") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return result.issued;
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token || !this.isValidTokenFormat(token)) {
      return;
    }

    await this.refreshSessionsRepository.update(
      { tokenHash: this.hashToken(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private createToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private isValidTokenFormat(token: string): boolean {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private getExpirationDate(now: Date, rememberMe: boolean): Date {
    const days = rememberMe ? REMEMBERED_SESSION_DAYS : DEFAULT_SESSION_DAYS;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private isRememberedSession(session: RefreshSession): boolean {
    const lifetime = session.expiresAt.getTime() - session.createdAt.getTime();
    const threshold = REMEMBERED_SESSION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    return lifetime >= threshold;
  }
}
