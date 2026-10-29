import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { WorkStatus } from "./work-status.enum.js";
import { WorkType } from "./work-type.enum.js";
import { WorkVisibility } from "./work-visibility.enum.js";

/**
 * Trường text của form multipart POST /works. Multer gửi mọi trường
 * dạng chuỗi; tags và sourceRef là chuỗi JSON, service tách sau.
 */
export class CreateWorkSubmissionDto {
  @IsEnum(WorkType)
  type: WorkType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  genre?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsEnum(WorkVisibility)
  visibility: WorkVisibility;

  @IsOptional()
  @IsString()
  sourceRef?: string;
}

export class ListWorksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsEnum(WorkType)
  type?: WorkType;

  @IsOptional()
  @IsEnum(WorkStatus)
  status?: WorkStatus;
}

export class RejectWorkSubmissionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;
}
