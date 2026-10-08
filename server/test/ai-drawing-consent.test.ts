import "reflect-metadata";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { QueryRunner, Repository } from "typeorm";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { AiDrawingConsentController } from "../src/ai/consent/ai-drawing-consent.controller.js";
import { AI_DRAWING_DATA_NOTICE_VERSION } from "../src/ai/consent/ai-drawing-consent.constants.js";
import { AiDrawingConsentService } from "../src/ai/consent/ai-drawing-consent.service.js";
import { ConfirmAiDrawingConsentDto } from "../src/ai/consent/dto/confirm-ai-drawing-consent.dto.js";
import { User } from "../src/users/user.entity.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { AddAiDrawingConsent1791500000000 } from "../src/database/migrations/1791500000000-AddAiDrawingConsent.js";

function createUser(): User {
  return {
    id: "a4dd486c-ff56-4376-88b3-118f3dc7b792",
    username: "reader",
    displayName: "Reader",
    passwordHash: "not-used",
    role: UserRole.User,
    termsAcceptedAt: new Date("2026-10-01T00:00:00.000Z"),
    aiAgeConfirmedAt: null,
    aiDataNoticeVersion: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

function createService(user: User | null) {
  const repository = {
    findOneBy: vi.fn(async () => user),
    save: vi.fn(async (savedUser: User) => savedUser),
  };
  const service = new AiDrawingConsentService(
    repository as unknown as Repository<User>,
  );
  return { service, repository };
}

describe("AI drawing consent", () => {
  it("reports consent as ineligible until both current receipt fields exist", async () => {
    const { service } = createService(createUser());

    await expect(
      service.getStatus("a4dd486c-ff56-4376-88b3-118f3dc7b792"),
    ).resolves.toMatchObject({
      eligible: false,
      ageConfirmedAt: null,
      noticeVersion: null,
      currentNoticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
    });
  });

  it("rejects AI access unless the current consent receipt is complete", async () => {
    const { service } = createService(createUser());

    await expect(service.assertEligible("reader")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("allows AI access only for a complete receipt at the current version", async () => {
    const user = createUser();
    user.aiAgeConfirmedAt = new Date();
    user.aiDataNoticeVersion = AI_DRAWING_DATA_NOTICE_VERSION;
    const { service } = createService(user);

    await expect(service.assertEligible(user.id)).resolves.toBeUndefined();
  });

  it("records only the self-attestation timestamp and accepted notice version", async () => {
    const user = createUser();
    const { service, repository } = createService(user);

    const status = await service.confirm(user.id);

    expect(status.eligible).toBe(true);
    expect(status.ageConfirmedAt).toBeInstanceOf(Date);
    expect(status.noticeVersion).toBe(AI_DRAWING_DATA_NOTICE_VERSION);
    expect(repository.save).toHaveBeenCalledWith(user);
    expect("dateOfBirth" in user).toBe(false);
  });

  it("revokes eligibility and clears both consent receipt fields", async () => {
    const user = createUser();
    user.aiAgeConfirmedAt = new Date();
    user.aiDataNoticeVersion = AI_DRAWING_DATA_NOTICE_VERSION;
    const { service } = createService(user);

    const status = await service.revoke(user.id);

    expect(status).toMatchObject({
      eligible: false,
      ageConfirmedAt: null,
      noticeVersion: null,
    });
  });

  it("does not treat a partial or expired-version receipt as eligible", async () => {
    const user = createUser();
    user.aiAgeConfirmedAt = new Date();
    user.aiDataNoticeVersion = "old-notice";
    const { service } = createService(user);

    await expect(service.getStatus(user.id)).resolves.toMatchObject({
      eligible: false,
      currentNoticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
    });
  });

  it("fails explicitly when the authenticated account no longer exists", async () => {
    const { service } = createService(null);

    await expect(service.getStatus("missing-user")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("accepts only explicit 18+ confirmation for the current notice version", async () => {
    const validDto = plainToInstance(ConfirmAiDrawingConsentDto, {
      ageConfirmed: true,
      dataNoticeAccepted: true,
      noticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
    });
    const invalidDto = plainToInstance(ConfirmAiDrawingConsentDto, {
      ageConfirmed: false,
      dataNoticeAccepted: false,
      noticeVersion: "outdated",
    });

    await expect(validate(validDto)).resolves.toHaveLength(0);
    await expect(validate(invalidDto)).resolves.toHaveLength(3);
  });

  it("requires JWT authentication for all consent endpoints", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AiDrawingConsentController,
    ) as unknown[];

    expect(guards).toContain(JwtAuthGuard);
  });

  it("adds nullable paired consent columns and can reverse the migration", async () => {
    const query = vi.fn(async (_sql: string) => undefined);
    const migration = new AddAiDrawingConsent1791500000000();

    const queryRunner = { query } as unknown as QueryRunner;
    await migration.up(queryRunner);
    expect(query.mock.calls[0]?.[0]).toContain(
      '"ck_users_ai_drawing_consent_pair"',
    );
    expect(query.mock.calls[0]?.[0]).toContain('"ai_age_confirmed_at"');
    expect(query.mock.calls[0]?.[0]).toContain('"ai_data_notice_version"');
    expect(query.mock.calls[0]?.[0]).not.toContain("date_of_birth");

    await migration.down(queryRunner);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain(
      'DROP CONSTRAINT "ck_users_ai_drawing_consent_pair"',
    );
  });
});
