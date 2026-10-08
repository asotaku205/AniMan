import {
  Equals,
  IsBoolean,
  IsString,
  Matches,
  MinLength,
  Validate,
} from "class-validator";
import { PasswordsMatchValidator } from "./passwords-match.validator.js";

export class RegisterDto {
  @IsString()
  @MinLength(1)
  displayName: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(6)
  @Validate(PasswordsMatchValidator)
  confirmPassword: string;

  @IsBoolean()
  @Equals(true)
  agree: boolean;
}

