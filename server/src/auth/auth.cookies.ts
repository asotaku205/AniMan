import type { CookieOptions } from "express";

export const REFRESH_COOKIE_NAME = "refresh_token";

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
  };
}
