import {
  IsBase64,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum AiDrawingTask {
  CompositionGuidance = "composition_guidance",
  DrawingReview = "drawing_review",
}

export enum AiDrawingImageMimeType {
  Jpeg = "image/jpeg",
  Png = "image/png",
  Webp = "image/webp",
}

export const MAX_AI_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_AI_IMAGE_BASE64_LENGTH = Math.ceil(MAX_AI_IMAGE_BYTES / 3) * 4;

export class AiDrawingImageDto {
  @IsString()
  @IsBase64()
  @MaxLength(MAX_AI_IMAGE_BASE64_LENGTH)
  data: string;

  @IsEnum(AiDrawingImageMimeType)
  mimeType: AiDrawingImageMimeType;

  @IsInt()
  @Min(256)
  @Max(4096)
  width: number;

  @IsInt()
  @Min(256)
  @Max(4096)
  height: number;
}

export class AiDrawingRequestDto {
  @IsEnum(AiDrawingTask)
  task: AiDrawingTask;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(800)
  prompt?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AiDrawingImageDto)
  image: AiDrawingImageDto;
}
