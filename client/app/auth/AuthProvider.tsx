"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
} from "@/lib/auth-api";
import {
  MAINTENANCE_DETECTED_EVENT,
  isMaintenancePayload,
} from "@/lib/site-status";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  sessionError: string | null;
  signIn: (request: LoginRequest) => Promise<void>;
  signUp: (request: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
  authenticatedFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  /** Token Bearer hiện tại, dùng cho tải file bằng XMLHttpRequest. */
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void refreshSession()
      .then((session) => {
        if (!active) {
          return;
        }
        setAccessToken(session?.accessToken ?? null);
        setUser(session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setSessionError(
          error instanceof Error
            ? error.message
            : "Không thể khôi phục phiên đăng nhập.",
        );
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (request: LoginRequest) => {
    const session = await loginRequest(request);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSessionError(null);
  }, []);

  const signUp = useCallback(async (request: RegisterRequest) => {
    const session = await registerRequest(request);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSessionError(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const authenticatedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const send = (token: string | null) => {
        const headers = new Headers(init.headers);
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }

        return fetch(input, {
          ...init,
          headers,
          credentials: "include",
        });
      };

      const response = await send(accessToken);
      if (response.status === 503) {
        // Bao tri bat: bao cho SiteStatusGate kiem tra lai ngay, khong
        // doi toi luot poll 30 giay. Doc ban sao de khong anh huong
        // body goc; loi doc thi bo qua lang.
        void response
          .clone()
          .json()
          .then((payload: unknown) => {
            if (isMaintenancePayload(payload)) {
              window.dispatchEvent(new Event(MAINTENANCE_DETECTED_EVENT));
            }
          })
          .catch(() => undefined);
      }
      if (response.status !== 401) {
        return response;
      }

      const session = await refreshSession();
      if (!session) {
        setAccessToken(null);
        setUser(null);
        return response;
      }

      setAccessToken(session.accessToken);
      setUser(session.user);
      return send(session.accessToken);
    },
    [accessToken],
  );

  const getAccessToken = useCallback(
    () => accessToken,
    [accessToken],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionError,
      signIn,
      signUp,
      signOut,
      authenticatedFetch,
      getAccessToken,
    }),
    [
      user,
      isLoading,
      sessionError,
      signIn,
      signUp,
      signOut,
      authenticatedFetch,
      getAccessToken,
    ],
  );

  const protectedChildren = isLoading ? (
    <main
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#0b0612] text-sm text-white/70"
    >
      Đang tải...
    </main>
  ) : (
    children
  );

  return (
    <AuthContext.Provider value={value}>
      {protectedChildren}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
