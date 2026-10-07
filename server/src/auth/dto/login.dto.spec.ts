import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "./login.dto.js";

function createLoginDto(overrides: Partial<LoginDto> = {}): LoginDto {
  return plainToInstance(LoginDto, {
    username: "ani_man",
    password: "123456",
    ...overrides,
  });
}

describe("LoginDto", () => {
  it("accepts valid credentials with default rememberMe=false", async () => {
    const login = createLoginDto();

    await expect(validate(login)).resolves.toHaveLength(0);
    expect(login.rememberMe).toBe(false);
  });

  it.each([true, false])("accepts rememberMe=%s", async (rememberMe) => {
    const errors = await validate(createLoginDto({ rememberMe }));
    expect(errors).toHaveLength(0);
  });

  it.each([
    ["empty username", { username: "" }],
    ["short password", { password: "12345" }],
    ["non-boolean rememberMe", { rememberMe: "yes" }],
  ])("rejects %s", async (_description, overrides) => {
    const errors = await validate(createLoginDto(overrides));
    expect(errors.length).toBeGreaterThan(0);
  });
});
