import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService, type AuditLogList } from "./audit.service.js";
import { ListAuditLogsQueryDto } from "./audit.dto.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../users/user-role.enum.js";

/**
 * Nhat ky kiem tra cho trang Admin (Lat 3). Chi doc: khong co endpoint
 * sua hay xoa dong log.
 */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("audit-logs")
  listAuditLogs(@Query() query: ListAuditLogsQueryDto): Promise<AuditLogList> {
    return this.auditService.listAuditLogs({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      actor: query.actor,
      action: query.action,
      search: query.search,
    });
  }
}
