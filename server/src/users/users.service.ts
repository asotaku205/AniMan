import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
import { User } from "./user.entity.js";
import { UserRole } from "./user-role.enum.js";

export interface RegisterUserInput {
  displayName: string;
  username: string;
  password: string;
  agree: boolean;
  adultAccessConfirmed: boolean;
}

export type PublicUser = Pick<
  User,
  | "id"
  | "username"
  | "displayName"
  | "role"
  | "termsAcceptedAt"
  | "adultAccessConfirmedAt"
  | "createdAt"
  | "updatedAt"
>;

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
  ) {}

  async register(input: RegisterUserInput): Promise<PublicUser> {
    if (!input.agree) {
      throw new BadRequestException("Terms must be accepted");
    }
    if (!input.adultAccessConfirmed) {
      throw new BadRequestException("Adult access confirmation is required");
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
      termsAcceptedAt: confirmedAt,
      adultAccessConfirmedAt: confirmedAt,
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

  findByUsernameForAuthentication(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username: username.toLowerCase() });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findOneBy({ id });
    return user ? this.toPublicUser(user) : null;
  }

  async confirmAdultAccess(userId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException("Account not found");
    }

    user.adultAccessConfirmedAt = new Date();
    const savedUser = await this.usersRepository.save(user);
    return this.toPublicUser(savedUser);
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      termsAcceptedAt: user.termsAcceptedAt,
      adultAccessConfirmedAt: user.adultAccessConfirmedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
