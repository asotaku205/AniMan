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
import { TranslationController } from "../translation/translation.controller.js";
import { TranslationService } from "../translation/translation.service.js";
import { NovelAiController } from "../novel/novel-ai.controller.js";
import { NovelAiService } from "../novel/novel-ai.service.js";

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User]),
    AiDrawingModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredModel = config.get<string>("GEMINI_MODEL_ID");
        const profile = configuredModel
          ? { ...GEMINI_DRAWING_MODEL_PROFILE, modelId: configuredModel }
          : GEMINI_DRAWING_MODEL_PROFILE;

        return {
          profile,
          provider: createGeminiDrawingProvider(
            config.getOrThrow<string>("GEMINI_API_KEY"),
          ),
        };
      },
    }),
  ],
  controllers: [AiDrawingConsentController, AiDrawingController, TranslationController, NovelAiController],
  providers: [
    AiDrawingConsentService,
    AiDrawingRateLimiter,
    {
      provide: TranslationService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new TranslationService(
          config.getOrThrow<string>("GEMINI_API_KEY"),
          config.get<string>("GEMINI_MODEL_ID"),
        ),
    },
    {
      provide: NovelAiService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new NovelAiService(
          config.getOrThrow<string>("GEMINI_API_KEY"),
          config.get<string>("GEMINI_MODEL_ID"),
        ),
    },
  ],
  exports: [AiDrawingConsentService],
})
export class AiConsentModule {}
