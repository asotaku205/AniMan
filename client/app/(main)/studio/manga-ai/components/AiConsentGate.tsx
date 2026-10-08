"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  confirmAiDrawingConsent,
  getAiDrawingConsent,
  revokeAiDrawingConsent,
  type AiDrawingConsentStatus,
} from "@/lib/ai-consent-api";

type Props = {
  children: ReactNode;
  onEligibilityChange: (eligible: boolean, userId: string | null) => void;
  onRevoke: () => void;
};

export function AiConsentGate({
  children,
  onEligibilityChange,
  onRevoke,
}: Props) {
  const { user, isLoading: authLoading, authenticatedFetch } = useAuth();
  const requestVersionRef = useRef(0);
  const [status, setStatus] = useState<AiDrawingConsentStatus | null>(null);
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    setSaving(false);
    if (!user) {
      setStatus(null);
      setStatusUserId(null);
      onEligibilityChange(false, null);
      setLoading(false);
      return;
    }

    const requestUserId = user.id;
    setLoading(true);
    setError(null);
    try {
      const result = await getAiDrawingConsent(authenticatedFetch);
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setStatus(result);
      setStatusUserId(requestUserId);
      onEligibilityChange(result.eligible, requestUserId);
    } catch (requestError) {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setStatus(null);
      setStatusUserId(null);
      onEligibilityChange(false, null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể kiểm tra điều kiện sử dụng AI.",
      );
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [authenticatedFetch, onEligibilityChange, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const timer = setTimeout(() => void loadStatus(), 0);
    return () => {
      clearTimeout(timer);
      requestVersionRef.current += 1;
    };
  }, [authLoading, loadStatus]);

  const confirmConsent = async () => {
    if (!user || !status || !ageConfirmed || !noticeAccepted) {
      return;
    }
    const requestUserId = user.id;
    const requestVersion = ++requestVersionRef.current;
    setSaving(true);
    setError(null);
    try {
      const result = await confirmAiDrawingConsent(
        authenticatedFetch,
        status.currentNoticeVersion,
      );
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setStatus(result);
      setStatusUserId(requestUserId);
      onEligibilityChange(result.eligible, requestUserId);
    } catch (requestError) {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể lưu xác nhận.",
      );
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setSaving(false);
      }
    }
  };

  const revokeConsent = async () => {
    if (!user) {
      return;
    }
    const requestUserId = user.id;
    const requestVersion = ++requestVersionRef.current;
    setSaving(true);
    setError(null);
    try {
      const result = await revokeAiDrawingConsent(authenticatedFetch);
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setStatus(result);
      setStatusUserId(requestUserId);
      setAgeConfirmed(false);
      setNoticeAccepted(false);
      onEligibilityChange(false, null);
      onRevoke();
    } catch (requestError) {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể thu hồi xác nhận.",
      );
    } finally {
      if (requestVersionRef.current === requestVersion) {
        setSaving(false);
      }
    }
  };

  if (
    authLoading ||
    loading ||
    (user !== null && statusUserId !== user.id && error === null)
  ) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-white/60">
        <LoaderCircle size={16} className="animate-spin" />
        Đang kiểm tra điều kiện sử dụng AI...
      </div>
    );
  }

  if (status?.eligible && statusUserId === user?.id) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
            <CheckCircle2 size={13} />
            Đã xác nhận điều kiện AI 18+
          </span>
          <button
            type="button"
            onClick={() => void revokeConsent()}
            disabled={saving}
            className="text-[10px] text-white/40 underline hover:text-white/80 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Thu hồi"}
          </button>
        </div>
        {error && <ErrorMessage message={error} />}
        {children}
      </div>
    );
  }

  if (!user) {
    return (
      <ConsentNotice
        notice={status?.notice}
        error={error}
        onRetry={() => void loadStatus()}
        loginRequired
      />
    );
  }

  if (!status || statusUserId !== user.id) {
    return <ConsentNotice error={error} onRetry={() => void loadStatus()} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
        <div className="flex items-center gap-2 text-amber-200">
          <ShieldCheck size={18} />
          <h2 className="text-sm font-semibold">Điều kiện sử dụng AI</h2>
        </div>
        <p className="text-xs leading-relaxed text-white/70">{status.notice}</p>

        <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-white/80">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            className="mt-0.5 accent-pink-500"
          />
          <span>Tôi xác nhận mình từ đủ 18 tuổi trở lên.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-white/80">
          <input
            type="checkbox"
            checked={noticeAccepted}
            onChange={(event) => setNoticeAccepted(event.target.checked)}
            className="mt-0.5 accent-pink-500"
          />
          <span>
            Tôi đã đọc và chấp thuận thông báo xử lý dữ liệu AI ở trên.
          </span>
        </label>

        {error && <ErrorMessage message={error} />}

        <button
          type="button"
          onClick={() => void confirmConsent()}
          disabled={!ageConfirmed || !noticeAccepted || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <LoaderCircle size={14} className="animate-spin" />
          ) : (
            <Lock size={13} />
          )}
          {saving ? "Đang lưu xác nhận..." : "Xác nhận và mở AI"}
        </button>
      </div>
    </div>
  );
}

function ConsentNotice({
  notice,
  error,
  onRetry,
  loginRequired = false,
}: {
  notice?: string;
  error: string | null;
  onRetry: () => void;
  loginRequired?: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 text-white/80">
          {loginRequired ? <Lock size={16} /> : <AlertCircle size={16} />}
          <h2 className="text-sm font-semibold">
            {loginRequired
              ? "Đăng nhập để sử dụng AI"
              : "Chưa thể kiểm tra điều kiện"}
          </h2>
        </div>
        {notice && (
          <p className="text-xs leading-relaxed text-white/60">{notice}</p>
        )}
        {error && <ErrorMessage message={error} />}
        {loginRequired ? (
          <a
            href="/auth"
            className="inline-flex rounded-lg bg-pink-500 px-3 py-2 text-xs font-medium text-white hover:bg-pink-400"
          >
            Đăng nhập
          </a>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-red-300">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
