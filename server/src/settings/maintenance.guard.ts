import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import type { Request } from "express";
import { Repository } from "typeorm";
import { User } from "../users/user.entity.js";
import { UserRole } from "../users/user-role.enum.js";
import type { AccessTokenPayload } from "../auth/auth.service.js";
import { SettingsService } from "./settings.service.js";

/** Ma loi on dinh de client nhan ra trang thai bao tri. */
export const MAINTENANCE_ERROR_CODE = "maintenance";

/**
 * Ngoai le 503 cho che do bao tri: body mang code "maintenance" de
 * client phan biet voi loi 503 khac.
 */
export class MaintenanceException extends HttpException {
  constructor() {
    super(
      {
        code: MAINTENANCE_ERROR_CODE,
        message: "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** Duong dan luon cho qua khi dang bao tri, ke ca khach an danh. */
const EXEMPT_PATHS = [
  "/site/status",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
];

function isExemptPath(path: string): boolean {
  if (path === "/admin" || path.startsWith("/admin/")) return true;
  return EXEMPT_PATHS.some(
    (exempt) => path === exempt || path.startsWith(`${exempt}/`),
  );
}

/**
 * Guard toan cuc cho che do bao tri (Lat 4).
 *
 * Bao tri tat: cho qua tat ca. Bao tri bat: chi cho qua route mien
 * (trang thai cong khai, dang nhap/lam moi/dang xuat, route admin) va
 * request mang token JWT hop le cua tai khoan admin. Token chi co `sub`
 * nen guard tu tra cuu vai tro tu DB, khong tin bat cu header nao chua
 * kiem chung. Token sai/het han/khong phai admin deu nhan 503, khong
 * phai 401, de client hien trang bao tri thay vi trang dang nhap.
 *
 * Guard khong cap quyen admin: route /admin/* van qua JwtAuthGuard +
 * RolesGuard binh thuong sau guard nay.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? "/";
    if (isExemptPath(path)) {
      return true;
    }
    if (!(await this.settingsService.isMaintenance())) {
      return true;
    }
    if (await this.isAdminRequest(request)) {
      return true;
    }
    throw new MaintenanceException();
  }

  private async isAdminRequest(request: Request): Promise<boolean> {
    const authorization = request.headers?.authorization;
    if (typeof authorization !== "string") return false;
    const match = /^Bearer (.+)$/.exec(authorization.trim());
    if (!match) return false;
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        match[1],
      );
      if (typeof payload?.sub !== "string" || payload.sub.length === 0) {
        return false;
      }
      const user = await this.usersRepository.findOneBy({ id: payload.sub });
      return user?.role === UserRole.Admin;
    } catch {
      return false;
    }
  }
}
