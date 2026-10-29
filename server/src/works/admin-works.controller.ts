import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { PublicUser } from "../users/users.service.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../users/user-role.enum.js";
import { ListWorksQueryDto, RejectWorkSubmissionDto } from "./works.dto.js";
import {
  WorksService,
  type WorkSubmissionList,
  type WorkSubmissionView,
} from "./works.service.js";

interface AdminRequest extends Request {
  user: PublicUser;
}

export interface AdminWorkQueueResponse extends WorkSubmissionList {
  counts: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

/** Hàng đợi duyệt tác phẩm của admin (Lát 2A). */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminWorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get("works")
  async listReviewQueue(
    @Query() query: ListWorksQueryDto,
  ): Promise<AdminWorkQueueResponse> {
    const [list, counts] = await Promise.all([
      this.worksService.listReviewQueue({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        type: query.type,
        status: query.status,
      }),
      this.worksService.reviewCounts(),
    ]);
    return { ...list, counts };
  }

  @Patch("works/:id/approve")
  @HttpCode(200)
  approve(
    @Req() request: AdminRequest,
    @Param("id") id: string,
  ): Promise<WorkSubmissionView> {
    return this.worksService.reviewSubmission(
      request.user.id,
      id,
      "approve",
    );
  }

  @Patch("works/:id/reject")
  @HttpCode(200)
  reject(
    @Req() request: AdminRequest,
    @Param("id") id: string,
    @Body() body: RejectWorkSubmissionDto,
  ): Promise<WorkSubmissionView> {
    return this.worksService.reviewSubmission(
      request.user.id,
      id,
      "reject",
      body.reason,
    );
  }
}
