export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthUser;
}

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface RegisterRequest {
  displayName: string;
  username: string;
  password: string;
  confirmPassword: string;
  agree: true;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

let refreshInFlight: Promise<AuthResponse | null> | null = null;

export async function login(request: LoginRequest): Promise<AuthResponse> {
  return postAuth("login", request);
}

export async function register(
  request: RegisterRequest,
): Promise<AuthResponse> {
  return postAuth("register", request);
}

export function refreshSession(): Promise<AuthResponse | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const pending = requestRefresh()
    .catch((error: unknown) => {
      if (error instanceof AuthApiError && error.status === 401) {
        return null;
      }
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  refreshInFlight = pending;
  return pending;
}

export async function logout(): Promise<void> {
  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await readResponsePayload(response);
    throw new AuthApiError(getErrorMessage(payload), response.status);
  }
}

async function postAuth(
  endpoint: string,
  body?: object,
): Promise<AuthResponse> {
  const response = await fetch(`/auth/${endpoint}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new AuthApiError(getErrorMessage(payload), response.status);
  }

  if (!isAuthResponse(payload)) {
    throw new Error("Máy chủ trả về dữ liệu xác thực không hợp lệ.");
  }

  return payload;
}

async function requestRefresh(): Promise<AuthResponse> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("animan-refresh-token", async () =>
      postAuth("refresh"),
    );
  }

  return postAuth("refresh");
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") {
      return message;
    }
    if (
      Array.isArray(message) &&
      message.every((item): item is string => typeof item === "string")
    ) {
      return message.join(" ");
    }
  }

  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  return "Không thể hoàn tất yêu cầu xác thực.";
}

function isAuthResponse(value: unknown): value is AuthResponse {
  if (typeof value !== "object" || value === null || !("user" in value)) {
    return false;
  }

  const response = value as Record<string, unknown>;
  const user = response.user;
  return (
    typeof response.accessToken === "string" &&
    response.accessToken.length > 0 &&
    response.tokenType === "Bearer" &&
    typeof response.expiresIn === "number" &&
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof user.id === "string" &&
    "username" in user &&
    typeof user.username === "string" &&
    "displayName" in user &&
    typeof user.displayName === "string" &&
    "role" in user &&
    (user.role === "user" || user.role === "admin") &&
    "termsAcceptedAt" in user &&
    typeof user.termsAcceptedAt === "string" &&
    "createdAt" in user &&
    typeof user.createdAt === "string" &&
    "updatedAt" in user &&
    typeof user.updatedAt === "string"
  );
}
