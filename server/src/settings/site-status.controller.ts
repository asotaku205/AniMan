import { Controller, Get } from "@nestjs/common";
import type { SiteSettings } from "./settings.service.js";
import { SettingsService } from "./settings.service.js";

/**
 * Trang thai cong khai cua he thong (Lat 4): khong can dang nhap, de
 * client biet co dang bao tri hay dang khoa dang ky khong. Chi tra 2
 * trang thai, khong lo thong tin noi bo.
 */
@Controller("site")
export class SiteStatusController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("status")
  getStatus(): Promise<SiteSettings> {
    return this.settingsService.getSettings();
  }
}
