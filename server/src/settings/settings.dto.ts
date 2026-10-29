import { IsBoolean, IsOptional } from "class-validator";

/**
 * Body PATCH /admin/settings (Lat 4). Chi 2 khoa duoc chap nhan, ca 2
 * deu tuy chon, nhung it nhat 1 khoa phai co (service kiem tra).
 * ValidationPipe toan cuc (whitelist + forbidNonWhitelisted) tu choi
 * khoa la ngay tu DTO.
 */
export class UpdateSiteSettingsDto {
  @IsOptional()
  @IsBoolean()
  maintenance?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;
}
