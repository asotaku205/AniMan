import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "../audit/audit.module.js";
import { getJwtAccessSecret } from "../auth/auth.config.js";
import { User } from "../users/user.entity.js";
import { MaintenanceGuard } from "./maintenance.guard.js";
import { SettingsService } from "./settings.service.js";
import { SiteSetting } from "./site-setting.entity.js";
import { SiteStatusController } from "./site-status.controller.js";

/**
 * Module cai dat he thong (Lat 4). Khong import AuthModule de tranh
 * vong tron: AuthModule import SettingsModule (cua dang ky + controller
 * admin), SettingsModule chi import AuditModule, TypeOrm va Jwt.
 *
 * JwtModule dang ky rieng o day chi de MaintenanceGuard kiem chung token:
 * payload token chi co `sub`, guard tu tra cuu vai tro admin tu DB.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SiteSetting, User]),
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtAccessSecret(configService),
      }),
    }),
  ],
  controllers: [SiteStatusController],
  providers: [
    SettingsService,
    { provide: APP_GUARD, useClass: MaintenanceGuard },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
