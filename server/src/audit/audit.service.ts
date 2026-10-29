import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { type EntityManager, Repository } from "typeorm";
import { AuditAction } from "./audit-action.enum.js";
import { AuditLog } from "./audit-log.entity.js";

/** Nguoi thuc hien hanh dong can ghi log: id va ten dang nhap. */
export interface AuditActor {
  id: string;
  username: string;
}

export interface AuditRecordInput {
  actor: AuditActor;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetLabel: string;
  detail: Record<string, unknown>;
  ip?: string | null;
}

export interface ListAuditLogsInput {
  page: number;
  pageSize: number;
  actor?: string;
  action?: AuditAction;
  search?: string;
}

export interface AuditLogView {
  id: string;
  actorId: string;
  actorUsername: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  targetLabel: string;
  detail: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogList {
  items: AuditLogView[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Dich vu audit log (Lat 3).
 *
 * record() nhan EntityManager cua giao dich dang chay, nen dong log ghi
 * trong cung giao dich voi hanh dong: ghi log that bai thi hanh dong
 * cung that bai, khong bao gio co hanh dong ma mat dau vet.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async record(
    manager: EntityManager,
    input: AuditRecordInput,
  ): Promise<AuditLog> {
    const repository = manager.getRepository(AuditLog);
    const row = repository.create({
      id: randomUUID(),
      actorId: input.actor.id,
      actorUsername: input.actor.username,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      detail: input.detail,
      ip: input.ip ?? null,
    });
    return repository.save(row);
  }

  /**
   * Danh sach log cho trang Admin. Tim kiem khong phan biet hoa thuong
   * tren ten nguoi lam va nhan doi tuong; loc actor theo ten dang nhap,
   * loc action theo dung gia tri enum. Moi nhat truoc.
   */
  async listAuditLogs(input: ListAuditLogsInput): Promise<AuditLogList> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize) || 20));
    const query = this.auditRepository.createQueryBuilder("log");
    const search = input.search?.trim();
    if (search) {
      query.andWhere(
        "(log.actorUsername ILIKE :search OR log.targetLabel ILIKE :search)",
        { search: `%${search}%` },
      );
    }
    if (input.actor?.trim()) {
      query.andWhere("log.actorUsername ILIKE :actor", {
        actor: `%${input.actor.trim()}%`,
      });
    }
    if (input.action) {
      query.andWhere("log.action = :action", { action: input.action });
    }
    query
      .orderBy("log.createdAt", "DESC")
      .addOrderBy("log.id", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [rows, total] = await query.getManyAndCount();
    return {
      items: rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize,
    };
  }

  toView(row: AuditLog): AuditLogView {
    return {
      id: row.id,
      actorId: row.actorId,
      actorUsername: row.actorUsername,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      targetLabel: row.targetLabel,
      detail: row.detail ?? {},
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
