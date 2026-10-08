"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasAdultAccessCookie, setAdultAccessCookie } from "@/lib/adult-access";

export function AdultAccessPageClient({ returnTo }: { returnTo: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (hasAdultAccessCookie()) {
      router.replace(returnTo);
      router.refresh();
    }
  }, [returnTo, router]);

  const continueToAniMan = () => {
    if (!confirmed) {
      return;
    }

    setAdultAccessCookie();
    router.replace(returnTo);
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0612] px-6 py-12 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-pink-300">
          AniMan · Xác nhận độ tuổi
        </p>
        <h1 className="mt-5 text-3xl font-semibold">
          Dịch vụ chỉ dành cho người từ đủ 18 tuổi
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/70">
          Vui lòng xác nhận bạn đã đủ 18 tuổi trước khi tiếp tục. Đây là xác
          nhận tự khai, không phải quy trình xác minh danh tính hoặc ngày sinh.
          AniMan chỉ lưu thời điểm xác nhận cho tài khoản, không lưu ngày sinh.
          Với khách chưa đăng nhập, cookie xác nhận được lưu trên trình duyệt
          tối đa một năm.
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
        <button
          className="mt-7 h-12 w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!confirmed}
          onClick={continueToAniMan}
          type="button"
        >
          Tiếp tục vào AniMan
        </button>
      </section>
    </main>
  );
}
