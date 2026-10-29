import { Module } from "@nestjs/common";
import { createObserveModule } from "@nestjs/observe";
import { AppController } from "./app.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RefreshSession } from "./auth/refresh-session.entity.js";
import { CreateAuthTables1780768800000 } from "./database/migrations/1780768800000-CreateAuthTables.js";
import { AddUserRoles1791400000000 } from "./database/migrations/1791400000000-AddUserRoles.js";
import { AddUserStatusAndMultipleAdmins1793228985000 } from "./database/migrations/1793228985000-AddUserStatusAndMultipleAdmins.js";
import { CreateWorkSubmissions1793232564000 } from "./database/migrations/1793232564000-CreateWorkSubmissions.js";
import { CreateAuditLogs1793234022000 } from "./database/migrations/1793234022000-CreateAuditLogs.js";
import { AuditLog } from "./audit/audit-log.entity.js";
import { User } from "./users/user.entity.js";
import { AuthModule } from "./auth/auth.module.js";
import { AiConsentModule } from "./ai/consent/ai-consent.module.js";
import { WorksModule } from "./works/works.module.js";
import { WorkSubmission } from "./works/work-submission.entity.js";
export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    // ObserveModule.forRoot({
    //   appKey: 'YOUR_APP_KEY',
    //   appSecret: 'YOUR_APP_SECRET',
    //   serviceId: 'server',
    // }),
    ConfigModule.forRoot({
      envFilePath: ".env",
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: configService.get<string>("DATABASE_USERNAME"),
        password: configService.get<string>("DATABASE_PASSWORD"),
        database: "animan",
        entities: [User, RefreshSession, WorkSubmission, AuditLog],
        migrations: [
          CreateAuthTables1780768800000,
          AddUserRoles1791400000000,
          AddUserStatusAndMultipleAdmins1793228985000,
          CreateWorkSubmissions1793232564000,
          CreateAuditLogs1793234022000,
        ],
        migrationsRun: false,
        synchronize: false,
      }),
    }),
    AuthModule,
    AiConsentModule,
    WorksModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
