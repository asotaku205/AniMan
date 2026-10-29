import "reflect-metadata";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ConfigService } from "@nestjs/config";
import type { Repository } from "typeorm";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../src/auth/guards/roles.guard.js";
import { ROLES_METADATA_KEY } from "../src/auth/decorators/roles.decorator.js";
import { User } from "../src/users/user.entity.js";
import { UserRole } from "../src/users/user-role.enum.js";
import { AuditAction } from "../src/audit/audit-action.enum.js";
import { AuditLog } from "../src/audit/audit-log.entity.js";
import { AuditService } from "../src/audit/audit.service.js";
import { AdminWorksController } from "../src/works/admin-works.controller.js";
import { MulterExceptionFilter } from "../src/works/multer-exception.filter.js";
import { OptionalJwtAuthGuard } from "../src/works/optional-jwt-auth.guard.js";
import { resolveUploadsDir } from "../src/works/works.constants.js";
import { WorkStatus } from "../src/works/work-status.enum.js";
import { WorkType } from "../src/works/work-type.enum.js";
import { WorkVisibility } from "../src/works/work-visibility.enum.js";
import { WorkSubmission } from "../src/works/work-submission.entity.js";
import { ListWorksQueryDto, RejectWorkSubmissionDto } from "../src/works/works.dto.js";
import { WorksController } from "../src/works/works.controller.js";
import {
  WorksService,
  canAccessWorkFile,
  isAllowedWorkFile,
  parseSourceRef,
  parseTags,
  type StoredUploadFile,
} from "../src/works/works.service.js";
import { MulterError } from "multer";

function makeUser(
  id: string,
  role: UserRole,
  username = `user-${id}`,
): User {
  const user = new User();
  user.id = id;
  user.username = username;
  user.displayName = `Display ${id}`;
  user.role = role;
  return user;
}

interface FindOptions {
  where?: Record<string, unknown>;
  relations?: Record<string, boolean>;
  order?: Record<string, "ASC" | "DESC">;
  skip?: number;
  take?: number;
}

function matchesWhere(
  item: WorkSubmission,
  where: Record<string, unknown> | undefined,
): boolean {
  if (!where) return true;
  return Object.entries(where).every(
    ([key, value]) =>
      (item as unknown as Record<string, unknown>)[key] === value,
  );
}

/** Kho luu audit gia cho FakeWorkSubmissionsRepository. */
class FakeAuditRepository {
  rows: AuditLog[] = [];

  create(partial: Partial<AuditLog>): AuditLog {
    return Object.assign(new AuditLog(), partial);
  }

  async save(row: AuditLog): Promise<AuditLog> {
    this.rows.push(row);
    return row;
  }
}

/** Repository giả lưu trong bộ nhớ, đủ cho find/count/findOne/save. */
class FakeWorkSubmissionsRepository {
  items: WorkSubmission[] = [];
  authors = new Map<string, User>();
  auditRows = new FakeAuditRepository();

  /** EntityManager gia: giao dich tra ve manager co getRepository. */
  get manager(): {
    transaction: <T>(cb: (manager: unknown) => Promise<T>) => Promise<T>;
  } {
    const self = this;
    return {
      transaction: async <T,>(cb: (manager: unknown) => Promise<T>) => {
        const manager = {
          getRepository: (entity: unknown) =>
            entity === AuditLog ? self.auditRows : self,
        };
        return cb(manager);
      },
    };
  }

  create(partial: Partial<WorkSubmission>): WorkSubmission {
    return Object.assign(new WorkSubmission(), partial);
  }

  async save(entity: WorkSubmission): Promise<WorkSubmission> {
    const now = new Date();
    if (!entity.createdAt) entity.createdAt = now;
    if (!entity.updatedAt) entity.updatedAt = now;
    entity.author =
      this.authors.get(entity.authorId) ??
      makeUser(entity.authorId, UserRole.User);
    const index = this.items.findIndex((item) => item.id === entity.id);
    if (index >= 0) this.items[index] = entity;
    else this.items.push(entity);
    return entity;
  }

  async findOne(options: FindOptions): Promise<WorkSubmission | null> {
    return (
      this.items.find((item) => matchesWhere(item, options.where)) ?? null
    );
  }

  async find(options: FindOptions): Promise<WorkSubmission[]> {
    const filtered = this.items.filter((item) =>
      matchesWhere(item, options.where),
    );
    filtered.sort((a, b) => {
      const timeA = a.createdAt?.getTime() ?? 0;
      const timeB = b.createdAt?.getTime() ?? 0;
      if (timeB !== timeA) return timeB - timeA;
      return a.id.localeCompare(b.id);
    });
    const skip = options.skip ?? 0;
    const take = options.take ?? filtered.length;
    return filtered.slice(skip, skip + take);
  }

  async count(options?: FindOptions): Promise<number> {
    return this.items.filter((item) => matchesWhere(item, options?.where))
      .length;
  }
}

describe("parseTags", () => {
  it("parses a JSON array string", () => {
    expect(parseTags('["a", " b ", "#c"]')).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for missing tags", () => {
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });

  it("rejects more than 10 tags", () => {
    const raw = JSON.stringify(Array.from({ length: 11 }, (_, i) => `t${i}`));
    expect(() => parseTags(raw)).toThrowError();
  });

  it("rejects a tag longer than 30 characters", () => {
    expect(() => parseTags(JSON.stringify(["x".repeat(31)]))).toThrowError();
  });
});

describe("parseSourceRef", () => {
  it("parses a valid JSON source reference", () => {
    expect(
      parseSourceRef(JSON.stringify({ kind: "manga", id: "p1", label: "Ch 1" })),
    ).toEqual({ kind: "manga", id: "p1", label: "Ch 1" });
  });

  it("returns null for missing source reference", () => {
    expect(parseSourceRef(undefined)).toBeNull();
    expect(parseSourceRef("")).toBeNull();
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      parseSourceRef(JSON.stringify({ kind: "song", id: "1", label: "x" })),
    ).toThrowError();
  });
});

describe("isAllowedWorkFile", () => {
  it("accepts manga images and CBZ archives, rejects PDFs", () => {
    expect(isAllowedWorkFile(WorkType.Manga, "image/png", "page.png")).toBe(
      true,
    );
    expect(
      isAllowedWorkFile(WorkType.Manga, "application/zip", "vol1.cbz"),
    ).toBe(true);
    expect(
      isAllowedWorkFile(WorkType.Manga, "application/pdf", "book.pdf"),
    ).toBe(false);
  });

  it("accepts novel documents, rejects images", () => {
    expect(
      isAllowedWorkFile(WorkType.Novel, "application/pdf", "novel.pdf"),
    ).toBe(true);
    expect(isAllowedWorkFile(WorkType.Novel, "image/png", "page.png")).toBe(
      false,
    );
  });

  it("accepts videos for animation, rejects videos for fanart", () => {
    expect(
      isAllowedWorkFile(WorkType.Animation, "video/mp4", "ep1.mp4"),
    ).toBe(true);
    expect(isAllowedWorkFile(WorkType.Fanart, "video/mp4", "ep1.mp4")).toBe(
      false,
    );
    expect(isAllowedWorkFile(WorkType.Fanart, "image/jpeg", "art.jpg")).toBe(
      true,
    );
  });
});

describe("canAccessWorkFile", () => {
  const base = {
    authorId: "author-1",
    status: WorkStatus.Pending,
    visibility: WorkVisibility.Public,
  };

  it("denies anonymous access to pending works", () => {
    expect(canAccessWorkFile(base, undefined)).toBe(false);
  });

  it("allows anonymous access to approved public and unlisted works", () => {
    expect(
      canAccessWorkFile(
        { ...base, status: WorkStatus.Approved },
        undefined,
      ),
    ).toBe(true);
    expect(
      canAccessWorkFile(
        {
          ...base,
          status: WorkStatus.Approved,
          visibility: WorkVisibility.Unlisted,
        },
        undefined,
      ),
    ).toBe(true);
  });

  it("denies anonymous access to approved private and rejected works", () => {
    expect(
      canAccessWorkFile(
        {
          ...base,
          status: WorkStatus.Approved,
          visibility: WorkVisibility.Private,
        },
        undefined,
      ),
    ).toBe(false);
    expect(
      canAccessWorkFile({ ...base, status: WorkStatus.Rejected }, undefined),
    ).toBe(false);
  });

  it("allows the author and admins regardless of status", () => {
    const author = makeUser("author-1", UserRole.User);
    const admin = makeUser("admin-1", UserRole.Admin);
    expect(canAccessWorkFile(base, author)).toBe(true);
    expect(canAccessWorkFile(base, admin)).toBe(true);
    const other = makeUser("other-1", UserRole.User);
    expect(canAccessWorkFile(base, other)).toBe(false);
  });
});

describe("WorksService", () => {
  let tmpDir: string;
  let repository: FakeWorkSubmissionsRepository;
  let service: WorksService;
  let auditRows: FakeAuditRepository;
  const author = makeUser("author-1", UserRole.User);
  const admin = makeUser("admin-1", UserRole.Admin);

  async function fixtureFile(name: string, size: number): Promise<string> {
    const path = join(tmpDir, name);
    await writeFile(path, Buffer.alloc(size, 1));
    return path;
  }

  function storedFile(
    path: string,
    originalname: string,
    size: number,
    mimetype: string,
  ): StoredUploadFile {
    return {
      filename: path.split("/").pop() ?? originalname,
      originalname,
      size,
      mimetype,
      path,
    };
  }

  async function seedSubmission(
    overrides: Partial<WorkSubmission>,
  ): Promise<WorkSubmission> {
    const submission = repository.create({
      id: `seed-${repository.items.length + 1}`,
      authorId: author.id,
      type: WorkType.Manga,
      title: "Seed work",
      description: "",
      genre: "",
      tags: [],
      visibility: WorkVisibility.Public,
      coverPath: null,
      fileName: "page.png",
      fileSize: 10,
      filePath: "stored.png",
      mimeType: "image/png",
      sourceRef: null,
      status: WorkStatus.Pending,
      rejectReason: null,
      reviewedById: null,
      reviewedAt: null,
      ...overrides,
    });
    return repository.save(submission);
  }

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "animan-works-"));
    repository = new FakeWorkSubmissionsRepository();
    repository.authors.set(author.id, author);
    repository.authors.set(admin.id, admin);
    const config = {
      get: (key: string) => (key === "UPLOADS_DIR" ? tmpDir : undefined),
    } as unknown as ConfigService;
    const auditService = new AuditService({} as never);
    auditRows = repository.auditRows;
    service = new WorksService(
      repository as unknown as Repository<WorkSubmission>,
      config,
      auditService,
    );
  });

  it("creates a pending submission without exposing disk paths", async () => {
    const filePath = await fixtureFile("work.png", 10);
    const coverPath = await fixtureFile("cover.png", 10);
    const view = await service.createSubmission(
      author.id,
      {
        type: WorkType.Manga,
        title: "  My manga  ",
        tags: JSON.stringify(["action", "fantasy"]),
        visibility: WorkVisibility.Public,
      },
      {
        file: storedFile(filePath, "page.png", 10, "image/png"),
        cover: storedFile(coverPath, "cover.png", 10, "image/png"),
      },
    );
    expect(view.status).toBe(WorkStatus.Pending);
    expect(view.title).toBe("My manga");
    expect(view.tags).toEqual(["action", "fantasy"]);
    expect(view.fileUrl).toBe(`/works/${view.id}/file`);
    expect(view.coverUrl).toBe(`/works/${view.id}/cover`);
    expect(JSON.stringify(view)).not.toContain(tmpDir);
    expect(JSON.stringify(view)).not.toContain("work.png");
    await expect(stat(filePath)).resolves.toBeDefined();
  });

  it("deletes stored files and throws 413 when the work file is too big", async () => {
    const filePath = await fixtureFile("big.mp4", 10);
    await expect(
      service.createSubmission(
        author.id,
        {
          type: WorkType.Manga,
          title: "Too big",
          visibility: WorkVisibility.Public,
        },
        {
          file: storedFile(filePath, "big.mp4", 101 * 1024 * 1024, "video/mp4"),
        },
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(stat(filePath)).rejects.toThrowError();
    expect(repository.items).toHaveLength(0);
  });

  it("deletes stored files when the file type is not allowed", async () => {
    const filePath = await fixtureFile("book.pdf", 10);
    await expect(
      service.createSubmission(
        author.id,
        {
          type: WorkType.Manga,
          title: "Wrong type",
          visibility: WorkVisibility.Public,
        },
        {
          file: storedFile(filePath, "book.pdf", 10, "application/pdf"),
        },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(stat(filePath)).rejects.toThrowError();
  });

  it("deletes the cover when the cover exceeds 5MB", async () => {
    const filePath = await fixtureFile("page.png", 10);
    const coverPath = await fixtureFile("cover.png", 10);
    await expect(
      service.createSubmission(
        author.id,
        {
          type: WorkType.Manga,
          title: "Big cover",
          visibility: WorkVisibility.Public,
        },
        {
          file: storedFile(filePath, "page.png", 10, "image/png"),
          cover: storedFile(coverPath, "cover.png", 6 * 1024 * 1024, "image/png"),
        },
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(stat(filePath)).rejects.toThrowError();
    await expect(stat(coverPath)).rejects.toThrowError();
  });

  it("lists only approved public works", async () => {
    await seedSubmission({ status: WorkStatus.Pending });
    const approved = await seedSubmission({ status: WorkStatus.Approved });
    await seedSubmission({
      status: WorkStatus.Approved,
      visibility: WorkVisibility.Unlisted,
    });
    await seedSubmission({
      status: WorkStatus.Approved,
      visibility: WorkVisibility.Private,
    });
    await seedSubmission({ status: WorkStatus.Rejected });
    const list = await service.listPublic({ page: 1, pageSize: 20 });
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(approved.id);
  });

  it("lists the author's own works with a status filter", async () => {
    await seedSubmission({ authorId: author.id, status: WorkStatus.Pending });
    await seedSubmission({ authorId: "other-1", status: WorkStatus.Pending });
    const list = await service.listMine(author.id, {
      page: 1,
      pageSize: 20,
      status: WorkStatus.Pending,
    });
    expect(list.total).toBe(1);
  });

  it("reviews only pending submissions and requires a reason to reject", async () => {
    const pending = await seedSubmission({});
    await expect(
      service.reviewSubmission({ id: admin.id, username: admin.username }, pending.id, "reject", "too short"),
    ).rejects.toMatchObject({ status: 400 });
    const rejected = await service.reviewSubmission(
      { id: admin.id, username: admin.username },
      pending.id,
      "reject",
      "Needs better line art quality.",
    );
    expect(rejected.status).toBe(WorkStatus.Rejected);
    expect(rejected.rejectReason).toBe("Needs better line art quality.");
    expect(rejected.reviewedAt).not.toBeNull();
    await expect(
      service.reviewSubmission({ id: admin.id, username: admin.username }, pending.id, "approve"),
    ).rejects.toMatchObject({ status: 409 });

    const second = await seedSubmission({});
    const approved = await service.reviewSubmission(
      { id: admin.id, username: admin.username },
      second.id,
      "approve",
    );
    expect(approved.status).toBe(WorkStatus.Approved);
    expect(approved.rejectReason).toBeNull();
    await expect(
      service.reviewSubmission({ id: admin.id, username: admin.username }, "missing-id", "approve"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("ghi audit log khi duyet va tu choi, khong ghi khi duyet that bai", async () => {
    const rejectedSeed = await seedSubmission({ title: "Bi tu choi" });
    await expect(
      service.reviewSubmission(
        { id: admin.id, username: admin.username },
        rejectedSeed.id,
        "reject",
        "too short",
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(auditRows.rows).toHaveLength(0);

    const rejected = await service.reviewSubmission(
      { id: admin.id, username: admin.username },
      rejectedSeed.id,
      "reject",
      "Needs better line art quality.",
      "203.0.113.7",
    );
    expect(rejected.status).toBe(WorkStatus.Rejected);
    expect(auditRows.rows).toHaveLength(1);
    const rejectRow = auditRows.rows[0]!;
    expect(rejectRow.action).toBe(AuditAction.WorkRejected);
    expect(rejectRow.actorId).toBe(admin.id);
    expect(rejectRow.actorUsername).toBe(admin.username);
    expect(rejectRow.targetType).toBe("work_submission");
    expect(rejectRow.targetLabel).toBe("Bi tu choi");
    expect(rejectRow.detail.reason).toBe("Needs better line art quality.");
    expect(rejectRow.detail.previousStatus).toBe("pending");
    expect(rejectRow.detail.newStatus).toBe("rejected");
    expect(rejectRow.ip).toBe("203.0.113.7");

    await expect(
      service.reviewSubmission(
        { id: admin.id, username: admin.username },
        rejectedSeed.id,
        "approve",
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(auditRows.rows).toHaveLength(1);

    const approvedSeed = await seedSubmission({ title: "Duoc duyet" });
    await service.reviewSubmission(
      { id: admin.id, username: admin.username },
      approvedSeed.id,
      "approve",
    );
    expect(auditRows.rows).toHaveLength(2);
    const approveRow = auditRows.rows[1]!;
    expect(approveRow.action).toBe(AuditAction.WorkApproved);
    expect(approveRow.targetLabel).toBe("Duoc duyet");
    expect(approveRow.detail.visibility).toBe("public");
    expect(approveRow.detail.type).toBe("manga");
  });

  it("resubmits only the author's own rejected submissions", async () => {
    const rejected = await seedSubmission({ status: WorkStatus.Rejected });
    const resubmitted = await service.resubmit(author.id, rejected.id);
    expect(resubmitted.status).toBe(WorkStatus.Pending);
    expect(resubmitted.rejectReason).toBeNull();
    expect(resubmitted.id).toBe(rejected.id);

    const pending = await seedSubmission({});
    await expect(service.resubmit(author.id, pending.id)).rejects.toMatchObject(
      { status: 409 },
    );
    const foreign = await seedSubmission({
      authorId: "other-1",
      status: WorkStatus.Rejected,
    });
    await expect(service.resubmit(author.id, foreign.id)).rejects.toMatchObject(
      { status: 403 },
    );
  });

  it("defaults the review queue to pending and counts all statuses", async () => {
    await seedSubmission({ status: WorkStatus.Pending });
    await seedSubmission({ status: WorkStatus.Approved });
    await seedSubmission({ status: WorkStatus.Rejected });
    const queue = await service.listReviewQueue({ page: 1, pageSize: 20 });
    expect(queue.total).toBe(1);
    expect(queue.items[0]?.status).toBe(WorkStatus.Pending);
    await expect(service.reviewCounts()).resolves.toEqual({
      pending: 1,
      approved: 1,
      rejected: 1,
      total: 3,
    });
  });

  it("resolves stored file paths and 404s when the file is gone", async () => {
    const filePath = await fixtureFile("kept.png", 10);
    const absolute = await service.storedFileAbsolutePath("kept.png");
    expect(absolute).toBe(filePath);
    await expect(
      service.storedFileAbsolutePath("missing.png"),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("keeps stored file names inside the upload directory", () => {
    expect(service.storedFilePath("../../etc/passwd")).toBe(
      join(tmpDir, "passwd"),
    );
  });
});

describe("OptionalJwtAuthGuard", () => {
  const guard = new OptionalJwtAuthGuard();

  function contextWithHeaders(
    headers: Record<string, unknown>,
  ): Parameters<OptionalJwtAuthGuard["canActivate"]>[0] {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as never;
  }

  it("lets anonymous requests through without a token", async () => {
    await expect(guard.canActivate(contextWithHeaders({}))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(contextWithHeaders({ authorization: "" })),
    ).resolves.toBe(true);
  });
});

describe("MulterExceptionFilter", () => {
  const filter = new MulterExceptionFilter();

  function runFilter(error: MulterError): {
    status: number;
    body: Record<string, unknown>;
  } {
    let status = 0;
    let body: Record<string, unknown> = {};
    const response = {
      status(code: number) {
        status = code;
        return {
          json(payload: Record<string, unknown>) {
            body = payload;
          },
        };
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never;
    filter.catch(error, host);
    return { status, body };
  }

  it("maps LIMIT_FILE_SIZE to 413", () => {
    const result = runFilter(new MulterError("LIMIT_FILE_SIZE"));
    expect(result.status).toBe(413);
    expect(result.body.error).toBe("Payload Too Large");
  });

  it("maps other multer errors to 400", () => {
    const result = runFilter(new MulterError("LIMIT_UNEXPECTED_FILE"));
    expect(result.status).toBe(400);
  });
});

describe("works DTO validation", () => {
  it("rejects a rejection reason shorter than 10 characters", async () => {
    const dto = plainToInstance(RejectWorkSubmissionDto, { reason: "no" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an unknown work type in list queries", async () => {
    const dto = plainToInstance(ListWorksQueryDto, { type: "song" });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("works controller guards", () => {
  it("protects upload and resubmit with JwtAuthGuard", () => {
    const uploadGuards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        WorksController.prototype.createSubmission,
      ) ?? [];
    expect(uploadGuards).toContain(JwtAuthGuard);
    const resubmitGuards: unknown[] =
      Reflect.getMetadata(
        GUARDS_METADATA,
        WorksController.prototype.resubmit,
      ) ?? [];
    expect(resubmitGuards).toContain(JwtAuthGuard);
  });

  it("protects the admin queue and review actions with admin guards", () => {
    const classGuards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, AdminWorksController) ?? [];
    expect(classGuards).toContain(JwtAuthGuard);
    expect(classGuards).toContain(RolesGuard);
    const roles: unknown[] =
      Reflect.getMetadata(ROLES_METADATA_KEY, AdminWorksController) ?? [];
    expect(roles).toEqual([UserRole.Admin]);
  });
});

describe("resolveUploadsDir", () => {
  it("defaults to the uploads directory and honors an override", () => {
    expect(resolveUploadsDir(undefined)).toBe(join(process.cwd(), "uploads"));
    expect(resolveUploadsDir("  ")).toBe(join(process.cwd(), "uploads"));
    expect(resolveUploadsDir("/tmp/works")).toBe("/tmp/works");
  });
});
