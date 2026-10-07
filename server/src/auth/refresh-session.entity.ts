import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

@Entity({ name: "refresh_sessions" })
@Index("uq_refresh_sessions_token_hash", ["tokenHash"], { unique: true })
@Index("idx_refresh_sessions_user_id", ["userId"])
@Index("idx_refresh_sessions_family_id", ["familyId"])
export class RefreshSession {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "family_id", type: "uuid" })
  familyId: string;

  @Column({ name: "token_hash", type: "char", length: 64 })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ name: "replaced_by_id", type: "uuid", nullable: true })
  replacedById: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
