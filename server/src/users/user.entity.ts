import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole } from "./user-role.enum.js";
import { UserStatus } from "./user-status.enum.js";

@Entity({ name: "users" })
@Index("uq_users_username", ["username"], { unique: true })
export class User {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ type: "text" })
  username: string;

  @Column({ name: "display_name", type: "text" })
  displayName: string;

  @Column({ name: "password_hash", type: "text" })
  passwordHash: string;

  @Column({ type: "text", default: UserRole.User })
  role: UserRole;

  /** Trạng thái tài khoản (Lát 2): active là mặc định, suspended là bị khóa tạm thời, mở lại được. */
  @Column({ type: "text", default: UserStatus.Active })
  status: UserStatus;

  @Column({ name: "terms_accepted_at", type: "timestamptz" })
  termsAcceptedAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
