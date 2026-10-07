import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole } from "./user-role.enum.js";

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

  @Column({ name: "terms_accepted_at", type: "timestamptz" })
  termsAcceptedAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
