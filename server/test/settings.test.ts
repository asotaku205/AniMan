import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { AuditAction } from "../src/audit/audit-action.enum.js";
import { AuditLog } from "../src/audit/audit-log.entity.js";
import { AuditService } from "../src/audit/audit.service.js";
import { AuthService } from "../src/auth/auth.service.js";
import { MaintenanceGuard } from "../src/settings/maintenance.guard.js";
import { SettingsService } from "../src/settings/settings.service.js";
import { SiteSetting } from "../src/settings/site-setting.entity.js";
import { User } from "../src/users/user.entity.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { UserStatus } from "../src/users/user-status.enum.js";

/** Kho audit log gia: chi luu dong, giong Lat 2/2A/3. */
class FakeAuditStore {
  rows: AuditLog[] = [];

  create(partial: Partial<AuditLog>): AuditLog {
    return Object.assign(new AuditLog(), partial);
  }

  async save(row: AuditLog): Promise<AuditLog> {
    this.rows.push(row);
    return row;
  }
}

class FakeSettingsRepository {
  rows: SiteSetting[] = [];
  auditStore = new FakeAuditStore();

  async find(): Promise<SiteSetting[]> {
    return [...this.rows];
  }

  async findOneBy(where: { key: string }): Promise<SiteSetting | null> {
    return this.rows.find((row) => row.key === where.key) ?? null;
  }

  create(partial: Partial<SiteSetting>): SiteSetting {
    return Object.assign(new SiteSetting(), partial);
  }

  async save(row: SiteSetting): Promise<SiteSetting> {
    const index = this.rows.findIndex((item) => item.key === row.key);
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    return row;
  }

  /** EntityManager gia: giao dich tra ve manager co getRepository. */
  private readonly txManager = {
    transaction: async <T,>(cb: (manager: unknown) => Promise<T>) => {
      const manager = {
        getRepository: (entity: unknown) =>
          entity === AuditLog ? this.auditStore : this,
      };
      return cb(manager);
    },
  };

  get manager(): {
    transaction: <T>(cb: (manager: unknown) => Promise<T>) => Promise<T>;
  } {
    return this.txManager;
  }
}

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date("2026-10-29T00:00:00Z");
  return {
    id: "user-1",
    username: "reader",
    displayName: "Reader",
    passwordHash: "hash",
    role: UserRole.User,
    status: UserStatus.Active,
    termsAcceptedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as User;
}

class FakeUsersRepository {
  constructor(public rows: User[] = []) {}

  async count(options?: {
    where?: Record<string, unknown>;
  }): Promise<number> {
    const where = options?.where;
    if (!where) return this.rows.length;
    return this.rows.filter((row) => {
      return Object.entries(where).every(([key, expected]) => {
        const actual = row[key as keyof User];
        if (
          typeof expected === "object" &&
          expected !== null &&
          "_type" in expected &&
          "_value" in expected
        ) {
          const op = expected as { _type: string; _value: unknown };
          if (op._type === "moreThanOrEqual") {
            return (actual as Date) >= (op._value as Date);
          }
          return false;
        }
        return actual === expected;
      });
    }).length;
  }

  async findOneBy(where: { id: string }): Promise<User | null> {
    return this.rows.find((row) => row.id === where.id) ?? null;
  }
}

function makeService(users: User[] = []): {
  service: SettingsService;
  settingsRepo: FakeSettingsRepository;
  usersRepo: FakeUsersRepository;
} {
  const settingsRepo = new FakeSettingsRepository();
  const usersRepo = new FakeUsersRepository(users);
  const auditService = new AuditService({} as never);
  const service = new SettingsService(
    settingsRepo as never,
    usersRepo as never,
    auditService,
  );
  return { service, settingsRepo, usersRepo };
}

const actor = { id: "admin-1", username: "son_admin" };

describe("SettingsService.getSettings", () => {
  it("tra mac dinh khi bang rong", async () => {
    const { service } = makeService();
    await expect(service.getSettings()).resolves.toEqual({
      maintenance: false,
      registrationOpen: true,
    });
  });

  it("doc dung gia tri da luu va cache cho lan sau", async () => {
    const { service, settingsRepo } = makeService();
    const row = new SiteSetting();
    row.key = "maintenance";
    row.value = "true";
    settingsRepo.rows.push(row);
    await expect(service.getSettings()).resolves.toEqual({
      maintenance: true,
      registrationOpen: true,
    });
    settingsRepo.rows.length = 0;
    await expect(service.getSettings()).resolves.toEqual({
      maintenance: true,
      registrationOpen: true,
    });
  });
});

describe("SettingsService.updateSettings", () => {
  it("tu choi khi khong co khoa hop le", async () => {
    const { service } = makeService();
    await expect(service.updateSettings(actor, {})).rejects.toThrow(
      "At least one setting must be provided",
    );
    await expect(
      service.updateSettings(actor, { maintenance: "yes" as never }),
    ).rejects.toThrow("At least one setting must be provided");
  });

  it("ghi dong setting va 1 dong audit trong cung giao dich", async () => {
    const { service, settingsRepo } = makeService();
    const next = await service.updateSettings(
      actor,
      { maintenance: true, registrationOpen: false },
      "203.0.113.7",
    );
    expect(next).toEqual({ maintenance: true, registrationOpen: false });
    expect(
      settingsRepo.rows.map((row) => `${row.key}=${row.value}`).sort(),
    ).toEqual(["maintenance=true", "registrationOpen=false"]);
    expect(settingsRepo.auditStore.rows).toHaveLength(1);
    const log = settingsRepo.auditStore.rows[0];
    expect(log.action).toBe(AuditAction.SettingsChanged);
    expect(log.actorId).toBe("admin-1");
    expect(log.ip).toBe("203.0.113.7");
    expect(log.detail).toEqual({
      previous: { maintenance: false, registrationOpen: true },
      new: { maintenance: true, registrationOpen: false },
    });
    // Cache cap nhat ngay, khong can doc lai DB.
    settingsRepo.rows.length = 0;
    await expect(service.getSettings()).resolves.toEqual(next);
  });

  it("chi ghi khoa that su doi, khong ghi audit khi khong doi", async () => {
    const { service, settingsRepo } = makeService();
    await service.updateSettings(actor, { maintenance: true });
    expect(settingsRepo.auditStore.rows).toHaveLength(1);
    await service.updateSettings(actor, { maintenance: true });
    expect(settingsRepo.auditStore.rows).toHaveLength(1);
    await service.updateSettings(actor, { maintenance: true, registrationOpen: true });
    expect(settingsRepo.auditStore.rows).toHaveLength(1);
    await service.updateSettings(actor, { registrationOpen: false });
    expect(settingsRepo.auditStore.rows).toHaveLength(2);
    expect(settingsRepo.auditStore.rows[1].detail).toEqual({
      previous: { registrationOpen: true },
      new: { registrationOpen: false },
    });
  });
});

describe("SettingsService.getStats", () => {
  it("dem dung tong, admin, da khoa va moi trong 7 ngay", async () => {
    const now = Date.now();
    const users = [
      makeUser({
        id: "u1",
        role: UserRole.Admin,
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      }),
      makeUser({
        id: "u2",
        status: UserStatus.Suspended,
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      }),
      makeUser({
        id: "u3",
        createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      }),
      makeUser({
        id: "u4",
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      }),
    ];
    const { service } = makeService(users);
    await expect(service.getStats()).resolves.toEqual({
      totalUsers: 4,
      adminCount: 1,
      suspendedCount: 1,
      newUsersLast7Days: 2,
    });
  });
});

describe("MaintenanceGuard", () => {
  function makeGuard(maintenance: boolean, users: User[] = []) {
    const settingsService = {
      isMaintenance: vi.fn(async () => maintenance),
    };
    const jwtService = {
      verifyAsync: vi.fn(async (token: string) => {
        if (token === "admin-token") return { sub: "admin-1" };
        if (token === "user-token") return { sub: "user-1" };
        throw new Error("invalid token");
      }),
    };
    const usersRepo = new FakeUsersRepository(users);
    const guard = new MaintenanceGuard(
      settingsService as never,
      jwtService as never,
      usersRepo as never,
    );
    return guard;
  }

  function makeContext(path: string, authorization?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          headers: authorization ? { authorization } : {},
        }),
      }),
    } as never;
  }

  const admin = makeUser({
    id: "admin-1",
    username: "son_admin",
    role: UserRole.Admin,
  });
  const reader = makeUser({ id: "user-1", username: "reader" });

  it("bao tri tat: cho qua tat ca ke ca khach an danh", async () => {
    const guard = makeGuard(false);
    await expect(
      guard.canActivate(makeContext("/works")),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(makeContext("/works", "Bearer bogus")),
    ).resolves.toBe(true);
  });

  it("bao tri bat: admin qua, user thuong va khach an danh nhan 503", async () => {
    const guard = makeGuard(true, [admin, reader]);
    await expect(
      guard.canActivate(makeContext("/works", "Bearer admin-token")),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(makeContext("/works", "Bearer user-token")),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      guard.canActivate(makeContext("/works")),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      guard.canActivate(makeContext("/works", "Bearer bogus")),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("503 mang code maintenance de client nhan ra", async () => {
    const guard = makeGuard(true, [reader]);
    const failure = await guard
      .canActivate(makeContext("/works"))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpException);
    const body = (failure as HttpException).getResponse() as Record<
      string,
      unknown
    >;
    expect(body.code).toBe("maintenance");
  });

  it("duong dan mien luon cho qua khi bao tri bat", async () => {
    const guard = makeGuard(true, []);
    for (const path of [
      "/site/status",
      "/auth/login",
      "/auth/refresh",
      "/auth/logout",
      "/admin/users",
      "/admin/settings",
    ]) {
      await expect(guard.canActivate(makeContext(path))).resolves.toBe(true);
    }
    // Route thuong khong mien, ke ca /auth/register va /auth/me.
    for (const path of ["/auth/register", "/auth/me", "/works/1/file"]) {
      await expect(guard.canActivate(makeContext(path))).rejects.toMatchObject(
        { status: 503 },
      );
    }
  });
});

describe("AuthService registration gate", () => {
  function makeAuth(registrationOpen: boolean) {
    const register = vi.fn(async () => ({
      id: "new-1",
      username: "moi",
      displayName: "Moi",
      role: UserRole.User,
      status: UserStatus.Active,
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const auth = new AuthService(
      { register } as never,
      { signAsync: vi.fn(async () => "access-token") } as never,
      { create: vi.fn(async () => ({ token: "refresh", expiresAt: new Date() })) } as never,
      {
        getSettings: vi.fn(async () => ({
          maintenance: false,
          registrationOpen,
        })),
        isRegistrationOpen: vi.fn(async () => registrationOpen),
      } as never,
    );
    return { auth, register };
  }

  it("dang ky dong: tu choi truoc khi tao tai khoan", async () => {
    const { auth, register } = makeAuth(false);
    await expect(
      auth.registerAndCreateSession({
        displayName: "Moi",
        username: "moi",
        password: "mat-khau-1",
        agree: true,
      }),
    ).rejects.toThrow("Registration is closed");
    expect(register).not.toHaveBeenCalled();
  });

  it("dang ky mo: tao tai khoan binh thuong", async () => {
    const { auth, register } = makeAuth(true);
    await auth.registerAndCreateSession({
      displayName: "Moi",
      username: "moi",
      password: "mat-khau-1",
      agree: true,
    });
    expect(register).toHaveBeenCalledTimes(1);
  });
});
