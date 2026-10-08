import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../../users/user.entity.js";
import {
  AI_DRAWING_DATA_NOTICE,
  AI_DRAWING_DATA_NOTICE_VERSION,
} from "./ai-drawing-consent.constants.js";

export interface AiDrawingConsentStatus {
  eligible: boolean;
  ageConfirmedAt: Date | null;
  noticeVersion: string | null;
  currentNoticeVersion: string;
  notice: string;
}

@Injectable()
export class AiDrawingConsentService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getStatus(_userId: string): Promise<AiDrawingConsentStatus> {
    return {
      eligible: true,
      ageConfirmedAt: new Date(),
      noticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
      currentNoticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
      notice: AI_DRAWING_DATA_NOTICE,
    };
  }

  async assertEligible(_userId: string): Promise<void> {
    return;
  }

  async confirm(_userId: string): Promise<AiDrawingConsentStatus> {
    return this.getStatus(_userId);
  }

  async revoke(_userId: string): Promise<AiDrawingConsentStatus> {
    return this.getStatus(_userId);
  }
}
