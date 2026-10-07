import { validate } from "class-validator";
import { RegisterDto } from "./register.dto.js";

function createRegisterDto(overrides: Partial<RegisterDto> = {}): RegisterDto {
  return Object.assign(new RegisterDto(), {
    displayName: "Ani Man",
    username: "ani_man",
    password: "123456",
    confirmPassword: "123456",
    agree: true,
    ...overrides,
  });
}

describe("RegisterDto", () => {
  it("accepts valid registration form values", async () => {
    await expect(validate(createRegisterDto())).resolves.toHaveLength(0);
  });

  it.each([
    ["empty display name", { displayName: "" }],
    ["invalid username", { username: "ani man" }],
    ["short password", { password: "12345", confirmPassword: "12345" }],
    ["different confirmation", { confirmPassword: "654321" }],
    ["terms not accepted", { agree: false }],
  ])("rejects %s", async (_description, overrides) => {
    const errors = await validate(createRegisterDto(overrides));
    expect(errors.length).toBeGreaterThan(0);
  });
});
