"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { Bell, BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Feather, Film, Flag, Globe, KeyRound, LayoutDashboard, LogOut, Megaphone, Menu, MessageSquare, Radio, ScrollText, Search, Settings, Shield, Swords, Tags, Tv, Users, Wand2, X } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { ADMIN_DEMO_BADGE_TEXT, HIDDEN_ADMIN_NAV_IDS, NAV_GROUPS, PAGE_TITLE } from "../modules/AdminModules";

// ── Admin Page ──────────────────────────────────────────────────
export function AdminPage({ initialActive = "dashboard", children }: { initialActive?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [active, setActive] = useState(initialActive);
  const [sideOpen, setSideOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(["Tổng quan", "Quản lý nội dung", "Cộng đồng", "Kiểm duyệt & Kinh doanh", "Hệ thống"]);
  const [globalSearch, setGlobalSearch] = useState("");

  // Lát 1 (D1): ẩn tạm mục Phân quyền khỏi sidebar cho tới khi có mô hình vai trò.
  const visibleGroups = useMemo(
    () => NAV_GROUPS.map(g => ({ ...g, items: g.items.filter(i => !HIDDEN_ADMIN_NAV_IDS.includes(i.id)) })).filter(g => g.items.length > 0),
    [],
  );
  const allItems = useMemo(() => visibleGroups.flatMap(g => g.items), [visibleGroups]);
  const searchResults = globalSearch ? allItems.filter(i => i.label.toLowerCase().includes(globalSearch.toLowerCase())) : [];
  const toggleGroup = (l: string) => setExpanded(g => g.includes(l) ? g.filter(x => x !== l) : [...g, l]);
  const activeItem = allItems.find(i => i.id === active);
  const activeGroup = visibleGroups.find(g => g.items.some(i => i.id === active))?.label;
  const go = (id: string) => {
    setMobileOpen(false);
    router.push(id === "dashboard" ? "/admin" : `/admin/${id}`);
  };

  const SideContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`${mobile ? "w-72" : "w-full"} h-full flex flex-col`} style={{ background: "#0d0817", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 px-4 pt-5 pb-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#d72638,#d4a648)" }}>
            <Swords className="w-4 h-4 text-white" />
          </div>
          {(sideOpen || mobile) && (
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm leading-none">AniMan</div>
              <div className="text-[10px] text-white/40 mt-0.5 tracking-wider">ADMIN PANEL</div>
            </div>
          )}
          {!mobile && (
            <button onClick={() => setSideOpen(s => !s)} className="text-white/30 hover:text-white transition ml-auto">
              {sideOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {mobile && <button onClick={() => setMobileOpen(false)} className="text-white/30 hover:text-white transition ml-auto"><X className="w-4 h-4" /></button>}
        </div>
        {(sideOpen || mobile) && (
          <Link href="/" className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-white/50 hover:text-white text-xs transition">
            <Globe className="w-3.5 h-3.5" /> <span className="flex-1">Về trang chính</span> <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: "none" }}>
        {visibleGroups.map(g => (
          <div key={g.label} className="mb-1">
            {(sideOpen || mobile) && (
              <button onClick={() => toggleGroup(g.label)} className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold tracking-widest text-white/30 hover:text-white/50 transition uppercase">
                {g.label}<ChevronDown className={`w-3 h-3 transition-transform ${expanded.includes(g.label) ? "" : "-rotate-90"}`} />
              </button>
            )}
            {(expanded.includes(g.label) || !sideOpen) && g.items.map(item => {
              const on = active === item.id;
              return (
                <div key={item.id} className="px-2">
                  <Link href={item.id === "dashboard" ? "/admin" : `/admin/${item.id}`} onClick={() => setMobileOpen(false)}
                    title={!sideOpen && !mobile ? item.label : undefined}
                    className={`w-full flex items-center gap-3 py-2.5 rounded-xl transition-all mb-0.5 ${!sideOpen && !mobile ? "justify-center px-0" : "px-3"} ${on ? "text-white" : "text-white/50 hover:text-white hover:bg-white/[0.05]"}`}
                    style={on ? { background: "linear-gradient(90deg,rgba(215,38,56,0.22),rgba(212,166,72,0.08))", border: "1px solid rgba(215,38,56,0.22)" } : {}}>
                    <item.icon className={`w-4 h-4 shrink-0 ${on ? "text-[#f4536b]" : ""}`} />
                    {(sideOpen || mobile) && <span className="text-sm font-medium flex-1 text-left">{item.label}</span>}
                    {(sideOpen || mobile) && on && <span className="w-1.5 h-1.5 rounded-full bg-[#f4536b]" />}
                  </Link>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className={`flex items-center gap-3 ${!sideOpen && !mobile ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#d72638,#d4a648)" }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          {(sideOpen || mobile) && (
            <>
              <div className="flex-1 min-w-0"><div className="text-xs font-medium text-white truncate">{user?.displayName ?? user?.username ?? "Admin"}</div><div className="text-[10px] text-white/40">Quản trị viên</div></div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signOut();
                    router.replace("/auth");
                  } catch {
                    toast.error("Không thể đăng xuất khỏi phiên hiện tại.");
                  }
                }}
                className="text-white/30 hover:text-white transition"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen text-white" style={{ background: "#07040d", fontFamily: "'Be Vietnam Pro',system-ui,sans-serif" }}>
      <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#150d24", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" } }} />
      <div aria-hidden className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 1000px 600px at 0% 0%,rgba(215,38,56,0.06),transparent 60%),radial-gradient(ellipse 800px 500px at 100% 100%,rgba(212,166,72,0.04),transparent 60%)" }} />

      <aside className={`hidden md:flex shrink-0 sticky top-0 h-screen flex-col transition-all duration-300 ${sideOpen ? "w-64" : "w-[68px]"}`}>
        <SideContent />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full"><SideContent mobile /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex items-center gap-4 px-4 md:px-6 py-3 shrink-0"
          style={{ background: "rgba(7,4,13,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button className="md:hidden text-white/50 hover:text-white transition" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
          <div>
            <div className="text-white font-semibold">{PAGE_TITLE[active]}</div>
            <div className="text-xs text-white/30 hidden sm:block">Admin / {activeGroup} / {activeItem?.label}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Tìm module..." className="bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/40 w-48" />
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-2 left-0 w-56 rounded-xl overflow-hidden z-50" style={{ background: "#150d24", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {searchResults.map(r => (
                    <button key={r.id} onClick={() => { go(r.id); setGlobalSearch(""); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition text-left">
                      <r.icon className="w-4 h-4 text-white/40" />{r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { toast.info("Chưa có thông báo mới"); }} className="relative p-2 rounded-xl hover:bg-white/[0.06] text-white/50 hover:text-white transition" title="Thông báo">
              <Bell className="w-5 h-5" />
            </button>
            <Link href="/" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:border-white/20 text-xs transition">
              <Globe className="w-3.5 h-3.5" /> Về site
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {ADMIN_DEMO_BADGE_TEXT[active] && (
            <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-xs text-amber-200/90">
              {ADMIN_DEMO_BADGE_TEXT[active]}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminPage;


