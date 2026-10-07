import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { QueryFailedError, Repository } from "typeorm";
import { User } from "./user.entity.js";

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
  | "termsAcceptedAt"
  | "createdAt"
  | "updatedAt"
>;

function isUsernameConflict(error: unknown): boolean {
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
    driverError.constraint === "uq_users_username"
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

    const username = input.username.toLowerCase();
    const existingUser = await this.usersRepository.findOneBy({ username });

    if (existingUser) {
      throw new ConflictException("Username is already taken");
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });
    const user = this.usersRepository.create({
      id: randomUUID(),
      username,
      displayName: input.displayName,
      passwordHash,
      termsAcceptedAt: new Date(),
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

  findByUsernameForAuthentication(username: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ username: username.toLowerCase() });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    const user = await this.usersRepository.findOneBy({ id });
    return user ? this.toPublicUser(user) : null;
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
