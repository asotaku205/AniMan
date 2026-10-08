import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../../auth/auth.module.js";
import { User } from "../../users/user.entity.js";
import { AiDrawingRateLimiter } from "../ai-drawing-rate-limiter.service.js";
import { AiDrawingModule } from "../ai-drawing.module.js";
import {
  AiDrawingProviderError,
  GEMINI_DRAWING_MODEL_PROFILE,
} from "../driver/ai-drawing-driver.js";
import { AiDrawingController } from "./ai-drawing.controller.js";
import { AiDrawingConsentController } from "./ai-drawing-consent.controller.js";
import { AiDrawingConsentService } from "./ai-drawing-consent.service.js";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User]),
    AiDrawingModule.register({
      profile: GEMINI_DRAWING_MODEL_PROFILE,
      provider: {
        generate: async () => {
          throw new AiDrawingProviderError(
            "AI drawing provider is not configured",
          );
        },
      },
    }),
  ],
  controllers: [AiDrawingConsentController, AiDrawingController],
  providers: [AiDrawingConsentService, AiDrawingRateLimiter],
  exports: [AiDrawingConsentService],
})
export class AiConsentModule {}
