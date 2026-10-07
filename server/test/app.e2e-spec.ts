import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import cookieParser from "cookie-parser";
import * as argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { App } from "supertest/types";
import { Repository } from "typeorm";
import { AppModule } from "./../src/app.module.js";
import { RefreshSession } from "./../src/auth/refresh-session.entity.js";
import { User } from "./../src/users/user.entity.js";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let refreshSessionsRepository: Repository<RefreshSession>;
  let testUsername: string;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET ??= randomBytes(48).toString("base64");
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
    refreshSessionsRepository = app.get<Repository<RefreshSession>>(
      getRepositoryToken(RefreshSession),
    );
    testUsername = `auth_e2e_${randomUUID().replaceAll("-", "")}`;
  });

  it("/ (GET)", () => {
    return request(app.getHttpServer())
      .get("/")
      .expect(200)
      .expect("Hello, World!");
  });

  it("/auth/me rejects requests without an access token", () => {
    return request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("/auth/me rejects an invalid access token", () => {
    return request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer not-a-valid-jwt")
      .expect(401);
  });

  it("logs in and uses the access token to retrieve the current user", async () => {
    const user = await createTestUser(usersRepository, testUsername);
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: testUsername, password: "test-password-123" })
      .expect(201);

    expect(loginResponse.body).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
      user: {
        id: user.id,
        username: testUsername,
        displayName: "E2E User",
      },
    });
    expect(loginResponse.body.accessToken).toEqual(expect.any(String));
    expect(loginResponse.body.user).not.toHaveProperty("passwordHash");
    expect(loginResponse.body).not.toHaveProperty("refreshToken");
    const cookie = getCookie(loginResponse, "refresh_token");
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/auth/i);
    expect(cookie).not.toMatch(/Secure/i);

    const rawRefreshToken = getCookieValue(cookie);
    const session = await refreshSessionsRepository.findOneByOrFail({
      userId: user.id,
    });
    expect(session.tokenHash).toBe(hashToken(rawRefreshToken));
    expect(session.tokenHash).not.toBe(rawRefreshToken);

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.username).toBe(testUsername);
        expect(body).not.toHaveProperty("passwordHash");
      });
  });

  it.each([
    ["default", false, 1],
    ["remembered", true, 30],
  ])(
    "sets a %s refresh-session lifetime",
    async (_label, rememberMe, expectedDays) => {
      await createTestUser(usersRepository, testUsername);
      const loginResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: testUsername,
          password: "test-password-123",
          rememberMe,
        })
        .expect(201);

      const cookie = getCookie(loginResponse, "refresh_token");
      const session = await refreshSessionsRepository.findOneByOrFail({
        tokenHash: hashToken(getCookieValue(cookie)),
      });
      const durationDays =
        (session.expiresAt.getTime() - session.createdAt.getTime()) /
        (24 * 60 * 60 * 1000);

      expect(durationDays).toBeCloseTo(expectedDays, 2);
    },
  );

  it("rotates refresh tokens and revokes the entire family on token reuse", async () => {
    await createTestUser(usersRepository, testUsername);
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: testUsername,
        password: "test-password-123",
        rememberMe: true,
      })
      .expect(201);
    const oldCookie = getCookie(loginResponse, "refresh_token");
    const oldToken = getCookieValue(oldCookie);

    const refreshResponse = await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", oldCookie.split(";")[0])
      .expect(201);
    expect(refreshResponse.body).toHaveProperty("accessToken");
    expect(refreshResponse.body).not.toHaveProperty("refreshToken");

    const newCookie = getCookie(refreshResponse, "refresh_token");
    const newToken = getCookieValue(newCookie);
    expect(newToken).not.toBe(oldToken);

    const oldSession = await refreshSessionsRepository.findOneByOrFail({
      tokenHash: hashToken(oldToken),
    });
    const newSession = await refreshSessionsRepository.findOneByOrFail({
      tokenHash: hashToken(newToken),
    });
    expect(oldSession.revokedAt).toBeInstanceOf(Date);
    expect(oldSession.replacedById).toBe(newSession.id);
    expect(newSession.familyId).toBe(oldSession.familyId);
    expect(
      newSession.expiresAt.getTime() - newSession.createdAt.getTime(),
    ).toBeCloseTo(30 * 24 * 60 * 60 * 1000, -5);

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", oldCookie.split(";")[0])
      .expect(401);

    const sessions = await refreshSessionsRepository.findBy({
      familyId: oldSession.familyId,
    });
    expect(sessions.every((session) => session.revokedAt instanceof Date)).toBe(
      true,
    );
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", newCookie.split(";")[0])
      .expect(401);
  });

  it("rejects refresh requests without a refresh cookie", async () => {
    await request(app.getHttpServer()).post("/auth/refresh").expect(401);
  });

  it("revokes the current refresh session and clears its cookie on logout", async () => {
    await createTestUser(usersRepository, testUsername);
    const loginResponse = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: testUsername, password: "test-password-123" })
      .expect(201);
    const cookie = getCookie(loginResponse, "refresh_token");
    const token = getCookieValue(cookie);

    const logoutResponse = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", cookie.split(";")[0])
      .expect(201);
    expect(logoutResponse.body).toEqual({ success: true });
    expect(getCookie(logoutResponse, "refresh_token")).toMatch(
      /refresh_token=;/,
    );

    const session = await refreshSessionsRepository.findOneByOrFail({
      tokenHash: hashToken(token),
    });
    expect(session.revokedAt).toBeInstanceOf(Date);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .set("Cookie", cookie.split(";")[0])
      .expect(401);
  });

  it("returns the same unauthorized response for an incorrect password", async () => {
    await createTestUser(usersRepository, testUsername);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ username: testUsername, password: "wrong-password" })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid username or password");
      });
  });

  it("rejects an expired access token", async () => {
    const token = await app
      .get(JwtService)
      .signAsync({ sub: randomUUID() }, { expiresIn: -1 });

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  afterEach(async () => {
    if (testUsername) {
      await usersRepository.delete({ username: testUsername });
    }
    await app.close();
  });
});

async function createTestUser(
  usersRepository: Repository<User>,
  username: string,
): Promise<User> {
  const user = usersRepository.create({
    id: randomUUID(),
    username,
    displayName: "E2E User",
    passwordHash: await argon2.hash("test-password-123", {
      type: argon2.argon2id,
    }),
    termsAcceptedAt: new Date(),
  });

  return usersRepository.save(user);
}

function getCookie(
  response: { headers: Record<string, unknown> },
  name: string,
): string {
  const cookies = response.headers["set-cookie"];
  expect(cookies).toBeDefined();
  const cookie = (cookies as string[]).find((value) =>
    value.startsWith(`${name}=`),
  );
  expect(cookie).toBeDefined();
  return cookie as string;
}

function getCookieValue(cookie: string): string {
  return cookie.slice("refresh_token=".length).split(";")[0];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
