import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";
import { UserRole } from "../users/user-role.enum.js";
import { UserStatus } from "../users/user-status.enum.js";

/** Tham số lọc và phân trang của GET /admin/users (Lát 2). */
export class ListAdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class ChangeAdminUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

export class ChangeAdminUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
