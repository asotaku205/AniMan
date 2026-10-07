import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "passwordsMatch", async: false })
export class PasswordsMatchValidator implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const request = args.object as { password?: unknown };
    return typeof value === "string" && value === request.password;
  }

  defaultMessage(): string {
    return "confirmPassword must match password";
  }
}
