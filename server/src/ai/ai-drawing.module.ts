import { DynamicModule, FactoryProvider, Module } from "@nestjs/common";
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

export interface AiDrawingModuleAsyncOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory: (...args: any[]) => AiDrawingModuleOptions | Promise<AiDrawingModuleOptions>;
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

  static registerAsync(options: AiDrawingModuleAsyncOptions): DynamicModule {
    const optionsProvider: FactoryProvider<AiDrawingModuleOptions> = {
      provide: "AI_DRAWING_MODULE_OPTIONS",
      inject: options.inject ?? [],
      useFactory: options.useFactory,
    };

    const profileProvider: FactoryProvider<AiDrawingModelProfile> = {
      provide: AI_DRAWING_MODEL_PROFILE,
      inject: ["AI_DRAWING_MODULE_OPTIONS"],
      useFactory: (opts: AiDrawingModuleOptions) => opts.profile,
    };

    const providerProvider: FactoryProvider<AiDrawingProvider> = {
      provide: AI_DRAWING_PROVIDER,
      inject: ["AI_DRAWING_MODULE_OPTIONS"],
      useFactory: (opts: AiDrawingModuleOptions) => opts.provider,
    };

    return {
      module: AiDrawingModule,
      providers: [
        optionsProvider,
        profileProvider,
        providerProvider,
        AiDrawingDriver,
        AiDrawingPromptService,
      ],
      exports: [AiDrawingDriver],
    };
  }
}
