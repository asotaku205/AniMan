export const ADULT_ACCESS_COOKIE_NAME = "animan_adult_access";
export const ADULT_ACCESS_COOKIE_VALUE = "confirmed";
export const ADULT_ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function hasAdultAccessCookie(): boolean {
  const expectedCookie = `${ADULT_ACCESS_COOKIE_NAME}=${ADULT_ACCESS_COOKIE_VALUE}`;
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === expectedCookie);
}

export function setAdultAccessCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ADULT_ACCESS_COOKIE_NAME}=${ADULT_ACCESS_COOKIE_VALUE}; Path=/; Max-Age=${ADULT_ACCESS_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}
