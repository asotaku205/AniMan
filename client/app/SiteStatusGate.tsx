"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth/AuthProvider";
import { getSiteStatus } from "@/lib/admin-settings-api";
import {
  MAINTENANCE_DETECTED_EVENT,
  decideSiteAccess,
  type SiteStatus,
} from "@/lib/site-status";

const POLL_INTERVAL_MS = 30_000;

/**
 * Cong bao tri toan app (Lat 4).
 *
 * Dat trong AuthProvider trong layout: cho kiem tra trang thai lan dau
 * xong moi hien noi dung, de khong chop noi dung app truoc khi biet dang
 * bao tri. Bao tri bat: user thuong va khach thay trang bao tri, admin
 * thay thanh bao vang tren dau trang. Tai trang thai that bai thi mo
 * (hien app binh thuong, server se tu quyet dinh tung request).
 * Kiem tra lai moi 30 giay va ngay khi co API tra ve 503 bao tri.
 */
export default function SiteStatusGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [checked, setChecked] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      setStatus(await getSiteStatus());
    } catch {
      setStatus(null);
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await checkStatus();
    })();
    const timer = setInterval(() => {
      void checkStatus();
    }, POLL_INTERVAL_MS);
    const onMaintenance = () => {
      void checkStatus();
    };
    window.addEventListener(MAINTENANCE_DETECTED_EVENT, onMaintenance);
    return () => {
      clearInterval(timer);
      window.removeEventListener(MAINTENANCE_DETECTED_EVENT, onMaintenance);
    };
  }, [checkStatus]);

  if (isLoading || !checked) {
    return (
      <main
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-[#0b0612] text-sm text-white/70"
      >
        Đang tải...
      </main>
    );
  }

  const access = decideSiteAccess(status, user?.role);

  if (access === "maintenance-page") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0612] px-6 text-center">
        <h1 className="text-2xl font-bold text-white">AniMan đang bảo trì</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
          Hệ thống đang tạm dừng để bảo trì. Vui lòng quay lại sau.
        </p>
        <Link
          href="/auth"
          className="mt-6 rounded-xl bg-white/[0.06] border border-white/10 px-5 py-2.5 text-sm text-white/80 hover:text-white"
        >
          Đăng nhập quản trị viên
        </Link>
      </main>
    );
  }

  if (access === "admin-banner") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-sm text-amber-200">
          <span>
            Đang ở chế độ bảo trì. Chỉ quản trị viên thấy được nội dung này.
          </span>
          <Link href="/admin/settings" className="font-medium underline">
            Tắt bảo trì
          </Link>
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
