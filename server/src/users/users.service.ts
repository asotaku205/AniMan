import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
import { AuditAction } from "../audit/audit-action.enum.js";
import {
  AuditService,
  type AuditActor,
} from "../audit/audit.service.js";
import { User } from "./user.entity.js";
import { UserRole } from "./user-role.enum.js";
import { UserStatus } from "./user-status.enum.js";

export interface RegisterUserInput {
  displayName: string;
  username: string;
  password: string;
  agree: boolean;
}

export type PublicUser = Pick<
  User,
  | "id"
  | "username"
  | "displayName"
  | "role"
  | "status"
  | "termsAcceptedAt"
  | "createdAt"
  | "updatedAt"
>;

export interface ListAdminUsersInput {
  page: number;
  pageSize: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminUserCounts {
  total: number;
  admin: number;
  active: number;
  suspended: number;
}

export interface AdminUserList {
  items: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
  counts: AdminUserCounts;
}

function isUsernameConflict(error: unknown): boolean {
  return isConstraintConflict(error, "uq_users_username");
}

function isSingleAdminConflict(error: unknown): boolean {
  return isConstraintConflict(error, "uq_users_single_admin");
}

function isConstraintConflict(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;
  if (typeof driverError !== "object" || driverError === null) {
    return false;
  }

  return (
    "code" in driverError &&
    driverError.code === "23505" &&
    "constraint" in driverError &&
    driverError.constraint === constraint
  );
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly auditService: AuditService,
  ) {}

  async register(input: RegisterUserInput): Promise<PublicUser> {
    if (!input.agree) {
      throw new BadRequestException("Terms must be accepted");
    }

    const username = input.username.toLowerCase();
    const existingUser = await this.usersRepository.findOneBy({ username });

    if (existingUser) {
      throw new ConflictException("Username is already taken");
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const confirmedAt = new Date();
    const user = this.usersRepository.create({
      id: randomUUID(),
      username,
      displayName: input.displayName,
      passwordHash,
      role: UserRole.User,
      status: UserStatus.Active,
      termsAcceptedAt: confirmedAt,
    });

    try {
      const savedUser = await this.usersRepository.save(user);
      return this.toPublicUser(savedUser);
    } catch (error: unknown) {
      if (isUsernameConflict(error)) {
        throw new ConflictException("Username is already taken");
      }

      throw error;
    }
  }

  async promoteToAdmin(
    username: string,
    password: string,
  ): Promise<PublicUser> {
    const user = await this.findByUsernameForAuthentication(username);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException("Unable to verify account credentials");
    }

    if (user.role === UserRole.Admin) {
      return this.toPublicUser(user);
    }

    user.role = UserRole.Admin;
    try {
      const savedUser = await this.usersRepository.save(user);
      return this.toPublicUser(savedUser);
    } catch (error: unknown) {
      if (isSingleAdminConflict(error)) {
        throw new ConflictException("An admin account already exists");
      }

      throw error;
    }
  }

  /**
   * Danh sách user cho trang Admin (Lát 2). `total` là số user sau khi lọc
   * (dùng cho phân trang), `counts` là số liệu toàn hệ thống (dùng cho 4 thẻ
   * số liệu). Tìm kiếm không phân biệt hoa thường trên username và tên hiển thị.
   */
  async listUsers(input: ListAdminUsersInput): Promise<AdminUserList> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize) || 20));
    const query = this.usersRepository.createQueryBuilder("user");
    const search = input.q?.trim();
    if (search) {
      query.andWhere(
        "(user.username ILIKE :search OR user.displayName ILIKE :search)",
        { search: `%${search}%` },
      );
    }
    if (input.role) {
      query.andWhere("user.role = :role", { role: input.role });
    }
    if (input.status) {
      query.andWhere("user.status = :status", { status: input.status });
    }
    query
      .orderBy("user.createdAt", "DESC")
      .addOrderBy("user.id", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [users, total] = await query.getManyAndCount();
    const [totalCount, adminCount, activeCount, suspendedCount] =
      await Promise.all([
        this.usersRepository.count(),
        this.usersRepository.countBy({ role: UserRole.Admin }),
        this.usersRepository.countBy({ status: UserStatus.Active }),
        this.usersRepository.countBy({ status: UserStatus.Suspended }),
      ]);
    return {
      items: users.map((user) => this.toPublicUser(user)),
      total,
      page,
      pageSize,
      counts: {
        total: totalCount,
        admin: adminCount,
        active: activeCount,
        suspended: suspendedCount,
      },
    };
  }

  /**
   * Đổi vai trò user (Lát 2, phương án M: nhiều admin).
   *
   * Chặn tự đổi vai trò của chính mình, và chặn hạ quyền admin cuối cùng.
   * Đếm số admin và lưu thay đổi trong cùng một transaction để hai lần hạ
   * quyền đồng thời không làm hệ thống mất hết admin. Dòng audit log ghi
   * trong cùng transaction (Lát 3); không đổi vai trò thì không ghi log.
   */
  async changeRole(
    actor: AuditActor,
    targetId: string,
    role: UserRole,
    ip?: string | null,
  ): Promise<PublicUser> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const target = await repository.findOneBy({ id: targetId });
      if (!target) {
        throw new NotFoundException("User not found");
      }
      if (actor.id === targetId) {
        throw new ForbiddenException("Cannot change your own role");
      }
      if (target.role === role) {
        return this.toPublicUser(target);
      }
      if (target.role === UserRole.Admin && role === UserRole.User) {
        const adminCount = await repository.countBy({ role: UserRole.Admin });
        if (adminCount <= 1) {
          throw new ConflictException("Cannot demote the last admin");
        }
      }
      const previousRole = target.role;
      target.role = role;
      const saved = await repository.save(target);
      await this.auditService.record(manager, {
        actor,
        action: AuditAction.UserRoleChanged,
        targetType: "user",
        targetId: target.id,
        targetLabel: target.username,
        detail: { previousRole, newRole: role },
        ip,
      });
      return this.toPublicUser(saved);
    });
  }

  /**
   * Khóa hoặc mở khóa tài khoản (Lát 2). Khóa là tạm thời, mở lại được.
   *
   * Chặn tự khóa chính mình và chặn khóa tài khoản quản trị viên. Mở khóa
   * tài khoản quản trị viên (trường hợp bị khóa trước khi lên admin) vẫn
   * cho phép. Lưu thay đổi và dòng audit log trong cùng một transaction
   * (Lát 3); trạng thái không đổi thì không ghi log.
   */
  async changeStatus(
    actor: AuditActor,
    targetId: string,
    status: UserStatus,
    ip?: string | null,
  ): Promise<PublicUser> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(User);
      const target = await repository.findOneBy({ id: targetId });
      if (!target) {
        throw new NotFoundException("User not found");
      }
      if (actor.id === targetId) {
        throw new ForbiddenException("Cannot change your own account status");
      }
      if (
        status === UserStatus.Suspended &&
        target.role === UserRole.Admin
      ) {
        throw new ForbiddenException("Cannot suspend an admin account");
      }
      if (target.status === status) {
        return this.toPublicUser(target);
      }
      const previousStatus = target.status;
      target.status = status;
      const saved = await repository.save(target);
      await this.auditService.record(manager, {
        actor,
        action:
          status === UserStatus.Suspended
            ? AuditAction.UserSuspended
            : AuditAction.UserUnsuspended,
        targetType: "user",
        targetId: target.id,
        targetLabel: target.username,
        detail: { previousStatus, newStatus: status },
        ip,
      });
      return this.toPublicUser(saved);
    });
  }

  findByUsernameForAuthentication(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username: username.toLowerCase() });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findOneBy({ id });
    return user ? this.toPublicUser(user) : null;
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
