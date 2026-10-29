import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";
import { AuditAction } from "./audit-action.enum.js";

/**
 * Mot dong nhat ky kiem tra (Lat 3). Chi doc: khong co API sua hay xoa.
 *
 * detail luu gia tri truoc va sau cua hanh dong (vai tro cu/moi, trang
 * thai cu/moi, ly do tu choi). Khong bao gio luu mat khau hay token.
 */
@Entity({ name: "audit_logs" })
@Index("idx_audit_logs_created", ["createdAt"])
@Index("idx_audit_logs_actor", ["actorId"])
@Index("idx_audit_logs_action", ["action"])
export class AuditLog {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ name: "actor_id", type: "uuid" })
  actorId: string;

  @Column({ name: "actor_username", type: "text" })
  actorUsername: string;

  @Column({ type: "text" })
  action: AuditAction;

  @Column({ name: "target_type", type: "text" })
  targetType: string;

  @Column({ name: "target_id", type: "text" })
  targetId: string;

  @Column({ name: "target_label", type: "text" })
  targetLabel: string;

  @Column({ type: "jsonb", default: () => "'{}'" })
  detail: Record<string, unknown>;

  @Column({ type: "text", nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
