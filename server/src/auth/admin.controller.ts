import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { AdminUserList, PublicUser } from "../users/users.service.js";
import { UsersService } from "../users/users.service.js";
import { UserRole } from "../users/user-role.enum.js";
import {
  ChangeAdminUserRoleDto,
  ChangeAdminUserStatusDto,
  ListAdminUsersQueryDto,
} from "./admin-users.dto.js";
import { Roles } from "./decorators/roles.decorator.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

/** Quản lý user cho trang Admin (Lát 2). Mọi route chỉ dành cho admin. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  getAdminProfile(@Req() request: AuthenticatedRequest): PublicUser {
    return request.user;
  }

  @Get("users")
  listUsers(@Query() query: ListAdminUsersQueryDto): Promise<AdminUserList> {
    return this.usersService.listUsers({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      q: query.q,
      role: query.role,
      status: query.status,
    });
  }

  @Patch("users/:id/role")
  changeUserRole(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: ChangeAdminUserRoleDto,
  ): Promise<PublicUser> {
    return this.usersService.changeRole(
      { id: request.user.id, username: request.user.username },
      id,
      body.role,
      request.ip ?? null,
    );
  }

  @Patch("users/:id/status")
  changeUserStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: ChangeAdminUserStatusDto,
  ): Promise<PublicUser> {
    return this.usersService.changeStatus(
      { id: request.user.id, username: request.user.username },
      id,
      body.status,
      request.ip ?? null,
    );
  }
}
