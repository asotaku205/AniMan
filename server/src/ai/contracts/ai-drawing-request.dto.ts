import {
  IsBase64,
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

// Các task nét mờ AI (stroke_guidance, composition_overlay, pose_guidance)
// đã gỡ khỏi hợp đồng ngày 28/10/2026. `scene_blueprint` còn lại trong enum
// nhưng KHÔNG CÓ client nào gọi — giữ để parser/hợp đồng cũ không vỡ.
export enum AiDrawingTask {
  CompositionGuidance = "composition_guidance",
  DrawingReview = "drawing_review",
  PageStoryFlow = "page_story_flow",
  SceneBlueprint = "scene_blueprint",
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

  /**
   * Mô tả ý tưởng của người dùng khi hình vẽ chưa rõ ràng.
   * Đây là user prompt — dùng để AI hiểu hướng gợi ý tốt hơn.
   */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(800)
  prompt?: string;

  /**
   * Ảnh chụp canvas. **Bắt buộc với mọi task trừ `page_story_flow`** (VD-1):
   * task kể chuyện cả trang có thể chạy chỉ bằng mô tả layout + ý tưởng, nên
   * thiếu ảnh là hợp lệ. Driver kiểm tra ràng buộc "bắt buộc" này theo từng task.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => AiDrawingImageDto)
  image?: AiDrawingImageDto;
}
