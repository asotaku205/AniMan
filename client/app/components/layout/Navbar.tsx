"use client";
import { useState, useRef, useEffect } from "react";
import {
  Search,
  Bell,
  Menu,
  Sparkles,
  X,
  ChevronRight,
  ChevronDown,
  Upload,
  Compass,
  Tv,
  Film,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Globe,
  Lock,
  Check,
  Palette,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/Button";
import { SakuraMark } from "../ui/Logo";
import { animeList, liveList } from "../data/catalog";
import { mangaList } from "../data/mangas";
import { novelList } from "../data/novels";
import { useAuth } from "@/app/auth/AuthProvider";

const primaryLinks = [
  { to: "/", label: "Trang chủ" },
  { to: "/studio", label: "Studio" },
  { to: "/forum", label: "Cộng đồng" },
];

const discoverItems = [
  {
    to: "/anime",
    label: "Anime",
    icon: <Tv className="w-4 h-4" />,
    desc: "Kho anime bản quyền",
  },
  {
    to: "/film",
    label: "Phim",
    icon: <Film className="w-4 h-4" />,
    desc: "Phim truyền hình / điện ảnh",
  },
  {
    to: "/manga",
    label: "Manga",
    icon: <BookOpen className="w-4 h-4" />,
    desc: "Truyện tranh đang hot",
  },
  {
    to: "/novel",
    label: "Tiểu thuyết",
    icon: <FileText className="w-4 h-4" />,
    desc: "Tiểu thuyết",
  },
  {
    to: "/community-works",
    label: "Sáng tác cộng đồng",
    icon: <Palette className="w-4 h-4" />,
    desc: "Tác phẩm cá nhân",
  },
  {
    to: "/watch-party",
    label: "Xem chung",
    icon: <Sparkles className="w-4 h-4" />,
    desc: "Xem cùng nhau",
  },
];

const isDiscoverActive = (pathname: string) =>
  discoverItems.some(
    (d) => pathname === d.to || pathname.startsWith(d.to + "/"),
  );

type QuickResult = { title: string; path: string; type: string; img: string };

function getQuickResults(q: string): QuickResult[] {
  if (!q.trim() || q.length < 2) return [];
  const lq = q.toLowerCase();
  const results: QuickResult[] = [];
  animeList.forEach((a) => {
    if (a.t.toLowerCase().includes(lq))
      results.push({
        title: a.t,
        path: `/anime/${a.slug}`,
        type: "Anime",
        img: a.img,
      });
  });
  liveList.forEach((a) => {
    if (a.t.toLowerCase().includes(lq))
      results.push({
        title: a.t,
        path: `/film/${a.slug}`,
        type: "Phim",
        img: a.img,
      });
  });
  mangaList.forEach((m) => {
    if (m.t.toLowerCase().includes(lq))
      results.push({
        title: m.t,
        path: `/manga/${m.slug}`,
        type: "Manga",
        img: m.cover,
      });
  });
  novelList.forEach((n) => {
    if (n.t.toLowerCase().includes(lq))
      results.push({
        title: n.t,
        path: `/novel/${n.slug}`,
        type: "Tiểu thuyết",
        img: n.cover,
      });
  });
  return results.slice(0, 5);
}

export function Navbar() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { user, isLoading, signOut } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const discoverRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const quick = getQuickResults(query);
  const profileRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = !isLoading && user !== null;

  async function handleLogout() {
    setLogoutError(null);
    try {
      await signOut();
      setProfileOpen(false);
      router.replace("/auth");
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Không thể đăng xuất khỏi phiên hiện tại.",
      );
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
      setQuery("");
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setFocused(false);
      if (
        discoverRef.current &&
        !discoverRef.current.contains(e.target as Node)
      )
        setDiscoverOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
      if (e.key === "Escape") {
        setFocused(false);
        setDiscoverOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!logoutError) return;
    const timeout = setTimeout(() => setLogoutError(null), 4000);
    return () => clearTimeout(timeout);
  }, [logoutError]);

  useEffect(() => {
    const open = () => router.push("/upload");
    document.addEventListener("sakura:open-upload", open);
    return () => document.removeEventListener("sakura:open-upload", open);
  }, [router]);

  useEffect(() => {
    const onPublished = (e: Event) => {
      const title = (e as CustomEvent)?.detail?.title as string | undefined;
      if (title) setToast(`Đã đăng "${title}" — xem trên hồ sơ của bạn`);
    };
    document.addEventListener("sakura:published", onPublished as EventListener);
    return () =>
      document.removeEventListener(
        "sakura:published",
        onPublished as EventListener,
      );
  }, []);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0612]/85">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center gap-3 lg:gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div
            className="relative w-9 h-9 rounded-xl grid place-items-center animate-glow-pulse"
            style={{
              background:
                "linear-gradient(135deg, #ff7a8c 0%, #d72638 55%, #b81e2e 100%)",
            }}
          >
            <span className="absolute inset-0 rounded-xl ring-1 ring-[#f0c75e]/60" />
            <SakuraMark className="w-5 h-5 relative" />
          </div>
          <div
            className="hidden sm:block font-jp-serif text-white tracking-wide"
            style={{ fontSize: "16px" }}
          >
            AniMan
          </div>
        </Link>

        {/* Nav links */}
        <nav className="hidden lg:flex items-center gap-0.5 ml-1">
          {/* Khám phá dropdown */}
          <div ref={discoverRef} className="relative">
            <button
              onClick={() => setDiscoverOpen((v) => !v)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] transition-all ${discoverOpen || isDiscoverActive(pathname) ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"}`}
            >
              <Compass className="w-3.5 h-3.5" /> Khám phá
              <ChevronDown
                className={`w-3.5 h-3.5 transition ${discoverOpen ? "rotate-180" : ""}`}
              />
            </button>
            {discoverOpen && (
              <div className="absolute top-full mt-2 left-0 w-72 bg-[#130d20] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden p-1.5 z-50">
                {discoverItems.map((d) => (
                  <Link
                    key={d.to}
                    href={d.to}
                    onClick={() => setDiscoverOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition group"
                  >
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/10 border border-pink-400/20 grid place-items-center text-pink-300 shrink-0">
                      {d.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-white text-sm group-hover:text-pink-200 transition">
                        {d.label}
                      </div>
                      <div className="text-white/40 text-[11px]">{d.desc}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {primaryLinks.map((l) => {
            const isActive =
              pathname === l.to ||
              (l.to !== "/" && pathname.startsWith(l.to + "/"));
            return (
              <Link
                key={l.to}
                href={l.to}
                className={`relative px-3 py-2 rounded-lg text-[13px] transition-all ${isActive ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"}`}
              >
                {l.label}
                {isActive && (
                  <span className="absolute -bottom-px left-3 right-3 h-[2px] rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Search bar */}
        <div ref={dropRef} className="relative hidden md:block">
          <form onSubmit={handleSubmit}>
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all w-48 lg:w-56 xl:w-64 ${focused ? "bg-[#1a0f2e] border-pink-400/50 shadow-[0_0_20px_rgba(255,90,150,0.2)]" : "bg-white/5 border-white/10"}`}
            >
              <Search className="w-4 h-4 text-pink-300/70 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="Tìm anime, manga…"
                className="bg-transparent outline-none text-[13px] text-white placeholder:text-white/30 flex-1 min-w-0"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-white/40 hover:text-white/70 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden xl:inline-block text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5">
                  ⌘K
                </kbd>
              )}
            </div>
          </form>

          {focused && (quick.length > 0 || query.length >= 2) && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-[#130d20] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden z-50">
              {quick.length > 0 ? (
                <>
                  <div className="px-4 py-2 border-b border-white/5 text-[10px] text-white/40 uppercase tracking-widest">
                    Gợi ý
                  </div>
                  {quick.map((r) => (
                    <Link
                      key={r.path}
                      href={r.path}
                      onClick={() => {
                        setFocused(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition group"
                    >
                      <img
                        src={r.img}
                        alt={r.title}
                        className="w-8 h-11 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate group-hover:text-pink-300 transition">
                          {r.title}
                        </div>
                        <div className="text-white/40 text-xs">{r.type}</div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-pink-300 transition" />
                    </Link>
                  ))}
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={() => {
                      setFocused(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-2 px-4 py-3 border-t border-white/5 text-pink-300/80 text-sm hover:bg-white/5 transition"
                  >
                    <Search className="w-3.5 h-3.5" /> Tìm kiếm "{query}"
                  </Link>
                </>
              ) : query.length >= 2 ? (
                <div className="px-4 py-6 text-center text-white/40 text-sm">
                  Không tìm thấy kết quả cho "{query}"
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Mobile search */}
        <Link
          href="/search"
          className="md:hidden p-2 rounded-full hover:bg-white/5 transition"
        >
          <Search className="w-5 h-5 text-white/80" />
        </Link>

        {/* Đăng tác phẩm — Upload button */}
        {isAuthenticated && (
          <Button
            onClick={() => router.push("/upload")}
            className="hidden sm:inline-flex btn-son border-0 rounded-full px-3 lg:px-4 h-9"
          >
            <Upload className="w-4 h-4 mr-1" />{" "}
            <span className="hidden lg:inline">Đăng</span>
            <span className="lg:hidden">Đăng</span>
          </Button>
        )}

        {/* Notification bell */}
        {isAuthenticated && (
          <Link
            href="/notification"
            className="relative p-2 rounded-full hover:bg-white/5 transition shrink-0"
          >
            <Bell className="w-5 h-5 text-white/80" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
          </Link>
        )}
        {/* Avatar */}
        {isLoading ? (
          <div aria-hidden="true" className="w-9 h-9 shrink-0" />
        ) : user ? (
          <div className="relative" ref={profileRef}>
            <Button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label={user.displayName}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 ring-2 ring-pink-400/40 hover:ring-pink-400/60 transition shrink-0"
            ></Button>
            {profileOpen === true && (
              <div className="absolute top-full right-0 mt-2  text-white bg-[#130d20] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden p-1.5 z-50">
                <Link
                  href="/profile"
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition group"
                >
                  <User className="w-4 h-4 text-pink-300/70 mt-0.5" />
                  Hồ sơ
                </Link>
                <Link
                  href="/settings"
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition group"
                >
                  <Settings className="w-4 h-4 text-pink-300/70 mt-0.5" />
                  Cài đặt
                </Link>
                <Link
                  href="/admin"
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition group color border border-[#d4a648]/35 bg-[#d4a648]/10 hover:bg-[#d4a648]/20 hover:border-[#d4a648]/60 shrink-0"
                >
                  <LayoutDashboard className="w-4 h-4 text-pink-300/70 mt-0.5" />
                  Admin
                </Link>
                <Button
                  onClick={() => void handleLogout()}
                  className="flex w-full items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition group"
                >
                  <LogOut className="w-4 h-4 text-pink-300/70 mt-0.5" />
                  Đăng xuất
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="ml-6">
            <Link
              href="/auth"
              className="flex items-center gap-2 px-3 py-2 rounded-full  text-white text-sm  btn-son"
            >
              <Lock className="w-4 h-4" /> Tham gia ngay
            </Link>
          </div>
        )}
        {/* Mobile menu */}
        <button
          className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 transition"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? (
            <X className="w-5 h-5 text-white" />
          ) : (
            <Menu className="w-5 h-5 text-white" />
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {menuOpen && (
        <div className="lg:hidden bg-[#0b0612]/95 backdrop-blur-xl px-4 py-3 space-y-1 max-h-[80vh] overflow-y-auto">
          {[
            ...primaryLinks.slice(0, 1),
            ...discoverItems,
            ...primaryLinks.slice(1),
          ].map((l) => {
            const isActive =
              pathname === l.to ||
              (l.to !== "/" && pathname.startsWith(l.to + "/"));
            return (
              <Link
                key={l.to}
                href={l.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm transition ${isActive ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"}`}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/upload");
            }}
            className="w-full text-left flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-pink-300 hover:bg-white/5 transition"
          >
            <Upload className="w-4 h-4" /> Đăng tác phẩm
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-[#1a0f2e] border border-pink-400/40 text-white text-sm shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-2">
          <Check className="w-4 h-4 text-pink-300" /> {toast}
        </div>
      )}
      {logoutError && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-full bg-[#1a0f2e] border border-red-400/40 text-red-200 text-sm shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
        >
          {logoutError}
        </div>
      )}
    </header>
  );
}
