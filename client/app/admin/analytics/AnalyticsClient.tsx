"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const REVENUE = [
  { m: "T6", sub: 120, ads: 45 }, { m: "T7", sub: 145, ads: 52 },
  { m: "T8", sub: 138, ads: 48 }, { m: "T9", sub: 162, ads: 58 },
];
const TOP_CONTENT = [
  { title: "Frieren", views: "4.2M", growth: "+18%" }, { title: "Oshi no Ko", views: "3.1M", growth: "+12%" },
  { title: "JJK S4", views: "2.8M", growth: "+24%" }, { title: "One Piece 1100", views: "2.4M", growth: "+6%" },
  { title: "Vinland Saga S2", views: "1.8M", growth: "+3%" },
];
const TT = { backgroundColor: "#1a0f2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#fff", fontSize: 12 };
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.08] ${className}`}>{children}</div>;
}

export default function AnalyticsClient() {
  return <div className="space-y-5">
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card className="p-5"><div className="text-white font-semibold mb-1">Doanh thu (triệu VNĐ)</div><div className="text-xs text-white/40 mb-4">Subscription vs Quảng cáo</div><ResponsiveContainer width="100%" height={200}><BarChart data={REVENUE} margin={{ left: -30, right: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="m" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={TT} /><Bar dataKey="sub" name="Subscription" fill="#d72638" radius={[4, 4, 0, 0]} /><Bar dataKey="ads" name="Quảng cáo" fill="#d4a648" radius={[4, 4, 0, 0]} /><Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} /></BarChart></ResponsiveContainer></Card>
      <Card className="p-5"><div className="text-white font-semibold mb-1">Top nội dung tuần này</div><div className="text-xs text-white/40 mb-4">Theo lượt xem</div><div className="space-y-4">{TOP_CONTENT.map((content, index) => <div key={content.title} className="flex items-center gap-3"><span className="w-5 text-center text-sm font-bold text-white/30">{index + 1}</span><div className="flex-1"><div className="text-sm text-white font-medium mb-1.5">{content.title}</div><div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${100 - index * 14}%`, background: "linear-gradient(90deg,#f4536b,#d4a648)" }} /></div></div><div className="text-right shrink-0"><div className="text-sm text-white">{content.views}</div><div className="text-xs text-emerald-400">{content.growth}</div></div></div>)}</div></Card>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[{ l: "Thời gian xem trung bình", v: "42 phút", s: "mỗi phiên" }, { l: "Tỷ lệ giữ chân", v: "68.4%", s: "người dùng quay lại" }, { l: "Tỷ lệ chuyển đổi Premium", v: "21.7%", s: "từ free lên premium" }].map((stat) => <Card key={stat.l} className="p-5 text-center"><div className="text-3xl font-bold" style={{ background: "linear-gradient(90deg,#ffb7c5,#f4536b,#f0c75e,#ffb7c5)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{stat.v}</div><div className="text-sm text-white/70 mt-2">{stat.l}</div><div className="text-xs text-white/40 mt-1">{stat.s}</div></Card>)}</div>
  </div>;
}
