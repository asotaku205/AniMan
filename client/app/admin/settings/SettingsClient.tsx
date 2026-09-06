"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CFG = { darkDefault: true, sakura: true, watchParty: true, studioAI: true, communityWorks: true, maintenance: false, registration: true, premiumRequired: false };
const inputCard = "rounded-2xl bg-white/[0.04] border border-white/[0.08]";
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) { return <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-colors shrink-0" style={{ background: on ? "#d72638" : "rgba(255,255,255,0.15)" }}><span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} /></button>; }

export default function SettingsClient() {
  const [cfg, setCfg] = useState<typeof DEFAULT_CFG>(() => { try { const stored = localStorage.getItem("animan_admin_settings"); return stored ? { ...DEFAULT_CFG, ...JSON.parse(stored) } : DEFAULT_CFG; } catch { return DEFAULT_CFG; } });
  useEffect(() => { try { localStorage.setItem("animan_admin_settings", JSON.stringify(cfg)); } catch { /* storage unavailable */ } }, [cfg]);
  const toggle = (key: keyof typeof cfg) => { setCfg((current) => ({ ...current, [key]: !current[key] })); toast.success("Đã lưu cài đặt"); };
  const Row = ({ label, desc, setting }: { label: string; desc: string; setting: keyof typeof cfg }) => <div className="flex items-center justify-between py-4 border-b border-white/[0.05] last:border-0"><div><div className="text-sm font-medium text-white">{label}</div><div className="text-xs text-white/40 mt-0.5">{desc}</div></div><Toggle on={cfg[setting]} onChange={() => toggle(setting)} /></div>;
  return <div className="space-y-5 max-w-2xl">
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Giao diện & Hiệu ứng</p><Row label="Giao diện tối mặc định" desc="Người dùng mới sẽ thấy giao diện tối" setting="darkDefault" /><Row label="Hiệu ứng hoa anh đào" desc="Cánh hoa bay trên trang Library" setting="sakura" /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Tính năng</p><Row label="Watch Party" desc="Cho phép tạo phòng xem phim cùng nhau" setting="watchParty" /><Row label="Studio AI" desc="Bật AI hỗ trợ trong Studio" setting="studioAI" /><Row label="Tác phẩm cộng đồng" desc="Cho phép người dùng đăng tác phẩm" setting="communityWorks" /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Tài khoản & Bảo mật</p><Row label="Cho phép đăng ký mới" desc="Tắt để tạm dừng nhận thành viên mới" setting="registration" /><Row label="Yêu cầu Premium cho Studio" desc="Chỉ Premium mới dùng được Studio" setting="premiumRequired" /><Row label="Chế độ bảo trì" desc="Ẩn trang chính, hiện thông báo bảo trì" setting="maintenance" /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Thao tác hệ thống</p><div className="flex flex-wrap gap-3"><button onClick={() => toast.success("Đã xoá cache")} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition"><RefreshCw className="w-4 h-4" />Xóa cache</button><button onClick={() => toast.success("Đang tạo bản sao lưu...")} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition"><Download className="w-4 h-4" />Sao lưu DB</button><button onClick={() => toggle("maintenance")} className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-sm text-rose-300 hover:bg-rose-500/30 transition"><AlertTriangle className="w-4 h-4" />{cfg.maintenance ? "Tắt bảo trì" : "Bật bảo trì"}</button></div></section>
  </div>;
}
