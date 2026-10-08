import { Equals, IsBoolean } from "class-validator";

export class ConfirmAdultAccessDto {
  @IsBoolean()
  @Equals(true)
  adultAccessConfirmed: boolean;
}
