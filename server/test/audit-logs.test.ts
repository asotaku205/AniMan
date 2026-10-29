import "reflect-metadata";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../src/auth/guards/roles.guard.js";
import { ROLES_METADATA_KEY } from "../src/auth/decorators/roles.decorator.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { AuditAction } from "../src/audit/audit-action.enum.js";
import { AuditController } from "../src/audit/audit.controller.js";
import { ListAuditLogsQueryDto } from "../src/audit/audit.dto.js";
import { AuditLog } from "../src/audit/audit-log.entity.js";
import { AuditService } from "../src/audit/audit.service.js";

function makeRow(overrides: Partial<AuditLog> = {}): AuditLog {
  const row = new AuditLog();
  row.id = "log-1";
  row.actorId = "admin-1";
  row.actorUsername = "son_admin";
  row.action = AuditAction.UserSuspended;
  row.targetType = "user";
  row.targetId = "user-1";
  row.targetLabel = "spam_bot_01";
  row.detail = { previousStatus: "active", newStatus: "suspended" };
  row.ip = "203.0.113.7";
  row.createdAt = new Date("2026-10-29T00:00:00Z");
  return Object.assign(row, overrides);
}

/** Query builder gia: loc that tu tham so, giong ngu nghia cua service. */
class FakeAuditQueryBuilder {
  private search?: string;
  private actor?: string;
  private action?: AuditAction;
  private skipCount = 0;
  private takeCount = 20;

  constructor(private readonly rows: AuditLog[]) {}

  andWhere(_sql: string, params: Record<string, unknown>): this {
    if (typeof params.search === "string") {
      this.search = params.search.replace(/%/g, "").toLowerCase();
    }
    if (typeof params.actor === "string") {
      this.actor = params.actor.replace(/%/g, "").toLowerCase();
    }
    if (typeof params.action === "string") {
      this.action = params.action as AuditAction;
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

  async getManyAndCount(): Promise<[AuditLog[], number]> {
    let filtered = [...this.rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    if (this.search) {
      const q = this.search;
      filtered = filtered.filter(
        (row) =>
          row.actorUsername.toLowerCase().includes(q) ||
          row.targetLabel.toLowerCase().includes(q),
      );
    }
    if (this.actor) {
      filtered = filtered.filter((row) =>
        row.actorUsername.toLowerCase().includes(this.actor!),
      );
    }
    if (this.action) {
      filtered = filtered.filter((row) => row.action === this.action);
    }
    const total = filtered.length;
    return [
      filtered.slice(this.skipCount, this.skipCount + this.takeCount),
      total,
    ];
  }
}

class FakeAuditRepository {
  rows: AuditLog[];

  constructor(rows: AuditLog[] = []) {
    this.rows = rows;
  }

  createQueryBuilder(): FakeAuditQueryBuilder {
    return new FakeAuditQueryBuilder(this.rows);
  }

  create(partial: Partial<AuditLog>): AuditLog {
    return Object.assign(new AuditLog(), partial);
  }

  async save(row: AuditLog): Promise<AuditLog> {
    this.rows.push(row);
    return row;
  }
}

describe("AuditService.listAuditLogs", () => {
  function makeService(rows: AuditLog[]) {
    const repo = new FakeAuditRepository(rows);
    return new AuditService(repo as never);
  }

  it("tra moi nhat truoc va envelope phan trang dung", async () => {
    const rows = [
      makeRow({ id: "old", createdAt: new Date("2026-10-27T00:00:00Z") }),
      makeRow({ id: "new", createdAt: new Date("2026-10-29T00:00:00Z") }),
      makeRow({ id: "mid", createdAt: new Date("2026-10-28T00:00:00Z") }),
    ];
    const service = makeService(rows);
    const page1 = await service.listAuditLogs({ page: 1, pageSize: 2 });
    expect(page1.items.map((row) => row.id)).toEqual(["new", "mid"]);
    expect(page1.total).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    const page2 = await service.listAuditLogs({ page: 2, pageSize: 2 });
    expect(page2.items.map((row) => row.id)).toEqual(["old"]);
  });

  it("loc theo actor, action va tim kiem tren nguoi lam + doi tuong", async () => {
    const rows = [
      makeRow({ id: "a", actorUsername: "son_admin", targetLabel: "spam_bot_01" }),
      makeRow({
        id: "b",
        actorUsername: "anime_lord_vn",
        action: AuditAction.WorkApproved,
        targetLabel: "Rong Ha Long",
      }),
      makeRow({
        id: "c",
        actorUsername: "son_admin",
        action: AuditAction.WorkRejected,
        targetLabel: "La thu mua ha",
      }),
    ];
    const service = makeService(rows);
    const byActor = await service.listAuditLogs({
      page: 1,
      pageSize: 20,
      actor: "SON",
    });
    expect(byActor.items.map((row) => row.id).sort()).toEqual(["a", "c"]);
    const byAction = await service.listAuditLogs({
      page: 1,
      pageSize: 20,
      action: AuditAction.WorkApproved,
    });
    expect(byAction.items.map((row) => row.id)).toEqual(["b"]);
    const bySearch = await service.listAuditLogs({
      page: 1,
      pageSize: 20,
      search: "la thu",
    });
    expect(bySearch.items.map((row) => row.id)).toEqual(["c"]);
  });

  it("gioi han pageSize 1..50 va mac dinh 20", async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeRow({ id: `r${i}` }),
    );
    const service = makeService(rows);
    const clamped = await service.listAuditLogs({ page: 1, pageSize: 500 });
    expect(clamped.pageSize).toBe(50);
    const fallback = await service.listAuditLogs({ page: 0, pageSize: 0 });
    expect(fallback.page).toBe(1);
    expect(fallback.pageSize).toBe(20);
  });

  it("view khong bao gio chua mat khau hay token", async () => {
    const service = makeService([makeRow()]);
    const result = await service.listAuditLogs({ page: 1, pageSize: 20 });
    const serialized = JSON.stringify(result.items);
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("accessToken");
    expect(Object.keys(result.items[0]!).sort()).toEqual(
      [
        "action",
        "actorId",
        "actorUsername",
        "createdAt",
        "detail",
        "id",
        "ip",
        "targetId",
        "targetLabel",
        "targetType",
      ].sort(),
    );
  });
});

describe("AuditService.record", () => {
  it("ghi qua EntityManager cua giao dich, khong dung repository don doc", async () => {
    const txRows: AuditLog[] = [];
    const txRepo = {
      create: (partial: Partial<AuditLog>) =>
        Object.assign(new AuditLog(), partial),
      save: async (row: AuditLog) => {
        txRows.push(row);
        return row;
      },
    };
    const manager = {
      getRepository: () => txRepo,
    };
    const standaloneRepo = {
      create: () => {
        throw new Error("must not use the standalone repository");
      },
      save: async () => {
        throw new Error("must not use the standalone repository");
      },
    };
    const service = new AuditService(standaloneRepo as never);
    const saved = await service.record(manager as never, {
      actor: { id: "admin-1", username: "son_admin" },
      action: AuditAction.WorkApproved,
      targetType: "work_submission",
      targetId: "work-1",
      targetLabel: "Rong Ha Long",
      detail: { type: "manga", visibility: "public" },
      ip: null,
    });
    expect(txRows).toHaveLength(1);
    expect(saved.actorUsername).toBe("son_admin");
    expect(saved.ip).toBeNull();
    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});

describe("ListAuditLogsQueryDto", () => {
  it("chap nhan tham so hop le", async () => {
    const dto = plainToInstance(ListAuditLogsQueryDto, {
      page: 2,
      pageSize: 20,
      actor: "son",
      action: "user.suspended",
      search: "spam",
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("tu choi page, pageSize va action khong hop le", async () => {
    const badPage = plainToInstance(ListAuditLogsQueryDto, { page: 0 });
    expect(await validate(badPage)).toHaveLength(1);
    const badSize = plainToInstance(ListAuditLogsQueryDto, { pageSize: 51 });
    expect(await validate(badSize)).toHaveLength(1);
    const badAction = plainToInstance(ListAuditLogsQueryDto, {
      action: "user.login",
    });
    expect(await validate(badAction)).toHaveLength(1);
  });
});

describe("AuditController (Lat 3)", () => {
  let auditService: { listAuditLogs: ReturnType<typeof vi.fn> };
  let controller: AuditController;

  beforeEach(() => {
    auditService = {
      listAuditLogs: vi.fn(async () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      })),
    };
    controller = new AuditController(auditService as never);
  });

  it("duoc bao ve bang JwtAuthGuard, RolesGuard va role admin", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuditController,
    ) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(RolesGuard);
    const roles = Reflect.getMetadata(
      ROLES_METADATA_KEY,
      AuditController,
    ) as unknown[];
    expect(roles).toEqual([UserRole.Admin]);
  });

  it("GET /admin/audit-logs truyen dung tham so loc va phan trang", async () => {
    await controller.listAuditLogs({
      page: 2,
      pageSize: 20,
      actor: "son",
      action: AuditAction.WorkRejected,
      search: "la thu",
    });
    expect(auditService.listAuditLogs).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      actor: "son",
      action: AuditAction.WorkRejected,
      search: "la thu",
    });
  });

  it("GET /admin/audit-logs dung page 1 va pageSize 20 khi khong truyen tham so", async () => {
    await controller.listAuditLogs({});
    expect(auditService.listAuditLogs).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      actor: undefined,
      action: undefined,
      search: undefined,
    });
  });

  it("khong co endpoint sua hay xoa dong log", () => {
    const methods = Object.getOwnPropertyNames(AuditController.prototype);
    expect(methods).toEqual(["constructor", "listAuditLogs"]);
  });
});
