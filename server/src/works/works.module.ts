import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module.js";
import { User } from "../users/user.entity.js";
import { AdminWorksController } from "./admin-works.controller.js";
import { OptionalJwtAuthGuard } from "./optional-jwt-auth.guard.js";
import { WorkSubmission } from "./work-submission.entity.js";
import { WorksController } from "./works.controller.js";
import { WorksService } from "./works.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([WorkSubmission, User]), AuthModule],
  controllers: [WorksController, AdminWorksController],
  providers: [WorksService, OptionalJwtAuthGuard],
  exports: [WorksService],
})
export class WorksModule {}
