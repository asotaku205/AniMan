import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe = false;
}
