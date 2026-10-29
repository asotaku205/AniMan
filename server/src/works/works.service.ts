import { randomUUID } from "node:crypto";
import { stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserRole } from "../users/user-role.enum.js";
import type { PublicUser } from "../users/users.service.js";
import { WorkStatus } from "./work-status.enum.js";
import { WorkType } from "./work-type.enum.js";
import { WorkVisibility } from "./work-visibility.enum.js";
import {
  COVER_MAX_BYTES,
  WORK_FILE_MAX_BYTES,
  resolveUploadsDir,
} from "./works.constants.js";
import {
  WorkSubmission,
  type WorkSourceRef,
} from "./work-submission.entity.js";

export interface StoredUploadFile {
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
  path: string;
}

export interface CreateSubmissionInput {
  type: WorkType;
  title: string;
  description?: string;
  genre?: string;
  /** Chuỗi JSON từ multipart, hoặc mảng đã tách sẵn. */
  tags?: unknown;
  visibility: WorkVisibility;
  /** Chuỗi JSON từ multipart, hoặc object đã tách sẵn. */
  sourceRef?: unknown;
}

export interface SubmissionAuthorView {
  id: string;
  username: string;
  displayName: string;
}

export interface WorkSubmissionView {
  id: string;
  author: SubmissionAuthorView;
  type: WorkType;
  title: string;
  description: string;
  genre: string;
  tags: string[];
  visibility: WorkVisibility;
  status: WorkStatus;
  rejectReason: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sourceRef: WorkSourceRef | null;
  coverUrl: string | null;
  fileUrl: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSubmissionList {
  items: WorkSubmissionView[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListWorksInput {
  page: number;
  pageSize: number;
  type?: WorkType;
  status?: WorkStatus;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const NOVEL_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "m4v"]);
const NOVEL_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

/**
 * File tác phẩm có đúng loại cho phép không. Kiểm tra đuôi file trước
 * (trình duyệt gửi mime không ổn định), rồi rơi về mime type.
 */
export function isAllowedWorkFile(
  type: WorkType,
  mimetype: string,
  originalname: string,
): boolean {
  const ext = fileExtension(originalname);
  const mime = mimetype.toLowerCase();
  switch (type) {
    case WorkType.Manga:
      return (
        IMAGE_EXTENSIONS.has(ext) ||
        ext === "cbz" ||
        ext === "zip" ||
        mime.startsWith("image/") ||
        mime === "application/zip" ||
        mime === "application/x-cbz"
      );
    case WorkType.Fanart:
      return IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/");
    case WorkType.Novel:
      return NOVEL_EXTENSIONS.has(ext) || NOVEL_MIME_TYPES.has(mime);
    case WorkType.Animation:
      return VIDEO_EXTENSIONS.has(ext) || mime.startsWith("video/");
  }
}

/**
 * Chuyển chuỗi tags từ multipart thành mảng. Client gửi 1 chuỗi JSON;
 * mảng đã tách sẵn cũng chấp nhận để test và client cũ không vỡ.
 */
export function parseTags(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  let values: unknown;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      values = JSON.parse(trimmed) as unknown;
    } catch {
      values = trimmed
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  } else {
    values = raw;
  }
  if (!Array.isArray(values)) {
    throw new BadRequestException("Tags must be a JSON array of strings.");
  }
  const tags = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().replace(/^#/, ""))
    .filter(Boolean);
  const unique = [...new Set(tags)];
  if (unique.length > 10) {
    throw new BadRequestException("At most 10 tags are allowed.");
  }
  if (unique.some((tag) => tag.length > 30)) {
    throw new BadRequestException("Each tag must be at most 30 characters.");
  }
  return unique;
}

export function parseSourceRef(raw: unknown): WorkSourceRef | null {
  if (raw === undefined || raw === null || raw === "") return null;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException("Source reference must be valid JSON.");
    }
  }
  if (typeof value !== "object" || value === null) {
    throw new BadRequestException("Source reference must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (
    record.kind !== "manga" &&
    record.kind !== "anim" &&
    record.kind !== "novel"
  ) {
    throw new BadRequestException("Source reference kind is invalid.");
  }
  if (typeof record.id !== "string" || !record.id) {
    throw new BadRequestException("Source reference id is required.");
  }
  if (typeof record.label !== "string" || !record.label) {
    throw new BadRequestException("Source reference label is required.");
  }
  return {
    kind: record.kind,
    id: record.id,
    label: record.label,
  };
}

/**
 * Ai được đọc file/ảnh bìa của một tác phẩm. Admin và tác giả luôn được.
 * Người khác chỉ đọc được tác phẩm đã duyệt ở chế độ công khai, hoặc
 * chế độ có link (mở bằng link trực tiếp). Tác phẩm chờ duyệt, bị từ
 * chối, hoặc riêng tư thì người ngoài không đọc được.
 */
export function canAccessWorkFile(
  submission: Pick<
    WorkSubmission,
    "authorId" | "status" | "visibility"
  >,
  viewer: Pick<PublicUser, "id" | "role"> | undefined,
): boolean {
  if (viewer?.role === UserRole.Admin) return true;
  if (viewer && viewer.id === submission.authorId) return true;
  if (submission.status !== WorkStatus.Approved) return false;
  return (
    submission.visibility === WorkVisibility.Public ||
    submission.visibility === WorkVisibility.Unlisted
  );
}

function toAuthorView(author: WorkSubmission["author"]): SubmissionAuthorView {
  return {
    id: author.id,
    username: author.username,
    displayName: author.displayName,
  };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(WorkSubmission)
    private readonly submissionsRepository: Repository<WorkSubmission>,
    configService: ConfigService,
  ) {
    this.uploadDir = resolveUploadsDir(
      configService.get<string>("UPLOADS_DIR"),
    );
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  /** Đường dẫn tuyệt đối của file đã lưu, chặn leo thư mục. */
  storedFilePath(storedName: string): string {
    return join(this.uploadDir, basename(storedName));
  }

  async createSubmission(
    authorId: string,
    input: CreateSubmissionInput,
    files: { file?: StoredUploadFile; cover?: StoredUploadFile },
  ): Promise<WorkSubmissionView> {
    const stored = [files.file, files.cover].filter(
      (file): file is StoredUploadFile => file !== undefined,
    );
    try {
      if (!files.file) {
        throw new BadRequestException("Work file is required.");
      }
      const title = input.title?.trim() ?? "";
      if (!title) {
        throw new BadRequestException("Title is required.");
      }
      if (title.length > 200) {
        throw new BadRequestException("Title must be at most 200 characters.");
      }
      const description = input.description?.trim() ?? "";
      if (description.length > 5000) {
        throw new BadRequestException(
          "Description must be at most 5000 characters.",
        );
      }
      const genre = input.genre?.trim() ?? "";
      if (genre.length > 100) {
        throw new BadRequestException("Genre must be at most 100 characters.");
      }
      // Tách tags/sourceRef trong khối try để lỗi vẫn xóa file đã lên đĩa.
      const tags = parseTags(input.tags);
      const sourceRef = parseSourceRef(input.sourceRef);
      if (tags.length > 10 || tags.some((tag) => tag.length > 30)) {
        throw new BadRequestException("Tags are invalid.");
      }
      const maxFileBytes = WORK_FILE_MAX_BYTES[input.type];
      if (files.file.size > maxFileBytes) {
        throw new PayloadTooLargeException(
          `Work file exceeds the limit for ${input.type}.`,
        );
      }
      if (
        !isAllowedWorkFile(input.type, files.file.mimetype, files.file.originalname)
      ) {
        throw new BadRequestException("Work file type is not allowed.");
      }
      if (files.cover) {
        if (files.cover.size > COVER_MAX_BYTES) {
          throw new PayloadTooLargeException("Cover image exceeds 5MB.");
        }
        if (!files.cover.mimetype.toLowerCase().startsWith("image/")) {
          throw new BadRequestException("Cover must be an image.");
        }
      }

      const created = this.submissionsRepository.create({
        id: randomUUID(),
        authorId,
        type: input.type,
        title,
        description,
        genre,
        tags,
        visibility: input.visibility,
        coverPath: files.cover ? files.cover.filename : null,
        fileName: files.file.originalname,
        fileSize: files.file.size,
        filePath: files.file.filename,
        mimeType: files.file.mimetype,
        sourceRef,
        status: WorkStatus.Pending,
        rejectReason: null,
        reviewedById: null,
        reviewedAt: null,
      });
      const saved = await this.submissionsRepository.save(created);
      const full = await this.submissionsRepository.findOne({
        where: { id: saved.id },
        relations: { author: true },
      });
      if (!full) {
        throw new NotFoundException("Submission not found after saving.");
      }
      return this.toView(full);
    } catch (error) {
      await Promise.all(stored.map((file) => this.removeQuietly(file.path)));
      throw error;
    }
  }

  async listPublic(input: ListWorksInput): Promise<WorkSubmissionList> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize) || 20));
    const where: Record<string, unknown> = {
      status: WorkStatus.Approved,
      visibility: WorkVisibility.Public,
    };
    if (input.type) where.type = input.type;
    const [items, total] = await Promise.all([
      this.submissionsRepository.find({
        where: where as never,
        relations: { author: true },
        order: { createdAt: "DESC", id: "ASC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.submissionsRepository.count({ where: where as never }),
    ]);
    return { items: items.map((item) => this.toView(item)), total, page, pageSize };
  }

  async listMine(
    authorId: string,
    input: ListWorksInput,
  ): Promise<WorkSubmissionList> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize) || 20));
    const where: Record<string, unknown> = { authorId };
    if (input.status) where.status = input.status;
    const [items, total] = await Promise.all([
      this.submissionsRepository.find({
        where: where as never,
        relations: { author: true },
        order: { createdAt: "DESC", id: "ASC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.submissionsRepository.count({ where: where as never }),
    ]);
    return { items: items.map((item) => this.toView(item)), total, page, pageSize };
  }

  async listReviewQueue(input: ListWorksInput): Promise<WorkSubmissionList> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize) || 20));
    const where: Record<string, unknown> = {
      status: input.status ?? WorkStatus.Pending,
    };
    if (input.type) where.type = input.type;
    const [items, total] = await Promise.all([
      this.submissionsRepository.find({
        where: where as never,
        relations: { author: true },
        order: { createdAt: "DESC", id: "ASC" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.submissionsRepository.count({ where: where as never }),
    ]);
    return { items: items.map((item) => this.toView(item)), total, page, pageSize };
  }

  async reviewCounts(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  }> {
    const [pending, approved, rejected, total] = await Promise.all([
      this.submissionsRepository.count({
        where: { status: WorkStatus.Pending },
      }),
      this.submissionsRepository.count({
        where: { status: WorkStatus.Approved },
      }),
      this.submissionsRepository.count({
        where: { status: WorkStatus.Rejected },
      }),
      this.submissionsRepository.count(),
    ]);
    return { pending, approved, rejected, total };
  }

  async reviewSubmission(
    reviewerId: string,
    id: string,
    decision: "approve" | "reject",
    reason?: string,
  ): Promise<WorkSubmissionView> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found.");
    }
    if (submission.status !== WorkStatus.Pending) {
      throw new ConflictException("Only pending submissions can be reviewed.");
    }
    if (decision === "reject") {
      const cleanReason = reason?.trim() ?? "";
      if (cleanReason.length < 10) {
        throw new BadRequestException(
          "Rejection reason must be at least 10 characters.",
        );
      }
      submission.status = WorkStatus.Rejected;
      submission.rejectReason = cleanReason;
    } else {
      submission.status = WorkStatus.Approved;
      submission.rejectReason = null;
    }
    submission.reviewedById = reviewerId;
    submission.reviewedAt = new Date();
    const saved = await this.submissionsRepository.save(submission);
    this.logger.log(
      `Admin ${reviewerId} ${decision}d submission ${id} by ${submission.authorId}`,
    );
    return this.toView(saved);
  }

  async resubmit(authorId: string, id: string): Promise<WorkSubmissionView> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found.");
    }
    if (submission.authorId !== authorId) {
      throw new ForbiddenException("Only the author can resubmit.");
    }
    if (submission.status !== WorkStatus.Rejected) {
      throw new ConflictException("Only rejected submissions can be resubmitted.");
    }
    submission.status = WorkStatus.Pending;
    submission.rejectReason = null;
    submission.reviewedById = null;
    submission.reviewedAt = null;
    const saved = await this.submissionsRepository.save(submission);
    return this.toView(saved);
  }

  /** Tác phẩm dùng cho endpoint file/cover, kèm kiểm tra tồn tại. */
  async findForFileAccess(id: string): Promise<WorkSubmission> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: { author: true },
    });
    if (!submission) {
      throw new NotFoundException("Submission not found.");
    }
    return submission;
  }

  /** Đường dẫn tuyệt đối của file đã lưu, lỗi 404 nếu file mất khỏi đĩa. */
  async storedFileAbsolutePath(storedName: string): Promise<string> {
    const absolute = this.storedFilePath(storedName);
    try {
      await stat(absolute);
    } catch {
      throw new NotFoundException("File not found on server.");
    }
    return absolute;
  }

  private toView(submission: WorkSubmission): WorkSubmissionView {
    return {
      id: submission.id,
      author: toAuthorView(submission.author),
      type: submission.type,
      title: submission.title,
      description: submission.description,
      genre: submission.genre,
      tags: submission.tags ?? [],
      visibility: submission.visibility,
      status: submission.status,
      rejectReason: submission.rejectReason,
      fileName: submission.fileName,
      fileSize: submission.fileSize,
      mimeType: submission.mimeType,
      sourceRef: submission.sourceRef,
      coverUrl: submission.coverPath
        ? `/works/${submission.id}/cover`
        : null,
      fileUrl: `/works/${submission.id}/file`,
      reviewedAt: submission.reviewedAt
        ? iso(submission.reviewedAt)
        : null,
      createdAt: iso(submission.createdAt),
      updatedAt: iso(submission.updatedAt),
    };
  }

  private async removeQuietly(absolutePath: string): Promise<void> {
    try {
      await unlink(absolutePath);
    } catch {
      // File chưa kịp ghi hoặc đã xóa rồi: không chặn lỗi gốc.
    }
  }
}
