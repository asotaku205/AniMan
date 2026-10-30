"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut, PenLine, Settings, User } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import SettingPanel from "../notification/components/SettingPanel";
import { PAGE_THEME } from "../studio/novel/components/WashiBookPage";
import {
  DEFAULT_NOVEL_DISPLAY,
  loadNovelDisplaySettings,
  saveNovelDisplaySettings,
  type NovelDisplaySettings,
} from "../studio/novel/lib/novelDisplay";

export default function SettingsClient() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [display, setDisplay] = useState<NovelDisplaySettings>(
    DEFAULT_NOVEL_DISPLAY,
  );

  useEffect(() => {
    setDisplay(loadNovelDisplaySettings());
  }, []);

  const set = (patch: Partial<NovelDisplaySettings>) => {
    setDisplay((prev) => {
      const next = { ...prev, ...patch };
      saveNovelDisplaySettings(patch);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0b0612] pt-8 pb-24">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-7 h-7 text-pink-300" />
          <h1
            className="text-2xl sm:text-3xl text-white"
            style={{ fontFamily: "Shippori Mincho, serif" }}
          >
            Cài đặt
          </h1>
        </div>

        {/* Tài khoản */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-pink-300" /> Tài khoản
          </h2>
          {isLoading ? (
            <p className="text-white/40 text-sm">Đang tải…</p>
          ) : user ? (
            <div className="space-y-2 text-sm">
              <p className="text-white/80">
                Tên hiển thị:{" "}
                <span className="text-white font-medium">
                  {user.displayName}
                </span>
              </p>
              <p className="text-white/80">
                Tên đăng nhập:{" "}
                <span className="text-white font-medium">
                  {user.username}
                </span>
              </p>
              <p className="text-white/80">
                Vai trò:{" "}
                <span className="text-white font-medium">
                  {user.role === "admin" ? "Quản trị viên" : "Người dùng"}
                </span>
              </p>
              <p className="text-white/80">
                Tham gia:{" "}
                <span className="text-white font-medium">
                  {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  void signOut().then(() => router.push("/"));
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          ) : (
            <div>
              <p className="text-white/50 text-sm">
                Chưa đăng nhập — đăng nhập để đồng bộ tài khoản và dùng AI.
              </p>
              <Link
                href="/auth"
                className="mt-3 inline-block rounded-lg bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-400"
              >
                Đăng nhập
              </Link>
            </div>
          )}
        </section>

        {/* Hiển thị Novel — dùng chung kho với Novel Studio */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-5">
          <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-300" /> Hiển thị Novel
            Studio
          </h2>
          
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-white/60 mb-2">Giao diện quyển sách</p>
              <div className="flex gap-2">
                {(Object.keys(PAGE_THEME) as (keyof typeof PAGE_THEME)[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      title={PAGE_THEME[t].label}
                      onClick={() => set({ theme: t })}
                      className="h-8 w-8 rounded-full border-2 transition"
                      style={{
                        borderColor:
                          display.theme === t ? "#fbbf24" : "transparent",
                      }}
                    >
                      <div
                        className="h-full w-full rounded-full"
                        style={{ background: PAGE_THEME[t].bg }}
                      />
                    </button>
                  ),
                )}
              </div>
            </div>
            <div>
              <p className="text-white/60 mb-2">Cỡ chữ</p>
              <div className="flex gap-1.5">
                {(["sm", "md", "lg", "xl"] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => set({ fontSize: sz })}
                    className={`h-8 w-8 rounded-lg border text-xs ${display.fontSize === sz ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-white/10 text-white/60 hover:text-white"}`}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white/60 mb-2">Giãn dòng</p>
              <div className="flex gap-1.5">
                {(["normal", "relaxed", "loose"] as const).map((lh) => (
                  <button
                    key={lh}
                    type="button"
                    onClick={() => set({ lineHeight: lh })}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${display.lineHeight === lh ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-white/10 text-white/60 hover:text-white"}`}
                  >
                    {lh === "normal"
                      ? "Chật"
                      : lh === "relaxed"
                        ? "Vừa"
                        : "Rộng"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-white/60 mb-2">Chế độ hiển thị khi viết</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => set({ writeMode: "book" })}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${display.writeMode === "book" ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-white/10 text-white/60 hover:text-white"}`}
                >
                  Quyển sách
                </button>
                <button
                  type="button"
                  onClick={() => set({ writeMode: "default" })}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${display.writeMode === "default" ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-white/10 text-white/60 hover:text-white"}`}
                >
                  Mặc định
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Thông báo — chung bộ toggle với trang Thông báo */}
        <section className="mb-5">
          <SettingPanel />
        </section>

        {/* Liên kết */}
        <section className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/my-works"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
          >
            <PenLine className="w-5 h-5 text-sky-300 mb-2" />
            <p className="text-white text-sm font-medium">
              Sáng tác của tôi
            </p>
            <p className="text-white/40 text-xs mt-1">
              Toàn bộ tiểu thuyết, manga, phim, thế giới và tác phẩm đã đăng.
            </p>
          </Link>
          <Link
            href="/profile"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
          >
            <User className="w-5 h-5 text-pink-300 mb-2" />
            <p className="text-white text-sm font-medium">Hồ sơ</p>
            <p className="text-white/40 text-xs mt-1">
              Thống kê, hoạt động và huy hiệu của Sơn.
            </p>
          </Link>
          <Link
            href="/studio/novel"
            className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
          >
            <BookOpen className="w-5 h-5 text-amber-300 mb-2" />
            <p className="text-white text-sm font-medium">Novel Studio</p>
            <p className="text-white/40 text-xs mt-1">
              Mở quyển sách và tiếp tục viết.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
}
