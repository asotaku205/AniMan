import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "./audit-log.entity.js";
import { AuditService } from "./audit.service.js";

/**
 * Module audit log (Lat 3). Khong import AuthModule de tranh vong tron
 * phu thuoc: AuthModule import AuditModule de dang ky AuditController,
 * UsersModule va WorksModule import AuditModule de dung AuditService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
