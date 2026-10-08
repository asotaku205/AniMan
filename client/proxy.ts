import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADULT_ACCESS_COOKIE_NAME,
  ADULT_ACCESS_COOKIE_VALUE,
} from "./lib/adult-access";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname === "/age-check" ||
    pathname.startsWith("/_next/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/ai/") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  if (
    request.cookies.get(ADULT_ACCESS_COOKIE_NAME)?.value ===
    ADULT_ACCESS_COOKIE_VALUE
  ) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.pathname = "/age-check";
  destination.search = "";
  destination.searchParams.set(
    "returnTo",
    `${pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
