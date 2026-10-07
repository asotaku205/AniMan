import {
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
} from "./auth.cookies.js";

describe("refresh cookie settings", () => {
  it("uses HttpOnly, SameSite=Lax and an auth-only path in development", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    try {
      expect(REFRESH_COOKIE_NAME).toBe("refresh_token");
      expect(getRefreshCookieOptions()).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/auth",
      });
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it("requires Secure cookies in production", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      expect(getRefreshCookieOptions()).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/auth",
      });
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });
});
