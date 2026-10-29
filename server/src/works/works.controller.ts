import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename } from "node:path";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import type { Request, Response } from "express";
import type { PublicUser } from "../users/users.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { MulterExceptionFilter } from "./multer-exception.filter.js";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard.js";
import { CreateWorkSubmissionDto, ListWorksQueryDto } from "./works.dto.js";
import {
  WORK_FILE_MAX_BYTES,
  resolveUploadsDir,
} from "./works.constants.js";
import { WorkType } from "./work-type.enum.js";
import {
  WorksService,
  canAccessWorkFile,
  type WorkSubmissionList,
  type WorkSubmissionView,
} from "./works.service.js";

interface FileRequest extends Request {
  user: PublicUser;
}

interface OptionalAuthRequest extends Request {
  user?: PublicUser;
}

function sanitizeFileName(name: string): string {
  const base = basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_");
  return base.slice(0, 120) || "file";
}

function sendStoredFile(
  res: Response,
  absolutePath: string,
  mimeType: string,
  fileName: string,
): void {
  res.sendFile(absolutePath, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
    },
  });
}

function coverMimeType(storedName: string): string {
  const ext = storedName.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

/** Tác phẩm của user: gửi duyệt, xem danh sách, đọc file (Lát 2A). */
@Controller("works")
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "cover", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            const dir = resolveUploadsDir(process.env.UPLOADS_DIR);
            mkdirSync(dir, { recursive: true });
            cb(null, dir);
          },
          filename: (_req, file, cb) => {
            cb(null, `${randomUUID()}-${sanitizeFileName(file.originalname)}`);
          },
        }),
        // Giới hạn cứng ở mức lớn nhất (video 1GB); giới hạn theo loại
        // kiểm tra trong service để báo đúng và xóa file thừa.
        limits: {
          fileSize: WORK_FILE_MAX_BYTES[WorkType.Animation] + 1024 * 1024,
          files: 2,
        },
      },
    ),
  )
  async createSubmission(
    @Req() request: FileRequest,
    @Body() body: CreateWorkSubmissionDto,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      cover?: Express.Multer.File[];
    },
  ): Promise<WorkSubmissionView> {
    return this.worksService.createSubmission(
      request.user.id,
      {
        type: body.type,
        title: body.title,
        description: body.description,
        genre: body.genre,
        tags: body.tags,
        visibility: body.visibility,
        sourceRef: body.sourceRef,
      },
      {
        file: files.file?.[0],
        cover: files.cover?.[0],
      },
    );
  }

  @Get()
  listPublic(@Query() query: ListWorksQueryDto): Promise<WorkSubmissionList> {
    return this.worksService.listPublic({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      type: query.type,
    });
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard)
  listMine(
    @Req() request: FileRequest,
    @Query() query: ListWorksQueryDto,
  ): Promise<WorkSubmissionList> {
    return this.worksService.listMine(request.user.id, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
    });
  }

  @Patch(":id/resubmit")
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  resubmit(
    @Req() request: FileRequest,
    @Param("id") id: string,
  ): Promise<WorkSubmissionView> {
    return this.worksService.resubmit(request.user.id, id);
  }

  @Get(":id/file")
  @UseGuards(OptionalJwtAuthGuard)
  async downloadFile(
    @Req() request: OptionalAuthRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const submission = await this.worksService.findForFileAccess(id);
    if (!canAccessWorkFile(submission, request.user)) {
      res.status(403).json({
        statusCode: 403,
        message: "This work is not available.",
        error: "Forbidden",
      });
      return;
    }
    const absolute = await this.worksService.storedFileAbsolutePath(
      submission.filePath,
    );
    sendStoredFile(res, absolute, submission.mimeType, submission.fileName);
  }

  @Get(":id/cover")
  @UseGuards(OptionalJwtAuthGuard)
  async downloadCover(
    @Req() request: OptionalAuthRequest,
    @Param("id") id: string,
    @Res() res: Response,
  ): Promise<void> {
    const submission = await this.worksService.findForFileAccess(id);
    if (!submission.coverPath || !canAccessWorkFile(submission, request.user)) {
      res.status(404).json({
        statusCode: 404,
        message: "Cover not found.",
        error: "Not Found",
      });
      return;
    }
    const absolute = await this.worksService.storedFileAbsolutePath(
      submission.coverPath,
    );
    sendStoredFile(res, absolute, coverMimeType(submission.coverPath), "cover");
  }
}
