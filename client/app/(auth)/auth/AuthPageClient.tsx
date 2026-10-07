"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, User, Check, AtSign } from "lucide-react";
import { Sakura } from "../../components/ui/Sakura";
import { SakuraMark } from "../../components/ui/Logo";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SignInFormData, SignUpFormData } from "./schema";
import { signInSchema, signUpSchema } from "./schema";
import Field from "./components/Field";
import { useAuth } from "../../auth/AuthProvider";

type AuthMode = "login" | "register";

export default function AuthPageClient({
  mode = "login",
}: {
  mode?: AuthMode;
}) {
  const [active, setActive] = useState<AuthMode>(mode);
  const [showPw, setShowPw] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { signIn, signUp, sessionError, isLoading } = useAuth();

  const loginForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onTouched",
    defaultValues: { rememberMe: false },
  });

  const registerForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: "onTouched",
  });
  const onSignInSubmit = async (data: SignInFormData) => {
    setSubmitError(null);
    try {
      await signIn({
        username: data.username,
        password: data.password,
        rememberMe: data.rememberMe ?? false,
      });
      router.replace("/");
    } catch (error: unknown) {
      setSubmitError(getAuthErrorMessage(error));
    }
  };
  const onSignUpSubmit = async (data: SignUpFormData) => {
    setSubmitError(null);
    try {
      await signUp(data);
      router.replace("/");
    } catch (error: unknown) {
      setSubmitError(getAuthErrorMessage(error));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0612] grid lg:grid-cols-2">
      {/* Left visual */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#3a0d3a_0%,_#0b0612_60%,_#000_100%)]" />
        <div className="absolute right-[-10%] top-1/3 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,#ff5e9c_0%,#ff2e7e_45%,transparent_70%)] blur-3xl opacity-50" />
        <Sakura count={18} />

        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <SakuraMark className="w-8 h-8" />
            <span
              style={{ fontFamily: "Shippori Mincho, serif" }}
              className="text-lg tracking-wider"
            >
              AniMan
            </span>
          </Link>
        </div>

        <div className="relative space-y-6">
          <div className="text-[11px] tracking-[0.4em] text-pink-300/70 uppercase">
            Chào mừng trở lại
          </div>
          <h1
            style={{ fontFamily: "Shippori Mincho, serif" }}
            className="text-white text-5xl leading-tight"
          >
            Biến ý tưởng,
            <br />
            Thành câu chuyện của riêng bạn.
          </h1>
          <p className="text-white/60 max-w-md leading-relaxed">
            Tham gia AniMan để xem truyện tranh, phim hoạt hình và tiểu thuyết,
            tạo phim hoạt hình từ truyện tranh của riêng bạn và chia sẻ với cộng
            đồng.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              "Xem cùng bạn bè qua Watch Party đồng bộ",
              "Vẽ truyện và xuất bản chỉ với vài bước",
              "Lưu tiến độ đọc/xem trên mọi thiết bị",
            ].map((b) => (
              <li
                key={b}
                className="flex items-center gap-3 text-sm text-white/70"
              >
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-rose-400 grid place-items-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/40">
          © AniMan 2026 — Nền tảng tiêu thụ và sáng tạo nội dung
        </div>
      </aside>

      {/* Right form */}
      <main className="relative flex items-center justify-center p-6 lg:p-12">
        <div className="absolute inset-0 lg:hidden bg-[radial-gradient(ellipse_at_top,_#3a0d3a_0%,_#0b0612_60%,_#000_100%)]" />
        <Link
          href="/"
          className="absolute top-6 left-6 lg:hidden inline-flex items-center gap-2 text-white"
        >
          <SakuraMark className="w-7 h-7" />
          <span style={{ fontFamily: "Shippori Mincho, serif" }}>AniMan</span>
        </Link>

        <div className="relative w-full max-w-md">
          {/* Tabs */}
          <div className="flex bg-white/5 border border-white/10 rounded-full p-1 mb-8">
            {(
              [
                { k: "login", label: "Đăng nhập" },
                { k: "register", label: "Đăng ký" },
              ] as const
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setActive(t.k)}
                className={`flex-1 h-10 rounded-full text-sm transition ${active === t.k ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-[0_0_20px_rgba(255,90,150,0.35)]" : "text-white/60 hover:text-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <h2
            className="text-3xl text-white"
            style={{ fontFamily: "Shippori Mincho, serif" }}
          >
            {active === "login"
              ? "Bắt đầu hành trình"
              : "Tạo một câu chuyện mới"}
          </h2>
          <p className="text-white/50 text-sm mt-2 mb-6">
            {active === "login"
              ? "Tiếp tục nơi bạn đã dừng lại."
              : "Chỉ mất chưa đến một phút."}
          </p>

          <form
            onSubmit={
              active === "login"
                ? loginForm.handleSubmit(onSignInSubmit)
                : registerForm.handleSubmit(onSignUpSubmit)
            }
            className="space-y-4"
          >
            {active === "register" && (
              <Field label="Tên hiển thị" icon={<User className="w-4 h-4" />}>
                <input
                  {...registerForm.register("displayName")}
                  type="text"
                  placeholder="Nguyễn Văn A"
                  className="bg-transparent outline-none flex-1 text-white placeholder:text-white/30 text-sm"
                />
                {registerForm.formState.errors.displayName && (
                  <p className="text-red-400 text-xs mt-1 ml-1">
                    {registerForm.formState.errors.displayName?.message}
                  </p>
                )}
              </Field>
            )}
            <Field label="Tên đăng nhập" icon={<AtSign className="w-4 h-4" />}>
              <input
                {...(active === "login"
                  ? loginForm.register("username")
                  : registerForm.register("username"))}
                type="text"
                placeholder="nguyenvana"
                pattern="[a-zA-Z0-9_]+"
                className="bg-transparent outline-none flex-1 text-white placeholder:text-white/30 text-sm"
              />
              {active === "login" && loginForm.formState.errors.username && (
                <p className="text-red-400 text-xs mt-1 ml-1">
                  {loginForm.formState.errors.username.message}
                </p>
              )}
              {active === "register" &&
                registerForm.formState.errors.username && (
                  <p className="text-red-400 text-xs mt-1 ml-1">
                    {registerForm.formState.errors.username.message}
                  </p>
                )}
            </Field>

            <Field label="Mật khẩu" icon={<Lock className="w-4 h-4" />}>
              <input
                {...(active === "login"
                  ? loginForm.register("password")
                  : registerForm.register("password"))}
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                className="bg-transparent outline-none flex-1 text-white placeholder:text-white/30 text-sm"
              />
              {active === "login" && loginForm.formState.errors.password && (
                <p className="text-red-400 text-xs mt-1 ml-1">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
              {active === "register" &&
                registerForm.formState.errors.password && (
                  <p className="text-red-400 text-xs mt-1 ml-1">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-white/40 hover:text-white"
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </Field>
            {active === "register" && (
              <Field
                label="Xác nhận mật khẩu"
                icon={<Lock className="w-4 h-4" />}
              >
                <input
                  {...registerForm.register("confirmPassword")}
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  className="bg-transparent outline-none flex-1 text-white placeholder:text-white/30 text-sm"
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 ml-1">
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-white/40 hover:text-white"
                >
                  {showPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </Field>
            )}
            {active === "login" ? (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                  <input
                    {...loginForm.register("rememberMe")}
                    type="checkbox"
                    className="accent-pink-500"
                  />
                  Ghi nhớ tôi
                </label>
                <Link
                  href="/quen-mat-khau"
                  className="text-pink-300 hover:text-pink-200"
                >
                  Quên mật khẩu?
                </Link>
              </div>
            ) : (
              <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer">
                <input
                  {...registerForm.register("agree")}
                  type="checkbox"
                  className="accent-pink-500 mt-0.5"
                />
                <span>
                  Tôi đồng ý với{" "}
                  <Link
                    href="/dieu-khoan"
                    className="text-pink-300 hover:text-pink-200"
                  >
                    Điều khoản dịch vụ
                  </Link>{" "}
                  và{" "}
                  <Link
                    href="/quyen-rieng-tu"
                    className="text-pink-300 hover:text-pink-200"
                  >
                    Chính sách riêng tư
                  </Link>{" "}
                  của AniMan.
                </span>
                {registerForm.formState.errors.agree && (
                  <p className="text-red-400 text-xs mt-1">
                    {registerForm.formState.errors.agree.message}
                  </p>
                )}
              </label>
            )}

            {(submitError || sessionError) && (
              <p role="alert" className="text-red-400 text-sm">
                {submitError ?? sessionError}
              </p>
            )}

            <button
              type="submit"
              disabled={
                isLoading ||
                (active === "login"
                  ? loginForm.formState.isSubmitting
                  : registerForm.formState.isSubmitting)
              }
              className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,90,150,0.4)] hover:opacity-90 transition disabled:opacity-50"
            >
              {active === "login"
                ? loginForm.formState.isSubmitting
                  ? "Đang xử lý..."
                  : "Đăng nhập"
                : registerForm.formState.isSubmitting
                  ? "Đang xử lý..."
                  : "Đăng ký"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6 flex items-center gap-3 text-[11px] text-white/40 tracking-widest uppercase">
            <span className="flex-1 h-px bg-white/10" />
            <span>hoặc tiếp tục với</span>
            <span className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { n: "Google", c: "from-red-500/20 to-yellow-500/20" },
              { n: "Apple", c: "from-white/20 to-white/5" },
              { n: "GitHub", c: "from-green-500/20 to-emerald-500/20" },
            ].map((p) => (
              <button
                key={p.n}
                type="button"
                className={`h-11 rounded-xl bg-gradient-to-br ${p.c} border border-white/10 text-sm text-white hover:border-white/25 transition`}
              >
                {p.n}
              </button>
            ))}
          </div>

          <div className="mt-8 text-center text-xs text-white/40">
            {active === "login" ? (
              <>
                Chưa có tài khoản?{" "}
                <button
                  onClick={() => setActive("register")}
                  className="text-pink-300 hover:text-pink-200 ml-2"
                >
                  Đăng ký miễn phí
                </button>
              </>
            ) : (
              <>
                Đã có tài khoản?{" "}
                <button
                  onClick={() => setActive("login")}
                  className="text-pink-300 hover:text-pink-200 ml-2"
                >
                  Đăng nhập
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function getAuthErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể hoàn tất yêu cầu xác thực.";
}
