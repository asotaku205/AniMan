import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as argon2 from "argon2";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { App } from "supertest/types";
import { Repository } from "typeorm";
import { AppModule } from "./../src/app.module.js";
import { User } from "./../src/users/user.entity.js";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let testUsername: string;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET ??= randomBytes(48).toString("base64");
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    usersRepository = app.get<Repository<User>>(getRepositoryToken(User));
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

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.username).toBe(testUsername);
        expect(body).not.toHaveProperty("passwordHash");
      });
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
