import {
  ArrayMaxSize,
  IsArray,
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
import { MAX_REFERENCE_SKETCH_BYTES } from "./reference-image.constants.js";

export enum ReferenceImageSource {
  Prompt = "prompt",
  DrawingPrompt = "drawing-prompt",
}

/** Khớp `SceneType` phía client (`data.tsx`): auto/action/dialogue/landscape/closeup/wide. */
export enum ReferenceImageSceneType {
  Auto = "auto",
  Action = "action",
  Dialogue = "dialogue",
  Landscape = "landscape",
  Closeup = "closeup",
  Wide = "wide",
}

const MAX_SKETCH_BASE64_LENGTH = Math.ceil(MAX_REFERENCE_SKETCH_BYTES / 3) * 4;

export class ReferenceImageSketchDto {
  @IsString()
  @IsBase64()
  @MaxLength(MAX_SKETCH_BASE64_LENGTH)
  data: string;

  @IsEnum(["image/png", "image/jpeg"])
  mimeType: "image/png" | "image/jpeg";

  /** Phác thảo client đã thu nhỏ: mỗi cạnh tối đa 500 px, dưới giới hạn 512 px của klein. */
  @IsInt()
  @Min(1)
  @Max(512)
  width: number;

  @IsInt()
  @Min(1)
  @Max(512)
  height: number;
}

export class CreateReferenceImageJobDto {
  @IsEnum(ReferenceImageSource)
  source: ReferenceImageSource;

  @IsEnum(ReferenceImageSceneType)
  sceneType: ReferenceImageSceneType;

  /** Mô tả ý tưởng người dùng tự gõ. Bắt buộc khi nguồn là chỉ prompt. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(800)
  prompt?: string;

  /** Gợi ý sửa từ drawing_review gần nhất, mỗi mục tối đa 200 ký tự. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  fixHints?: string[];

  /**
   * Kích thước backing (pixel thật) của đúng khung đang vẽ, để server
   * tính kích thước đầu ra theo đúng tỉ lệ khung đó. Không có thì
   * server giữ 1024x1024 như trước (client cũ).
   */
  @IsOptional()
  @IsInt()
  @Min(32)
  @Max(4096)
  panelWidth?: number;

  /** Kích thước backing (pixel thật) của đúng khung đang vẽ. */
  @IsOptional()
  @IsInt()
  @Min(32)
  @Max(4096)
  panelHeight?: number;

  /**
   * Ghi chú sửa của người dùng về ảnh trước đó khi model hiểu sai:
   * ảnh sai chỗ nào, tối đa 300 ký tự. Server giữ nguyên văn trong
   * khối cuối prompt. Không có hoặc trắng thì bỏ hẳn.
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  correction?: string;

  /** Phác thảo đã thu nhỏ. Bắt buộc khi nguồn có bức vẽ. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ReferenceImageSketchDto)
  image?: ReferenceImageSketchDto;
}
