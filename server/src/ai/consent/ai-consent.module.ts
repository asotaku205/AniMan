import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../../auth/auth.module.js";
import { User } from "../../users/user.entity.js";
import { AiDrawingConsentController } from "./ai-drawing-consent.controller.js";
import { AiDrawingConsentService } from "./ai-drawing-consent.service.js";

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [AiDrawingConsentController],
  providers: [AiDrawingConsentService],
  exports: [AiDrawingConsentService],
})
export class AiConsentModule {}
