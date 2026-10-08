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
import { setAdultAccessCookie } from "@/lib/adult-access";
import {
  login as loginRequest,
  confirmAdultAccess as confirmAdultAccessRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
} from "@/lib/auth-api";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  sessionError: string | null;
  signIn: (request: LoginRequest) => Promise<void>;
  signUp: (request: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
  confirmAdultAccess: () => Promise<void>;
  authenticatedFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
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
    if (session.user.adultAccessConfirmedAt) {
      setAdultAccessCookie();
    }
    setSessionError(null);
  }, []);

  const signUp = useCallback(async (request: RegisterRequest) => {
    const session = await registerRequest(request);
    setAccessToken(session.accessToken);
    setUser(session.user);
    setAdultAccessCookie();
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

  const confirmAdultAccess = useCallback(async () => {
    const confirmedUser = await confirmAdultAccessRequest(authenticatedFetch);
    setUser(confirmedUser);
    setAdultAccessCookie();
  }, [authenticatedFetch]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionError,
      signIn,
      signUp,
      signOut,
      confirmAdultAccess,
      authenticatedFetch,
    }),
    [
      user,
      isLoading,
      sessionError,
      signIn,
      signUp,
      signOut,
      confirmAdultAccess,
      authenticatedFetch,
    ],
  );

  const protectedChildren = isLoading ? (
    <main
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-[#0b0612] text-sm text-white/70"
    >
      Đang kiểm tra quyền truy cập...
    </main>
  ) : user && !user.adultAccessConfirmedAt ? (
    <PlatformAdultAccessGate />
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

function PlatformAdultAccessGate() {
  const { confirmAdultAccess } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitConfirmation = async () => {
    if (!confirmed || isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await confirmAdultAccess();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể xác nhận quyền truy cập AniMan.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0612] px-6 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <h1 className="text-3xl font-semibold">
          Xác nhận quyền truy cập AniMan
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/70">
          AniMan chỉ dành cho người từ đủ 18 tuổi. Xác nhận này dựa trên tự
          khai; chúng tôi lưu thời điểm xác nhận cho tài khoản và không lưu ngày
          sinh. Trình duyệt lưu cookie xác nhận tối đa một năm để chặn các trang
          trước khi tải nội dung.
        </p>
        <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm text-white/80">
          <input
            checked={confirmed}
            className="mt-1 accent-pink-500"
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          <span>Tôi xác nhận mình từ đủ 18 tuổi trở lên.</span>
        </label>
        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          className="mt-7 h-12 w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!confirmed || isSubmitting}
          onClick={() => void submitConfirmation()}
          type="button"
        >
          {isSubmitting ? "Đang xác nhận..." : "Xác nhận và tiếp tục"}
        </button>
      </section>
    </main>
  );
}
