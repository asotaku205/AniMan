import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import { AuditAction } from "../audit/audit-action.enum.js";
import type { AuditActor } from "../audit/audit.service.js";
import { AuditService } from "../audit/audit.service.js";
import { User } from "../users/user.entity.js";
import { UserRole } from "../users/user-role.enum.js";
import { UserStatus } from "../users/user-status.enum.js";
import { SiteSetting } from "./site-setting.entity.js";

export interface SiteSettings {
  maintenance: boolean;
  registrationOpen: boolean;
}

export type SiteSettingsPatch = Partial<SiteSettings>;

export interface AdminStats {
  totalUsers: number;
  adminCount: number;
  suspendedCount: number;
  newUsersLast7Days: number;
}

export const SITE_SETTING_KEYS = [
  "maintenance",
  "registrationOpen",
] as const;

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  maintenance: false,
  registrationOpen: true,
};

function parseSettingValue(raw: string | undefined, fallback: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

/**
 * Cai dat he thong (Lat 4).
 *
 * Ban sao trong bo nho (cache): nap lan dau tu DB, cap nhat ngay sau khi
 * PATCH commit xong, nen doi cai dat co hieu luc ngay ma khong can khoi
 * dong lai server. Chi 1 tien trinh server chay tren may Son nen khong
 * can TTL hay dong bo giua nhieu instance.
 *
 * Doc cai dat that bai (DB loi) thi tra gia tri mac dinh va khong cache,
 * de request sau thu lai: che do bao tri khong bao gio khoa app chi vi
 * DB doc loi.
 */
@Injectable()
export class SettingsService {
  private cache: SiteSettings | null = null;

  constructor(
    @InjectRepository(SiteSetting)
    private readonly settingsRepository: Repository<SiteSetting>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async getSettings(): Promise<SiteSettings> {
    if (this.cache) {
      return { ...this.cache };
    }
    try {
      const rows = await this.settingsRepository.find();
      const byKey = new Map(rows.map((row) => [row.key, row.value]));
      this.cache = {
        maintenance: parseSettingValue(
          byKey.get("maintenance"),
          SITE_SETTINGS_DEFAULTS.maintenance,
        ),
        registrationOpen: parseSettingValue(
          byKey.get("registrationOpen"),
          SITE_SETTINGS_DEFAULTS.registrationOpen,
        ),
      };
      return { ...this.cache };
    } catch {
      return { ...SITE_SETTINGS_DEFAULTS };
    }
  }

  async isMaintenance(): Promise<boolean> {
    return (await this.getSettings()).maintenance;
  }

  async isRegistrationOpen(): Promise<boolean> {
    return (await this.getSettings()).registrationOpen;
  }

  /**
   * Doi cai dat. Chi ghi cac khoa co gia tri that su doi; khong co khoa
   * nao doi thi tra ve hien trang ma khong ghi audit log. Ghi dong setting
   * va dong audit log trong cung giao dich, giong Lat 3.
   */
  async updateSettings(
    actor: AuditActor,
    changes: SiteSettingsPatch,
    ip?: string | null,
  ): Promise<SiteSettings> {
    const keys = SITE_SETTING_KEYS.filter(
      (key) => typeof changes[key] === "boolean",
    );
    if (keys.length === 0) {
      throw new BadRequestException(
        "At least one setting must be provided",
      );
    }
    const previous = await this.getSettings();
    const changed = keys.filter((key) => changes[key] !== previous[key]);
    if (changed.length === 0) {
      return previous;
    }
    const next: SiteSettings = { ...previous };
    for (const key of changed) {
      next[key] = changes[key] as boolean;
    }
    await this.settingsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(SiteSetting);
      for (const key of changed) {
        const existing = await repository.findOneBy({ key });
        const row = existing ?? repository.create({ key });
        row.value = String(next[key]);
        await repository.save(row);
      }
      const previousDetail: Record<string, boolean> = {};
      const nextDetail: Record<string, boolean> = {};
      for (const key of changed) {
        previousDetail[key] = previous[key];
        nextDetail[key] = next[key];
      }
      await this.auditService.record(manager, {
        actor,
        action: AuditAction.SettingsChanged,
        targetType: "site_setting",
        targetId: "site_settings",
        targetLabel: "Cài đặt hệ thống",
        detail: { previous: previousDetail, new: nextDetail },
        ip: ip ?? null,
      });
    });
    this.cache = next;
    return { ...next };
  }

  /** So lieu that cho dashboard (Lat 4): chi dem tu bang users. */
  async getStats(): Promise<AdminStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalUsers, adminCount, suspendedCount, newUsersLast7Days] =
      await Promise.all([
        this.usersRepository.count(),
        this.usersRepository.count({ where: { role: UserRole.Admin } }),
        this.usersRepository.count({
          where: { status: UserStatus.Suspended },
        }),
        this.usersRepository.count({
          where: { createdAt: MoreThanOrEqual(sevenDaysAgo) },
        }),
      ]);
    return { totalUsers, adminCount, suspendedCount, newUsersLast7Days };
  }
}
