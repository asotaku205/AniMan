import "reflect-metadata";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Repository } from "typeorm";
import { assertAdultAccessConfirmed } from "../src/auth/adult-access.policy.js";
import { AuthController } from "../src/auth/auth.controller.js";
import { ConfirmAdultAccessDto } from "../src/auth/dto/confirm-adult-access.dto.js";
import { RegisterDto } from "../src/auth/dto/register.dto.js";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { User } from "../src/users/user.entity.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { UsersService } from "../src/users/users.service.js";

function createUser(): User {
  return {
    id: "a4dd486c-ff56-4376-88b3-118f3dc7b792",
    username: "reader",
    displayName: "Reader",
    passwordHash: "not-used",
    role: UserRole.User,
    termsAcceptedAt: new Date("2026-10-01T00:00:00.000Z"),
    adultAccessConfirmedAt: null,
    aiAgeConfirmedAt: null,
    aiDataNoticeVersion: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  };
}

function createUsersService(user: User | null) {
  const repository = {
    create: vi.fn((values: Partial<User>) => values as User),
    findOneBy: vi.fn(async () => user),
    save: vi.fn(async (savedUser: User) => savedUser),
  };
  return {
    service: new UsersService(repository as unknown as Repository<User>),
    repository,
  };
}

describe("platform adult access", () => {
  it("rejects protected requests for accounts without an adult-access receipt", () => {
    expect(() => assertAdultAccessConfirmed(undefined, false)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertAdultAccessConfirmed({ adultAccessConfirmedAt: null }, false),
    ).toThrow(ForbiddenException);
  });

  it("allows confirmed users and the explicit confirmation route", () => {
    expect(() =>
      assertAdultAccessConfirmed({ adultAccessConfirmedAt: new Date() }, false),
    ).not.toThrow();
    expect(() => assertAdultAccessConfirmed(undefined, true)).not.toThrow();
  });

  it("requires an explicit true confirmation in the existing-account endpoint", async () => {
    const valid = plainToInstance(ConfirmAdultAccessDto, {
      adultAccessConfirmed: true,
    });
    const invalid = plainToInstance(ConfirmAdultAccessDto, {
      adultAccessConfirmed: false,
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toHaveLength(1);
  });

  it("requires new accounts to explicitly confirm adult access", async () => {
    const registration = {
      displayName: "Reader",
      username: "reader",
      password: "password",
      confirmPassword: "password",
      agree: true,
      adultAccessConfirmed: false,
    };
    const valid = plainToInstance(RegisterDto, {
      ...registration,
      adultAccessConfirmed: true,
    });
    const invalid = plainToInstance(RegisterDto, registration);

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toHaveLength(1);
  });

  it("protects adult confirmation with JWT while allowing pending accounts", () => {
    const controllerGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuthController.prototype.confirmAdultAccess,
    ) as unknown[];
    const allowPending = Reflect.getMetadata(
      "allowPendingAdultAccess",
      AuthController.prototype.confirmAdultAccess,
    );

    expect(controllerGuards).toContain(JwtAuthGuard);
    expect(allowPending).toBe(true);
  });

  it("stores a timestamp for a newly registered adult account", async () => {
    const { service, repository } = createUsersService(null);

    const savedUser = await service.register({
      displayName: "Reader",
      username: "reader",
      password: "password",
      agree: true,
      adultAccessConfirmed: true,
    });

    expect(savedUser.adultAccessConfirmedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalled();
    expect("dateOfBirth" in savedUser).toBe(false);
  });

  it("rejects registration without explicit adult confirmation", async () => {
    const { service, repository } = createUsersService(null);

    await expect(
      service.register({
        displayName: "Reader",
        username: "reader",
        password: "password",
        agree: true,
        adultAccessConfirmed: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("records an adult-access timestamp for an existing user", async () => {
    const user = createUser();
    const { service, repository } = createUsersService(user);

    const confirmedUser = await service.confirmAdultAccess(user.id);

    expect(confirmedUser.adultAccessConfirmedAt).toBeInstanceOf(Date);
    expect(repository.save).toHaveBeenCalledWith(user);
    expect("dateOfBirth" in confirmedUser).toBe(false);
  });
});
