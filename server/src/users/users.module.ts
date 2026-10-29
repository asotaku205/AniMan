import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "../audit/audit.module.js";
import { User } from "./user.entity.js";
import { UsersService } from "./users.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
