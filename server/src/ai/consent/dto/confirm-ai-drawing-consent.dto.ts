import { Equals, IsBoolean, IsString } from "class-validator";
import { AI_DRAWING_DATA_NOTICE_VERSION } from "../ai-drawing-consent.constants.js";

export class ConfirmAiDrawingConsentDto {
  @IsBoolean()
  @Equals(true)
  ageConfirmed: true;

  @IsBoolean()
  @Equals(true)
  dataNoticeAccepted: true;

  @IsString()
  @Equals(AI_DRAWING_DATA_NOTICE_VERSION)
  noticeVersion: string;
}
