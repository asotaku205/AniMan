import { ConfigService } from "@nestjs/config";

export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 15 * 60;

export function getJwtAccessSecret(configService: ConfigService): string {
  const secret = configService.get<string>("JWT_ACCESS_SECRET");
  if (!secret || secret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be set and at least 32 characters");
  }

  return secret;
}
