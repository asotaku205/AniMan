import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../../auth/auth.module.js";
import { User } from "../../users/user.entity.js";
import { AiDrawingRateLimiter } from "../ai-drawing-rate-limiter.service.js";
import { AiDrawingModule } from "../ai-drawing.module.js";
import { GEMINI_DRAWING_MODEL_PROFILE } from "../driver/ai-drawing-driver.js";
import { createGeminiDrawingProvider } from "../driver/gemini-drawing-provider.js";
import { AiDrawingController } from "./ai-drawing.controller.js";
import { AiDrawingConsentController } from "./ai-drawing-consent.controller.js";
import { AiDrawingConsentService } from "./ai-drawing-consent.service.js";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User]),
    AiDrawingModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        profile: GEMINI_DRAWING_MODEL_PROFILE,
        provider: createGeminiDrawingProvider(
          config.getOrThrow<string>("GEMINI_API_KEY"),
        ),
      }),
    }),
  ],
  controllers: [AiDrawingConsentController, AiDrawingController],
  providers: [AiDrawingConsentService, AiDrawingRateLimiter],
  exports: [AiDrawingConsentService],
})
export class AiConsentModule {}
