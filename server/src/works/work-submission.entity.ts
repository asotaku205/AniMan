import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/user.entity.js";
import { WorkStatus } from "./work-status.enum.js";
import { WorkType } from "./work-type.enum.js";
import { WorkVisibility } from "./work-visibility.enum.js";

export interface WorkSourceRef {
  kind: "manga" | "anim" | "novel";
  id: string;
  label: string;
}

@Entity({ name: "work_submissions" })
@Index("idx_work_submissions_status_created", ["status", "createdAt"])
export class WorkSubmission {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ name: "author_id", type: "uuid" })
  authorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "author_id" })
  author: User;

  @Column({ type: "text" })
  type: WorkType;

  @Column({ type: "text" })
  title: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Column({ type: "text", default: "" })
  genre: string;

  @Column("text", { array: true, default: () => "'{}'" })
  tags: string[];

  @Column({ type: "text" })
  visibility: WorkVisibility;

  @Column({ name: "cover_path", type: "text", nullable: true })
  coverPath: string | null;

  @Column({ name: "file_name", type: "text" })
  fileName: string;

  @Column({ name: "file_size", type: "integer" })
  fileSize: number;

  @Column({ name: "file_path", type: "text" })
  filePath: string;

  @Column({ name: "mime_type", type: "text" })
  mimeType: string;

  @Column({ name: "source_ref", type: "jsonb", nullable: true })
  sourceRef: WorkSourceRef | null;

  @Column({ type: "text", default: WorkStatus.Pending })
  status: WorkStatus;

  @Column({ name: "reject_reason", type: "text", nullable: true })
  rejectReason: string | null;

  @Column({ name: "reviewed_by_id", type: "uuid", nullable: true })
  reviewedById: string | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
