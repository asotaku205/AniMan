"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Flag, Megaphone, Radio, ShieldCheck, TrendingUp, Tv, UserCheck, UserX, Wand2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  AdminSettingsApiError,
  getAdminStats,
  type AdminStats,
} from "@/lib/admin-settings-api";
const VIEWS_CHART = [
  { t: "T2", anime: 420, phim: 180, manga: 320, novel: 90 }, { t: "T3", anime: 380, phim: 210, manga: 290, novel: 110 },
  { t: "T4", anime: 510, phim: 195, manga: 340, novel: 85 }, { t: "T5", anime: 460, phim: 230, manga: 310, novel: 130 },
  { t: "T6", anime: 590, phim: 270, manga: 390, novel: 145 }, { t: "T7", anime: 780, phim: 350, manga: 520, novel: 180 },
  { t: "CN", anime: 860, phim: 390, manga: 560, novel: 200 },
];
const USER_GROWTH = [
  { m: "T1", v: 82000 }, { m: "T2", v: 95000 }, { m: "T3", v: 103000 }, { m: "T4", v: 112000 },
  { m: "T5", v: 118000 }, { m: "T6", v: 128000 }, { m: "T7", v: 135000 }, { m: "T8", v: 141000 }, { m: "T9", v: 148320 },
];
const PIE_DATA = [
  { name: "Anime", value: 1840, color: "#f4536b" }, { name: "Phim", value: 620, color: "#d4a648" },
  { name: "Manga", value: 1540, color: "#a78bfa" }, { name: "Tiểu thuyết", value: 872, color: "#5e8a7a" },
];
const ACTIVITIES = [
  { msg: "Người dùng mới đăng ký: sakura_vn98", time: "2 phút trước", icon: UserCheck, color: "text-emerald-400" },
  { msg: "Anime mới được tải lên: Jujutsu Kaisen S4", time: "15 phút trước", icon: Tv, color: "text-pink-400" },
  { msg: "Báo cáo bình luận vi phạm #3842", time: "32 phút trước", icon: AlertTriangle, color: "text-amber-400" },
  { msg: "Watch Party mới: One Piece 1100+", time: "48 phút trước", icon: Radio, color: "text-cyan-400" },
  { msg: "Tác phẩm mới chờ duyệt: Manga fan-art", time: "1 giờ trước", icon: Wand2, color: "text-violet-400" },
  { msg: "Tài khoản bị khoá: spam_bot_01", time: "2 giờ trước", icon: AlertTriangle, color: "text-rose-400" },
];
const TT = { backgroundColor: "#1a0f2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#fff", fontSize: 12 };
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.08] ${className}`}>{children}</div>;
}

export default function DashboardClient({ go }: { go?: (id: string) => void }) {
  const { authenticatedFetch } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setStats(await getAdminStats(authenticatedFetch));
    } catch (error) {
      setLoadError(
        error instanceof AdminSettingsApiError
          ? error.message
          : "Không tải được số liệu. Hãy thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    void (async () => {
      await loadStats();
    })();
  }, [loadStats]);

  const cards = stats
    ? [
        { label: "Tổng người dùng", value: stats.totalUsers.toLocaleString("vi-VN"), sub: "Đếm từ bảng tài khoản", icon: UserCheck, color: "from-pink-500 to-rose-600" },
        { label: "Quản trị viên", value: stats.adminCount.toLocaleString("vi-VN"), sub: "Tài khoản có vai trò admin", icon: ShieldCheck, color: "from-violet-500 to-purple-600" },
        { label: "Tài khoản đã khóa", value: stats.suspendedCount.toLocaleString("vi-VN"), sub: "Trạng thái suspended", icon: UserX, color: "from-amber-500 to-orange-500" },
        { label: "Mới trong 7 ngày", value: stats.newUsersLast7Days.toLocaleString("vi-VN"), sub: "Đăng ký trong 7 ngày qua", icon: TrendingUp, color: "from-cyan-500 to-blue-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {loading ? (
        <Card className="p-5"><div className="text-sm text-white/60">Đang tải số liệu...</div></Card>
      ) : loadError ? (
        <Card className="p-5">
          <div className="text-sm text-rose-300">{loadError}</div>
          <button onClick={() => void loadStats()} className="mt-3 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white">
            Thử lại
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((s) => <Card key={s.label} className="p-5 hover:border-white/15 transition-colors"><div className="flex items-start justify-between mb-4"><div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}><s.icon className="w-5 h-5 text-white" /></div><span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Số thật</span></div><div className="text-2xl font-bold text-white">{s.value}</div><div className="text-xs text-white/50 mt-1">{s.label}</div><div className="text-[11px] text-white/30 mt-0.5">{s.sub}</div></Card>)}
        </div>
      )}
      <Card className="p-4"><div className="flex flex-wrap items-center gap-3"><span className="text-xs text-white/40 mr-1">Thao tác nhanh:</span>{[["anime", "Thêm anime", Tv], ["reports", "Xử lý báo cáo", Flag], ["studio", "Duyệt tác phẩm", Wand2], ["announcements", "Gửi thông báo", Megaphone]].map(([id, label, Icon]) => <button key={id as string} onClick={() => go?.(id as string)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/20 transition">{(() => { const I = Icon as React.ElementType; return <I className="w-3.5 h-3.5" />; })()}{label as string}</button>)}</div></Card>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 p-5"><div className="flex items-center justify-between mb-5"><div><div className="text-white font-semibold">Lượt xem theo nội dung <span className="ml-1 align-middle text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal">Dữ liệu demo</span></div><div className="text-xs text-white/40 mt-0.5">7 ngày gần nhất (nghìn lượt)</div></div><select className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-3 py-1.5 focus:outline-none"><option>7 ngày</option><option>30 ngày</option></select></div><ResponsiveContainer width="100%" height={210}><AreaChart data={VIEWS_CHART} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}><defs>{[["anime", "#f4536b"], ["phim", "#d4a648"], ["manga", "#a78bfa"], ["novel", "#5e8a7a"]].map(([k, c]) => <linearGradient key={k} id={`g${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={c} stopOpacity={0.3} /><stop offset="95%" stopColor={c} stopOpacity={0} /></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="t" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TT} /><Area type="monotone" dataKey="anime" stroke="#f4536b" fill="url(#ganime)" strokeWidth={2} name="Anime" /><Area type="monotone" dataKey="phim" stroke="#d4a648" fill="url(#gphim)" strokeWidth={2} name="Phim" /><Area type="monotone" dataKey="manga" stroke="#a78bfa" fill="url(#gmanga)" strokeWidth={2} name="Manga" /><Area type="monotone" dataKey="novel" stroke="#5e8a7a" fill="url(#gnovel)" strokeWidth={2} name="Tiểu thuyết" /></AreaChart></ResponsiveContainer></Card>
        <Card className="p-5"><div className="text-white font-semibold mb-1">Phân bổ nội dung <span className="ml-1 align-middle text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal">Dữ liệu demo</span></div><div className="text-xs text-white/40 mb-2">Tổng 4,872 tác phẩm</div><ResponsiveContainer width="100%" height={170}><PieChart><Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">{PIE_DATA.map((e) => <Cell key={e.name} fill={e.color} stroke="transparent" />)}</Pie><Tooltip contentStyle={TT} /></PieChart></ResponsiveContainer><div className="space-y-2 mt-2">{PIE_DATA.map((d) => <div key={d.name} className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /><span className="text-xs text-white/60">{d.name}</span></div><span className="text-xs text-white font-medium">{d.value.toLocaleString()}</span></div>)}</div></Card>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4"><Card className="xl:col-span-2 p-5"><div className="text-white font-semibold mb-1">Tăng trưởng người dùng <span className="ml-1 align-middle text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal">Dữ liệu demo</span></div><div className="text-xs text-white/40 mb-4">9 tháng gần nhất</div><ResponsiveContainer width="100%" height={150}><LineChart data={USER_GROWTH} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="m" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} /><Tooltip contentStyle={TT} formatter={(v: unknown) => [Number(v ?? 0).toLocaleString(), "Người dùng"]} /><Line type="monotone" dataKey="v" stroke="#d4a648" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></Card><Card className="p-5"><div className="flex items-center justify-between mb-4"><div className="text-white font-semibold">Hoạt động gần đây <span className="ml-1 align-middle text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-normal">Dữ liệu demo</span></div><button onClick={() => go?.("audit")} className="text-xs text-white/40 hover:text-white/70 transition">Xem tất cả</button></div><div className="space-y-3">{ACTIVITIES.map((a) => <div key={a.msg} className="flex items-start gap-3"><div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${a.color}`}><a.icon className="w-3.5 h-3.5" /></div><div className="flex-1 min-w-0"><div className="text-xs text-white/75 line-clamp-2">{a.msg}</div><div className="text-[10px] text-white/30 mt-0.5">{a.time}</div></div></div>)}</div></Card></div>
    </div>
  );
}
