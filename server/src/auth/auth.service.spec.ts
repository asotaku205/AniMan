import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { PublicUser, UsersService } from "../users/users.service.js";
import { User } from "../users/user.entity.js";
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./auth.config.js";
import { AuthService } from "./auth.service.js";

describe("AuthService", () => {
  const usersService = {
    findByUsernameForAuthentication: vi.fn(),
  } as unknown as UsersService;
  const jwtService = {
    signAsync: vi.fn(),
  } as unknown as JwtService;
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(usersService, jwtService);
  });

  it("validates credentials case-insensitively and returns no password hash", async () => {
    const user = {
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
      passwordHash: await argon2.hash("123456"),
      termsAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    vi.mocked(usersService.findByUsernameForAuthentication).mockResolvedValue(
      user,
    );

    const result = await authService.validateLocalUser("ANI_MAN", "123456");

    expect(usersService.findByUsernameForAuthentication).toHaveBeenCalledWith(
      "ANI_MAN",
    );
    expect(result).toEqual({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      termsAcceptedAt: user.termsAcceptedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    expect(result).not.toHaveProperty("passwordHash");
  });

  it("rejects an unknown username with a generic error", async () => {
    vi.mocked(usersService.findByUsernameForAuthentication).mockResolvedValue(
      null,
    );

    await expect(
      authService.validateLocalUser("ani_man", "123456"),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid username or password",
    });
  });

  it("rejects an incorrect password with the same generic error", async () => {
    const user = {
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
      passwordHash: await argon2.hash("correct-password"),
    } as User;
    vi.mocked(usersService.findByUsernameForAuthentication).mockResolvedValue(
      user,
    );

    await expect(
      authService.validateLocalUser("ani_man", "incorrect-password"),
    ).rejects.toMatchObject({
      status: 401,
      message: "Invalid username or password",
    });
  });

  it("issues a 15-minute bearer access token", async () => {
    const user = {
      id: "user-id",
      username: "ani_man",
      displayName: "Ani Man",
    } as PublicUser;
    vi.mocked(jwtService.signAsync).mockResolvedValue("signed-access-token");

    await expect(authService.createLoginResult(user)).resolves.toEqual({
      accessToken: "signed-access-token",
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: user.id },
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS },
    );
  });

  it("rejects malformed credentials before querying storage", async () => {
    await expect(
      authService.validateLocalUser("ani_man", "short"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersService.findByUsernameForAuthentication).not.toHaveBeenCalled();
  });
});
