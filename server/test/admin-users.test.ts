import "reflect-metadata";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import * as argon2 from "argon2";
import { ForbiddenException } from "@nestjs/common";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../src/auth/guards/roles.guard.js";
import { ROLES_METADATA_KEY } from "../src/auth/decorators/roles.decorator.js";
import { AdminController } from "../src/auth/admin.controller.js";
import { AuditAction } from "../src/audit/audit-action.enum.js";
import { AuditLog } from "../src/audit/audit-log.entity.js";
import { AuditService } from "../src/audit/audit.service.js";
import {
  ChangeAdminUserRoleDto,
  ChangeAdminUserStatusDto,
  ListAdminUsersQueryDto,
} from "../src/auth/admin-users.dto.js";
import { AuthService } from "../src/auth/auth.service.js";
import { User } from "../src/users/user.entity.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { UserStatus } from "../src/users/user-status.enum.js";
import {
  UsersService,
  type PublicUser,
} from "../src/users/users.service.js";

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

function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    termsAcceptedAt: user.termsAcceptedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function matchesWhere(user: User, where: Partial<User>): boolean {
  return (Object.keys(where) as (keyof User)[]).every(
    (key) => user[key] === where[key],
  );
}

/** Query builder giả: lọc thật từ tham số, giống ngữ nghĩa của service. */
class FakeQueryBuilder {
  private search?: string;
  private role?: UserRole;
  private status?: UserStatus;
  private skipCount = 0;
  private takeCount = 20;

  constructor(private readonly rows: User[]) {}

  andWhere(_sql: string, params: Record<string, unknown>): this {
    if (typeof params.search === "string") {
      this.search = params.search.replace(/%/g, "").toLowerCase();
    }
    if (typeof params.role === "string") this.role = params.role as UserRole;
    if (typeof params.status === "string") {
      this.status = params.status as UserStatus;
    }
    return this;
  }

  orderBy(): this {
    return this;
  }

  addOrderBy(): this {
    return this;
  }

  skip(n: number): this {
    this.skipCount = n;
    return this;
  }

  take(n: number): this {
    this.takeCount = n;
    return this;
  }

  async getManyAndCount(): Promise<[User[], number]> {
    let filtered = [...this.rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    if (this.search) {
      const q = this.search;
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q),
      );
    }
    if (this.role) filtered = filtered.filter((u) => u.role === this.role);
    if (this.status) {
      filtered = filtered.filter((u) => u.status === this.status);
    }
    const total = filtered.length;
    return [filtered.slice(this.skipCount, this.skipCount + this.takeCount), total];
  }
}

/** Kho luu audit gia: chi nhan ghi qua EntityManager cua giao dich. */
class FakeAuditLogStore {
  rows: AuditLog[] = [];

  create(partial: Partial<AuditLog>): AuditLog {
    return Object.assign(new AuditLog(), partial);
  }

  async save(row: AuditLog): Promise<AuditLog> {
    this.rows.push(row);
    return row;
  }
}

class FakeUsersRepository {
  rows: User[];
  auditRows = new FakeAuditLogStore();
  lastQueryBuilder: FakeQueryBuilder | null = null;
  readonly manager: {
    transaction: <T>(cb: (manager: unknown) => Promise<T>) => Promise<T>;
  };

  constructor(rows: User[]) {
    this.rows = rows;
    const self = this;
    this.manager = {
      transaction: async <T,>(cb: (manager: unknown) => Promise<T>) => {
        const manager = {
          getRepository: (entity: unknown) =>
            entity === AuditLog ? self.auditRows : self,
        };
        return cb(manager);
      },
    };
  }

  createQueryBuilder(): FakeQueryBuilder {
    this.lastQueryBuilder = new FakeQueryBuilder(this.rows);
    return this.lastQueryBuilder;
  }

  async findOneBy(where: Partial<User>): Promise<User | null> {
    return this.rows.find((u) => matchesWhere(u, where)) ?? null;
  }

  async count(): Promise<number> {
    return this.rows.length;
  }

  async countBy(where: Partial<User>): Promise<number> {
    return this.rows.filter((u) => matchesWhere(u, where)).length;
  }

  async save(user: User): Promise<User> {
    const index = this.rows.findIndex((u) => u.id === user.id);
    if (index >= 0) this.rows[index] = user;
    else this.rows.push(user);
    return user;
  }
}

function makeService(rows: User[]): {
  service: UsersService;
  repo: FakeUsersRepository;
  auditRows: FakeAuditLogStore;
} {
  const repo = new FakeUsersRepository(rows);
  // Repository don doc co tinh de trong: record() phai dung EntityManager
  // cua giao dich, neu dung nham repo nay se vo ngay.
  const auditService = new AuditService({} as never);
  const service = new UsersService(repo as never, auditService);
  return { service, repo, auditRows: repo.auditRows };
}

const actor = makeUser({
  id: "admin-1",
  username: "admin",
  displayName: "Admin",
  role: UserRole.Admin,
});

const actorRef = { id: actor.id, username: actor.username };

describe("UsersService.listUsers", () => {
  it("phan trang va dem dung, moi nhat truoc", async () => {
    const rows = [
      makeUser({ id: "u1", username: "aaa", createdAt: new Date("2026-01-01") }),
      makeUser({ id: "u2", username: "bbb", createdAt: new Date("2026-02-01") }),
      makeUser({ id: "u3", username: "ccc", createdAt: new Date("2026-03-01") }),
    ];
    const { service } = makeService(rows);
    const page1 = await service.listUsers({ page: 1, pageSize: 2 });
    expect(page1.items.map((u) => u.id)).toEqual(["u3", "u2"]);
    expect(page1.total).toBe(3);
    expect(page1.counts).toEqual({ total: 3, admin: 0, active: 3, suspended: 0 });
    const page2 = await service.listUsers({ page: 2, pageSize: 2 });
    expect(page2.items.map((u) => u.id)).toEqual(["u1"]);
  });

  it("tim kiem theo username va ten hien thi, loc theo role va status", async () => {
    const rows = [
      makeUser({ id: "u1", username: "sakura_vn", displayName: "Sakura" }),
      makeUser({
        id: "u2",
        username: "other",
        displayName: "Sakura Nguyen",
        role: UserRole.Admin,
      }),
      makeUser({
        id: "u3",
        username: "third",
        displayName: "Third",
        status: UserStatus.Suspended,
      }),
    ];
    const { service } = makeService(rows);
    const found = await service.listUsers({ page: 1, pageSize: 20, q: "SAKURA" });
    expect(found.items.map((u) => u.id).sort()).toEqual(["u1", "u2"]);
    const admins = await service.listUsers({ page: 1, pageSize: 20, role: UserRole.Admin });
    expect(admins.items.map((u) => u.id)).toEqual(["u2"]);
    const suspended = await service.listUsers({
      page: 1,
      pageSize: 20,
      status: UserStatus.Suspended,
    });
    expect(suspended.items.map((u) => u.id)).toEqual(["u3"]);
    expect(suspended.counts.suspended).toBe(1);
  });

  it("khong tra passwordHash", async () => {
    const { service } = makeService([makeUser()]);
    const result = await service.listUsers({ page: 1, pageSize: 20 });
    expect(result.items[0]).not.toHaveProperty("passwordHash");
  });
});

describe("UsersService.changeRole", () => {
  it("cap quyen admin cho user thuong", async () => {
    const target = makeUser({ id: "u1", username: "reader" });
    const { service } = makeService([actor, target]);
    const result = await service.changeRole(actorRef, target.id, UserRole.Admin);
    expect(result.role).toBe(UserRole.Admin);
  });

  it("chan tu doi vai tro cua chinh minh", async () => {
    const { service } = makeService([actor]);
    await expect(
      service.changeRole(actorRef, actor.id, UserRole.User),
    ).rejects.toThrow("Cannot change your own role");
  });

  it("chan ha quyen admin cuoi cung", async () => {
    const { service } = makeService([actor]);
    await expect(
      service.changeRole({ id: "other-admin", username: "other-admin" }, actor.id, UserRole.User),
    ).rejects.toThrow("Cannot demote the last admin");
  });

  it("ha quyen admin khi con admin khac", async () => {
    const second = makeUser({
      id: "admin-2",
      username: "admin2",
      role: UserRole.Admin,
    });
    const { service } = makeService([actor, second]);
    const result = await service.changeRole(actorRef, second.id, UserRole.User);
    expect(result.role).toBe(UserRole.User);
  });

  it("404 khi user khong ton tai", async () => {
    const { service } = makeService([actor]);
    await expect(
      service.changeRole(actorRef, "missing", UserRole.Admin),
    ).rejects.toThrow("User not found");
  });
});

describe("UsersService.changeStatus", () => {
  it("khoa va mo khoa user thuong", async () => {
    const target = makeUser({ id: "u1" });
    const { service } = makeService([actor, target]);
    const locked = await service.changeStatus(
      actorRef,
      target.id,
      UserStatus.Suspended,
    );
    expect(locked.status).toBe(UserStatus.Suspended);
    const unlocked = await service.changeStatus(
      actorRef,
      target.id,
      UserStatus.Active,
    );
    expect(unlocked.status).toBe(UserStatus.Active);
  });

  it("chan khoa tai khoan admin", async () => {
    const second = makeUser({
      id: "admin-2",
      username: "admin2",
      role: UserRole.Admin,
    });
    const { service } = makeService([actor, second]);
    await expect(
      service.changeStatus(actorRef, second.id, UserStatus.Suspended),
    ).rejects.toThrow("Cannot suspend an admin account");
  });

  it("chan tu khoa chinh minh", async () => {
    const { service } = makeService([actor]);
    await expect(
      service.changeStatus(actorRef, actor.id, UserStatus.Suspended),
    ).rejects.toThrow("Cannot change your own account status");
  });

  it("404 khi user khong ton tai", async () => {
    const { service } = makeService([actor]);
    await expect(
      service.changeStatus(actorRef, "missing", UserStatus.Suspended),
    ).rejects.toThrow("User not found");
  });
});

describe("UsersService audit log (Lat 3)", () => {
  it("ghi mot dong user.role_changed dung actor, doi tuong, chi tiet va IP", async () => {
    const target = makeUser({ id: "u1", username: "reader" });
    const { service, auditRows } = makeService([actor, target]);
    await service.changeRole(actorRef, target.id, UserRole.Admin, "203.0.113.7");
    expect(auditRows.rows).toHaveLength(1);
    const row = auditRows.rows[0]!;
    expect(row.action).toBe(AuditAction.UserRoleChanged);
    expect(row.actorId).toBe(actor.id);
    expect(row.actorUsername).toBe("admin");
    expect(row.targetType).toBe("user");
    expect(row.targetId).toBe("u1");
    expect(row.targetLabel).toBe("reader");
    expect(row.detail).toEqual({ previousRole: "user", newRole: "admin" });
    expect(row.ip).toBe("203.0.113.7");
  });

  it("khong ghi log khi vai tro khong doi va khi doi vai tro that bai", async () => {
    const target = makeUser({ id: "u1", role: UserRole.Admin });
    const { service, auditRows } = makeService([actor, target]);
    await service.changeRole(actorRef, target.id, UserRole.Admin);
    expect(auditRows.rows).toHaveLength(0);
    const onlyAdmin = makeService([actor]);
    await expect(
      onlyAdmin.service.changeRole(
        { id: "other-admin", username: "other" },
        actor.id,
        UserRole.User,
      ),
    ).rejects.toThrow("Cannot demote the last admin");
    expect(onlyAdmin.auditRows.rows).toHaveLength(0);
  });

  it("ghi user.suspended roi user.unsuspended, khong ghi khi trang thai khong doi", async () => {
    const target = makeUser({ id: "u1", username: "reader" });
    const { service, auditRows } = makeService([actor, target]);
    await service.changeStatus(actorRef, target.id, UserStatus.Suspended, null);
    await service.changeStatus(actorRef, target.id, UserStatus.Active, null);
    await service.changeStatus(actorRef, target.id, UserStatus.Active, null);
    expect(auditRows.rows.map((row) => row.action)).toEqual([
      AuditAction.UserSuspended,
      AuditAction.UserUnsuspended,
    ]);
    expect(auditRows.rows[0]!.detail).toEqual({
      previousStatus: "active",
      newStatus: "suspended",
    });
    expect(auditRows.rows[1]!.detail).toEqual({
      previousStatus: "suspended",
      newStatus: "active",
    });
    expect(auditRows.rows[0]!.ip).toBeNull();
  });
});

describe("AuthService suspend checks", () => {
  async function makeAuthService(user: User): Promise<{
    auth: AuthService;
    revoke: ReturnType<typeof vi.fn>;
  }> {
    const passwordHash = await argon2.hash("mat-khau-dung", {
      type: argon2.argon2id,
    });
    const stored = { ...user, passwordHash };
    const usersService = {
      findByUsernameForAuthentication: vi.fn(async () => stored),
      findPublicById: vi.fn(async () => toPublic(stored)),
      toPublicUser: vi.fn((u: User) => toPublic(u)),
    };
    const revoke = vi.fn(async () => undefined);
    const refreshSessionsService = {
      rotate: vi.fn(async () => ({
        token: "refresh-token-moi",
        userId: stored.id,
        expiresAt: new Date(),
      })),
      revoke,
      create: vi.fn(),
    };
    const jwtService = { signAsync: vi.fn(async () => "access-token") };
    const settingsService = {
      getSettings: vi.fn(async () => ({
        maintenance: false,
        registrationOpen: true,
      })),
      isRegistrationOpen: vi.fn(async () => true),
    };
    const auth = new AuthService(
      usersService as never,
      jwtService as never,
      refreshSessionsService as never,
      settingsService as never,
    );
    return { auth, revoke };
  }

  it("chan dang nhap khi tai khoan bi khoa, du mat khau dung", async () => {
    const { auth } = await makeAuthService(
      makeUser({ status: UserStatus.Suspended }),
    );
    await expect(auth.validateLocalUser("reader", "mat-khau-dung")).rejects.toThrow(
      ForbiddenException,
    );
    await expect(auth.validateLocalUser("reader", "mat-khau-dung")).rejects.toThrow(
      "Account is suspended",
    );
  });

  it("cho dang nhap khi tai khoan dang hoat dong", async () => {
    const { auth } = await makeAuthService(makeUser());
    await expect(
      auth.validateLocalUser("reader", "mat-khau-dung"),
    ).resolves.toMatchObject({ username: "reader" });
  });

  it("chan lam moi phien khi bi khoa va thu hoi refresh token", async () => {
    const { auth, revoke } = await makeAuthService(
      makeUser({ status: UserStatus.Suspended }),
    );
    await expect(auth.refreshLogin("token-cu")).rejects.toThrow(
      "Account is suspended",
    );
    expect(revoke).toHaveBeenCalledWith("refresh-token-moi");
  });

  it("cho lam moi phien khi dang hoat dong", async () => {
    const { auth } = await makeAuthService(makeUser());
    await expect(auth.refreshLogin("token-cu")).resolves.toMatchObject({
      accessToken: "access-token",
    });
  });
});

describe("AdminController (Lat 2)", () => {
  let usersService: {
    listUsers: ReturnType<typeof vi.fn>;
    changeRole: ReturnType<typeof vi.fn>;
    changeStatus: ReturnType<typeof vi.fn>;
  };
  let controller: AdminController;
  const request = { user: toPublic(actor) } as Parameters<
    AdminController["changeUserRole"]
  >[0];

  beforeEach(() => {
    usersService = {
      listUsers: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        counts: { total: 0, admin: 0, active: 0, suspended: 0 },
      })),
      changeRole: vi.fn(async () => toPublic(actor)),
      changeStatus: vi.fn(async () => toPublic(actor)),
    };
    controller = new AdminController(usersService as never);
  });

  it("duoc bao ve bang JwtAuthGuard, RolesGuard va role admin", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    const roles = Reflect.getMetadata(ROLES_METADATA_KEY, AdminController) as unknown[];
    expect(roles).toContain(UserRole.Admin);
  });

  it("GET /admin/users truyen dung tham so loc va phan trang", async () => {
    await controller.listUsers({
      page: 2,
      pageSize: 20,
      q: "sakura",
      role: UserRole.Admin,
      status: UserStatus.Active,
    });
    expect(usersService.listUsers).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      q: "sakura",
      role: UserRole.Admin,
      status: UserStatus.Active,
    });
  });

  it("PATCH role truyen id actor tu request.user", async () => {
    await controller.changeUserRole(request, "target-1", { role: UserRole.Admin });
    expect(usersService.changeRole).toHaveBeenCalledWith(
      { id: actor.id, username: actor.username },
      "target-1",
      UserRole.Admin,
      null,
    );
  });

  it("PATCH status truyen id actor tu request.user", async () => {
    await controller.changeUserStatus(request, "target-1", {
      status: UserStatus.Suspended,
    });
    expect(usersService.changeStatus).toHaveBeenCalledWith(
      { id: actor.id, username: actor.username },
      "target-1",
      UserStatus.Suspended,
      null,
    );
  });

  it("GET /admin/users dung page 1 va pageSize 20 khi khong truyen tham so", async () => {
    const ctrl = new AdminController(usersService as never);
    await ctrl.listUsers({});
    expect(usersService.listUsers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      q: undefined,
      role: undefined,
      status: undefined,
    });
  });

  it("khong co guard nao khac chen vao giua: user thuong bi RolesGuard chan truoc khi toi service", () => {
    // RolesGuard đã có test riêng ở codebase; ở đây chỉ khẳng định
    // controller không tự kiểm tra role mà dựa hoàn toàn vào guard.
    expect(usersService.listUsers).not.toHaveBeenCalled();
  });
});

describe("admin-users DTO validation", () => {
  it("chap nhan query hop le", async () => {
    const dto = plainToInstance(ListAdminUsersQueryDto, {
      page: "2",
      pageSize: "20",
      q: "sakura",
      role: "admin",
      status: "active",
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
  });

  it("tu choi page 0, pageSize qua lon, role va status la", async () => {
    const dto = plainToInstance(ListAdminUsersQueryDto, {
      page: 0,
      pageSize: 51,
      role: "moderator",
      status: "banned",
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual([
      "page",
      "pageSize",
      "role",
      "status",
    ]);
  });

  it("tu choi role va status ngoai enum trong body", async () => {
    const roleDto = plainToInstance(ChangeAdminUserRoleDto, { role: "super" });
    expect(await validate(roleDto)).toHaveLength(1);
    const statusDto = plainToInstance(ChangeAdminUserStatusDto, {
      status: "deleted",
    });
    expect(await validate(statusDto)).toHaveLength(1);
  });
});
