import { BadRequestException, ConflictException } from "@nestjs/common";
import * as argon2 from "argon2";
import { QueryFailedError, Repository } from "typeorm";
import { User } from "./user.entity.js";
import { UsersService } from "./users.service.js";

describe("UsersService", () => {
  const repository = {
    findOneBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  } as unknown as Repository<User>;
  let usersService: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    usersService = new UsersService(repository);
  });

  it("normalizes username, hashes password, and returns only public user fields", async () => {
    const now = new Date();
    const user = {
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
      passwordHash: await argon2.hash("123456"),
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    } as User;

    vi.mocked(repository.findOneBy).mockResolvedValue(null);
    vi.mocked(repository.create).mockReturnValue(user);
    vi.mocked(repository.save).mockResolvedValue(user);

    const result = await usersService.register({
      displayName: "Ani Man",
      username: "Ani_Man",
      password: "123456",
      agree: true,
    });

    expect(repository.findOneBy).toHaveBeenCalledWith({ username: "ani_man" });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "ani_man",
        displayName: "Ani Man",
        passwordHash: expect.any(String),
        termsAcceptedAt: expect.any(Date),
      }),
    );

    const savedUser = vi.mocked(repository.save).mock.calls[0][0];
    expect(await argon2.verify(savedUser.passwordHash, "123456")).toBe(true);
    expect(savedUser.passwordHash).not.toBe("123456");
    expect(result).toEqual({
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("agree");
  });

  it("rejects a username that already exists before hashing or saving", async () => {
    vi.mocked(repository.findOneBy).mockResolvedValue({
      id: "existing",
    } as User);

    await expect(
      usersService.register({
        displayName: "Ani Man",
        username: "ANI_MAN",
        password: "123456",
        agree: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it("does not create an account when terms have not been accepted", async () => {
    await expect(
      usersService.register({
        displayName: "Ani Man",
        username: "ani_man",
        password: "123456",
        agree: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findOneBy).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("maps a concurrent username uniqueness violation to a conflict", async () => {
    const user = {
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
      passwordHash: "hash",
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;

    vi.mocked(repository.findOneBy).mockResolvedValue(null);
    vi.mocked(repository.create).mockReturnValue(user);
    vi.mocked(repository.save).mockRejectedValue(
      new QueryFailedError("INSERT", [], {
        code: "23505",
        constraint: "uq_users_username",
      }),
    );

    await expect(
      usersService.register({
        displayName: "Ani Man",
        username: "ANI_MAN",
        password: "123456",
        agree: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
