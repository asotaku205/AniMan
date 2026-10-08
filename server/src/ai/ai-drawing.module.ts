import { DynamicModule, Module } from "@nestjs/common";
import {
  AI_DRAWING_MODEL_PROFILE,
  AI_DRAWING_PROVIDER,
  AiDrawingModelProfile,
  AiDrawingProvider,
} from "./driver/ai-drawing-driver.js";
import { AiDrawingDriver } from "./driver/ai-drawing-driver.service.js";
import { AiDrawingPromptService } from "./prompts/ai-drawing-prompt.service.js";

export interface AiDrawingModuleOptions {
  profile: AiDrawingModelProfile;
  provider: AiDrawingProvider;
}

@Module({})
export class AiDrawingModule {
  static register(options: AiDrawingModuleOptions): DynamicModule {
    return {
      module: AiDrawingModule,
      providers: [
        AiDrawingDriver,
        AiDrawingPromptService,
        { provide: AI_DRAWING_MODEL_PROFILE, useValue: options.profile },
        { provide: AI_DRAWING_PROVIDER, useValue: options.provider },
      ],
      exports: [AiDrawingDriver],
    };
  }
}
