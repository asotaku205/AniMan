import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "../users/users.module.js";
import { RefreshSession } from "./refresh-session.entity.js";
import { RefreshSessionsService } from "./refresh-sessions.service.js";
import {
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  getJwtAccessSecret,
} from "./auth.config.js";
import { AuthController } from "./auth.controller.js";
import { AdminController } from "./admin.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { LocalAuthGuard } from "./guards/local-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";
import { LocalStrategy } from "./strategies/local.strategy.js";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshSession]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: getJwtAccessSecret(configService),
        signOptions: { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    RefreshSessionsService,
    LocalStrategy,
    JwtStrategy,
    LocalAuthGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
