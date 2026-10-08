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

  async getStatus(userId: string): Promise<AiDrawingConsentStatus> {
    const user = await this.findUser(userId);
    return this.toStatus(user);
  }

  async assertEligible(userId: string): Promise<void> {
    const user = await this.findUser(userId);
    if (!this.toStatus(user).eligible) {
      throw new ForbiddenException(
        "Confirm current AI drawing consent before using this feature",
      );
    }
  }

  async confirm(userId: string): Promise<AiDrawingConsentStatus> {
    const user = await this.findUser(userId);
    user.aiAgeConfirmedAt = new Date();
    user.aiDataNoticeVersion = AI_DRAWING_DATA_NOTICE_VERSION;
    const savedUser = await this.usersRepository.save(user);
    return this.toStatus(savedUser);
  }

  async revoke(userId: string): Promise<AiDrawingConsentStatus> {
    const user = await this.findUser(userId);
    user.aiAgeConfirmedAt = null;
    user.aiDataNoticeVersion = null;
    const savedUser = await this.usersRepository.save(user);
    return this.toStatus(savedUser);
  }

  private async findUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException("Account not found");
    }
    return user;
  }

  private toStatus(user: User): AiDrawingConsentStatus {
    const eligible =
      user.aiAgeConfirmedAt instanceof Date &&
      user.aiDataNoticeVersion === AI_DRAWING_DATA_NOTICE_VERSION;
    return {
      eligible,
      ageConfirmedAt: user.aiAgeConfirmedAt,
      noticeVersion: user.aiDataNoticeVersion,
      currentNoticeVersion: AI_DRAWING_DATA_NOTICE_VERSION,
      notice: AI_DRAWING_DATA_NOTICE,
    };
  }
}
