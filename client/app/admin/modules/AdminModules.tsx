"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard, Tv, Film, BookOpen, Feather, Users, Wand2,
  Radio, MessageSquare, CalendarDays, BarChart3, Settings,
  Bell, Search, Menu, X, ChevronRight, ChevronDown,
  Eye, Star, Shield, Ban, CheckCircle, Plus, Edit, Trash2,
  Filter, Download, AlertTriangle, Check, XCircle, Globe, Hash,
  RefreshCw, UserCheck, Crown,
  Swords, LogOut, ChevronLeft, Flag, CreditCard, KeyRound,
  Megaphone, ScrollText, Send, Pin, Lock, Unlock, Save,
  Tags, GripVertical, Upload, Image as ImageIcon, FileVideo,
  Link2, Clapperboard,
} from "lucide-react";

// ── Seed data ───────────────────────────────────────────────────
export type Episode = { id: number; num: number; title: string; duration: string; videoName: string; videoSize: string; published: boolean };
export type Chapter = { id: number; num: number; title: string; pages: number; published: boolean };
export type Content = { id: number; title: string; studio: string; year: number; ep: number; status: string; score: number; views: string; tags: string[]; type: string; episodes?: Episode[]; chapters?: Chapter[] };
export const CONTENT_SEED: Content[] = [
  { id: 1, title: "Jujutsu Kaisen", studio: "MAPPA", year: 2023, ep: 24, status: "Đang chiếu", score: 8.9, views: "2.4M", tags: ["Action", "Fantasy"], type: "anime" },
  { id: 2, title: "Vinland Saga S2", studio: "MAPPA", year: 2023, ep: 24, status: "Đã hoàn thành", score: 9.1, views: "1.8M", tags: ["Historical"], type: "anime" },
  { id: 3, title: "Oshi no Ko", studio: "Doga Kobo", year: 2023, ep: 11, status: "Đã hoàn thành", score: 8.7, views: "3.1M", tags: ["Drama"], type: "anime" },
  { id: 4, title: "Frieren", studio: "Madhouse", year: 2023, ep: 28, status: "Đang chiếu", score: 9.3, views: "4.2M", tags: ["Fantasy"], type: "anime" },
  { id: 5, title: "Sousou no Frieren S2", studio: "Madhouse", year: 2024, ep: 0, status: "Sắp ra mắt", score: 0, views: "—", tags: ["Fantasy"], type: "anime" },
];

export type User = { id: number; name: string; email: string; role: string; joined: string; status: string; premium: boolean; reports: number; avatar?: string };
export const USER_SEED: User[] = [
  { id: 1, name: "sakura_vn98", email: "sakura@mail.com", role: "user", joined: "01/09/2026", status: "active", premium: true, reports: 0 },
  { id: 2, name: "manga_otaku", email: "otaku@mail.com", role: "creator", joined: "15/07/2026", status: "active", premium: true, reports: 1 },
  { id: 3, name: "anime_lord_vn", email: "lord@mail.com", role: "moderator", joined: "10/03/2026", status: "active", premium: false, reports: 0 },
  { id: 4, name: "spam_bot_01", email: "spam@fake.com", role: "user", joined: "03/09/2026", status: "banned", premium: false, reports: 12 },
  { id: 5, name: "novel_writer", email: "writer@mail.com", role: "creator", joined: "20/08/2026", status: "active", premium: true, reports: 0 },
];

export type Work = { id: number; title: string; author: string; type: string; pages: number; submitted: string; status: string };
export const WORK_SEED: Work[] = [
  { id: 1, title: "Naruto × Hà Nội", author: "manga_otaku", type: "Manga", pages: 12, submitted: "03/09/2026", status: "pending" },
  { id: 2, title: "Kiếm Sĩ Đêm Thăng Long", author: "novel_writer", type: "Novel", pages: 8240, submitted: "02/09/2026", status: "pending" },
  { id: 3, title: "AnimLab: Rồng Hạ Long", author: "sakura_vn98", type: "Animation", pages: 0, submitted: "01/09/2026", status: "approved" },
  { id: 4, title: "Fan comic: Demon Slayer VN arc", author: "anime_lord_vn", type: "Manga", pages: 24, submitted: "30/08/2026", status: "rejected" },
];

export type Party = { id: string; title: string; host: string; viewers: number; max: number; started: string; status: string };
export const PARTY_SEED: Party[] = [
  { id: "WP-001", title: "One Piece 1102", host: "watch_party_king", viewers: 48, max: 100, started: "20:30", status: "live" },
  { id: "WP-002", title: "JJK Marathon", host: "sakura_vn98", viewers: 32, max: 50, started: "19:00", status: "live" },
  { id: "WP-003", title: "Frieren tập 28 premiere", host: "manga_otaku", viewers: 91, max: 100, started: "21:00", status: "live" },
  { id: "WP-004", title: "Studio Ghibli night", host: "anime_lord_vn", viewers: 0, max: 30, started: "—", status: "scheduled" },
];

export type Thread = { id: number; title: string; author: string; replies: number; reports: number; cat: string; time: string; pinned: boolean };
export const FORUM_SEED: Thread[] = [
  { id: 1, title: "Frieren tập 28 có ending hay nhất mùa?", author: "sakura_vn98", replies: 142, reports: 0, cat: "Thảo luận", time: "1 giờ trước", pinned: true },
  { id: 2, title: "[SPOILER] Kết thúc JJK season 4", author: "anime_lord_vn", replies: 88, reports: 3, cat: "Anime", time: "3 giờ trước", pinned: false },
  { id: 3, title: "Studio cần thêm thành viên vẽ background", author: "novel_writer", replies: 23, reports: 0, cat: "Tuyển thành viên", time: "5 giờ trước", pinned: false },
  { id: 4, title: "Nội dung vi phạm: chia sẻ link lậu", author: "spam_bot_01", replies: 2, reports: 8, cat: "Tin tức", time: "6 giờ trước", pinned: false },
];

export type Sched = { id: number; time: string; title: string; ep: string; day: string; type: string };
export const SCHEDULE_SEED: Sched[] = [
  { id: 1, time: "07:00", title: "Naruto Shippuden", ep: "Tập 142", day: "T2-T6", type: "Anime" },
  { id: 2, time: "09:30", title: "One Piece", ep: "Tập 1102", day: "CN", type: "Anime" },
  { id: 3, time: "12:00", title: "Frieren", ep: "Tập 28", day: "T7", type: "Anime" },
  { id: 4, time: "14:00", title: "Jujutsu Kaisen", ep: "Tập 48", day: "T3, T5", type: "Anime" },
  { id: 5, time: "20:00", title: "Vinland Saga", ep: "Tập 24", day: "Thứ Tư", type: "Anime" },
  { id: 6, time: "21:30", title: "Hana yori dango", ep: "Tập 7", day: "T6", type: "Phim" },
];

export type Report = { id: number; target: string; type: string; reason: string; reporter: string; time: string; status: string; severity: string };
export const REPORT_SEED: Report[] = [
  { id: 3842, target: "Bình luận trong 'Kết thúc JJK'", type: "Bình luận", reason: "Ngôn từ thù ghét", reporter: "sakura_vn98", time: "32 phút trước", status: "open", severity: "high" },
  { id: 3841, target: "spam_bot_01", type: "Người dùng", reason: "Spam link quảng cáo", reporter: "manga_otaku", time: "1 giờ trước", status: "open", severity: "high" },
  { id: 3838, target: "Fan comic: Demon Slayer VN arc", type: "Tác phẩm", reason: "Vi phạm bản quyền", reporter: "anime_lord_vn", time: "3 giờ trước", status: "open", severity: "medium" },
  { id: 3835, target: "Watch Party 'Ghibli night'", type: "Watch Party", reason: "Nội dung không phù hợp", reporter: "novel_writer", time: "5 giờ trước", status: "open", severity: "low" },
  { id: 3830, target: "Bình luận trong 'Frieren'", type: "Bình luận", reason: "Spoiler không che", reporter: "sakura_vn98", time: "hôm qua", status: "resolved", severity: "low" },
];

export type Txn = { id: string; user: string; plan: string; amount: number; method: string; date: string; status: string };
export const TXN_SEED: Txn[] = [
  { id: "TXN-90231", user: "sakura_vn98", plan: "Premium năm", amount: 899000, method: "Momo", date: "03/09/2026", status: "paid" },
  { id: "TXN-90228", user: "manga_otaku", plan: "Premium tháng", amount: 99000, method: "VNPay", date: "03/09/2026", status: "paid" },
  { id: "TXN-90225", user: "novel_writer", plan: "Creator Pro", amount: 199000, method: "Thẻ tín dụng", date: "02/09/2026", status: "paid" },
  { id: "TXN-90219", user: "anime_lord_vn", plan: "Premium tháng", amount: 99000, method: "ZaloPay", date: "02/09/2026", status: "failed" },
  { id: "TXN-90211", user: "guest_2211", plan: "Premium tháng", amount: 99000, method: "Momo", date: "01/09/2026", status: "refunded" },
];

const REVENUE = [{ m: "T5", v: 168 }, { m: "T6", v: 165 }, { m: "T7", v: 197 }, { m: "T8", v: 186 }, { m: "T9", v: 220 }];

export type Audit = { id: number; actor: string; action: string; target: string; time: string; ip: string };
export const AUDIT_SEED: Audit[] = [
  { id: 1, actor: "Admin Hệ thống", action: "Khoá tài khoản", target: "spam_bot_01", time: "03/09/2026 14:22", ip: "113.161.0.12" },
  { id: 2, actor: "anime_lord_vn", action: "Duyệt tác phẩm", target: "AnimLab: Rồng Hạ Long", time: "03/09/2026 11:08", ip: "42.116.5.90" },
  { id: 3, actor: "Admin Hệ thống", action: "Cập nhật cài đặt", target: "Chế độ bảo trì → tắt", time: "02/09/2026 22:40", ip: "113.161.0.12" },
  { id: 4, actor: "anime_lord_vn", action: "Xoá bình luận", target: "#comment 88213", time: "02/09/2026 19:15", ip: "42.116.5.90" },
  { id: 5, actor: "Admin Hệ thống", action: "Đăng thông báo", target: "Bảo trì hệ thống 04/09", time: "01/09/2026 09:00", ip: "113.161.0.12" },
];

export type Announce = { id: number; title: string; body: string; audience: string; date: string; status: string; image?: string };
export const ANNOUNCE_SEED: Announce[] = [
  { id: 1, title: "Bảo trì hệ thống 04/09", body: "Hệ thống sẽ bảo trì từ 02:00–04:00 sáng.", audience: "Tất cả", date: "01/09/2026", status: "sent" },
  { id: 2, title: "Ra mắt Studio AnimationLab", body: "Công cụ tạo animation bằng AI đã có mặt cho Creator.", audience: "Creator", date: "28/08/2026", status: "sent" },
];

export type Category = { id: number; name: string; slug: string; type: string; count: number; color: string; active: boolean; desc: string; cover?: string };
export const CATEGORY_SEED: Category[] = [
  { id: 1, name: "Hành động", slug: "hanh-dong", type: "genre", count: 842, color: "pink", active: true, desc: "Anime/phim nhiều cảnh chiến đấu, hành động" },
  { id: 2, name: "Giả tưởng", slug: "gia-tuong", type: "genre", count: 731, color: "violet", active: true, desc: "Thế giới phép thuật, siêu nhiên" },
  { id: 3, name: "Lãng mạn", slug: "lang-man", type: "genre", count: 654, color: "pink", active: true, desc: "Chủ đề tình cảm, tình yêu" },
  { id: 4, name: "Học đường", slug: "hoc-duong", type: "genre", count: 512, color: "cyan", active: true, desc: "Bối cảnh trường học" },
  { id: 5, name: "Kinh dị", slug: "kinh-di", type: "genre", count: 128, color: "red", active: false, desc: "Nội dung rùng rợn, 18+" },
  { id: 6, name: "isekai", slug: "isekai", type: "tag", count: 389, color: "amber", active: true, desc: "Chuyển sinh sang thế giới khác" },
  { id: 7, name: "shounen", slug: "shounen", type: "tag", count: 967, color: "blue", active: true, desc: "Hướng đến độc giả nam trẻ" },
  { id: 8, name: "slice-of-life", slug: "slice-of-life", type: "tag", count: 274, color: "green", active: true, desc: "Đời thường nhẹ nhàng" },
  { id: 9, name: "Thảo luận", slug: "thao-luan", type: "forum", count: 4821, color: "cyan", active: true, desc: "Chuyên mục thảo luận chung" },
  { id: 10, name: "Tuyển thành viên", slug: "tuyen-thanh-vien", type: "forum", count: 312, color: "violet", active: true, desc: "Tuyển cộng tác viên studio" },
  { id: 11, name: "Tin tức", slug: "tin-tuc", type: "forum", count: 890, color: "amber", active: true, desc: "Tin tức anime/manga" },
  { id: 12, name: "Nhật Bản", slug: "nhat-ban", type: "country", count: 3120, color: "red", active: true, desc: "Sản xuất tại Nhật Bản" },
  { id: 13, name: "Hàn Quốc", slug: "han-quoc", type: "country", count: 284, color: "blue", active: true, desc: "Sản xuất tại Hàn Quốc" },
  { id: 14, name: "Trung Quốc", slug: "trung-quoc", type: "country", count: 196, color: "amber", active: true, desc: "Donghua Trung Quốc" },
];
export const CAT_TYPES: { key: string; label: string }[] = [
  { key: "genre", label: "Thể loại" },
  { key: "tag", label: "Tag" },
  { key: "forum", label: "Danh mục diễn đàn" },
  { key: "country", label: "Quốc gia" },
];
export const catTypeLabel = (t: string) => CAT_TYPES.find(c => c.key === t)?.label ?? t;
export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

export const NAV_GROUPS = [
  { label: "Tổng quan", items: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "analytics", label: "Báo cáo & Phân tích", icon: BarChart3 },
  ]},
  { label: "Quản lý nội dung", items: [
    { id: "anime", label: "Anime", icon: Tv },
    { id: "phim", label: "Phim live-action", icon: Film },
    { id: "manga", label: "Manga", icon: BookOpen },
    { id: "novel", label: "Tiểu thuyết", icon: Feather },
    { id: "categories", label: "Danh mục", icon: Tags },
    { id: "schedule", label: "Lịch phát sóng", icon: CalendarDays },
  ]},
  { label: "Cộng đồng", items: [
    { id: "users", label: "Người dùng", icon: Users },
    { id: "studio", label: "Studio & Tác phẩm", icon: Wand2 },
    { id: "watchparty", label: "Watch Party", icon: Radio },
    { id: "forum", label: "Diễn đàn", icon: MessageSquare },
  ]},
  { label: "Kiểm duyệt & Kinh doanh", items: [
    { id: "reports", label: "Báo cáo vi phạm", icon: Flag },
    { id: "billing", label: "Thanh toán & Gói", icon: CreditCard },
  ]},
  { label: "Hệ thống", items: [
    { id: "roles", label: "Phân quyền", icon: KeyRound },
    { id: "announcements", label: "Thông báo", icon: Megaphone },
    { id: "audit", label: "Nhật ký hoạt động", icon: ScrollText },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ]},
];

export const PAGE_TITLE: Record<string, string> = {
  dashboard: "Dashboard", analytics: "Báo cáo & Phân tích",
  anime: "Quản lý Anime", phim: "Quản lý Phim live-action",
  manga: "Quản lý Manga", novel: "Quản lý Tiểu thuyết",
  categories: "Quản lý Danh mục", schedule: "Lịch phát sóng", users: "Người dùng",
  studio: "Studio & Tác phẩm cộng đồng", watchparty: "Watch Party",
  forum: "Diễn đàn", reports: "Báo cáo vi phạm",
  billing: "Thanh toán & Gói cước", roles: "Phân quyền & Vai trò",
  announcements: "Thông báo hệ thống", audit: "Nhật ký hoạt động",
  settings: "Cài đặt hệ thống",
};

/**
 * Lát 1 (29/10/2026, quyết định D1): nhãn trung thực trên các màn hình
 * chưa có dữ liệu thật. Màn hình không có trong bảng này thì không gắn
 * nhãn (dashboard, users, audit, settings sẽ thành dữ liệu thật ở Lát 2-4;
 * studio gắn nhãn riêng cho tới Lát 2A). Khi một màn hình thành thật thì
 * xóa mục của nó khỏi bảng này trong cùng lát cắt đó.
 */
export const ADMIN_DEMO_BADGE_TEXT: Record<string, string> = {
  analytics: "Dữ liệu demo: số liệu và biểu đồ trong màn hình này chưa lấy từ hệ thống thật.",
  anime: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  phim: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  manga: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  novel: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  categories: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  schedule: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  studio: "Dữ liệu demo, đang hoàn thiện: duyệt và đăng tác phẩm của user sẽ làm thật ở Lát 2A.",
  watchparty: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  forum: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  reports: "Dữ liệu demo: các thay đổi ở đây chưa lưu thật.",
  billing: "Dữ liệu demo: AniMan miễn phí, không có thanh toán thật.",
  announcements: "Dữ liệu demo: thông báo ở đây chưa gửi đi đâu.",
};

/** Mục sidebar ẩn tạm theo quyết định D1 (roles, cho tới khi có mô hình vai trò). Route trực tiếp vẫn mở được. */
export const HIDDEN_ADMIN_NAV_IDS: string[] = ["roles"];

export const SON = { background: "linear-gradient(135deg,#ff7a8c,#d72638,#b81e2e)" };
const TT = { backgroundColor: "#1a0f2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#fff", fontSize: 12 };
const vnd = (n: number) => n.toLocaleString("vi-VN") + "₫";

// ── Primitives ──────────────────────────────────────────────────
export function Bdg({ c = "gray", children }: { c?: string; children: React.ReactNode }) {
  const m: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    red: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    yellow: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    pink: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    gray: "bg-white/10 text-white/60 border-white/10",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${m[c] ?? m.gray}`}>{children}</span>;
}

export function SBdg({ s }: { s: string }) {
  if (["Đang chiếu", "active", "live", "approved", "paid", "sent", "resolved"].includes(s))
    return <Bdg c="green">{{ active: "Hoạt động", approved: "Đã duyệt", live: "LIVE", paid: "Thành công", sent: "Đã gửi", resolved: "Đã xử lý" }[s] ?? s}</Bdg>;
  if (["Đã hoàn thành", "scheduled", "draft"].includes(s))
    return <Bdg c="blue">{{ scheduled: "Lên lịch", draft: "Bản nháp" }[s] ?? s}</Bdg>;
  if (["Sắp ra mắt", "pending", "open", "refunded"].includes(s))
    return <Bdg c="yellow">{{ pending: "Chờ duyệt", open: "Chờ xử lý", refunded: "Hoàn tiền" }[s] ?? s}</Bdg>;
  if (["banned", "suspended", "rejected", "failed", "dismissed"].includes(s))
    return <Bdg c="red">{{ banned: "Đã khoá", suspended: "Đã khóa", rejected: "Từ chối", failed: "Thất bại", dismissed: "Đã bỏ qua" }[s] ?? s}</Bdg>;
  return <Bdg>{s}</Bdg>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.08] ${className}`}>{children}</div>;
}

export function Btn({ icon: I, color = "d", title: t, onClick }: { icon: React.ElementType; color?: string; title?: string; onClick?: () => void }) {
  const c = color === "r" ? "hover:bg-rose-500/20 hover:text-rose-400" : color === "g" ? "hover:bg-emerald-500/20 hover:text-emerald-400" : color === "a" ? "hover:bg-amber-500/20 hover:text-amber-400" : "hover:bg-white/10 hover:text-white";
  return (
    <button onClick={onClick} title={t} className={`p-1.5 rounded-lg text-white/40 transition ${c}`}>
      <I className="w-4 h-4" />
    </button>
  );
}

export function PrimaryBtn({ icon: I, children, onClick, className = "" }: { icon?: React.ElementType; children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-white font-medium hover:brightness-110 transition ${className}`} style={SON}>
      {I && <I className="w-4 h-4" />}{children}
    </button>
  );
}

export function GhostBtn({ icon: I, children, onClick }: { icon?: React.ElementType; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white hover:border-white/20 transition">
      {I && <I className="w-4 h-4" />}{children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl overflow-hidden animate-[fadeIn_.2s_ease-out]`} style={{ background: "#100a1d", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-5 max-h-[65vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.08]">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-xs text-white/50 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
export const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50";

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative w-11 h-6 rounded-full transition-colors shrink-0" style={{ background: on ? "#d72638" : "rgba(255,255,255,0.15)" }}>
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export function ImageUpload({ label, value, onChange, ratio = "aspect-[2/3]", hint }: { label: string; value: string; onChange: (v: string) => void; ratio?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const accept = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Chỉ chấp nhận file ảnh"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Ảnh vượt quá 5MB"); return; }
    onChange(URL.createObjectURL(f));
  };
  return (
    <div className="mb-4">
      <span className="block text-xs text-white/50 mb-1.5">{label}</span>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => accept(e.target.files?.[0])} />
      {value ? (
        <div className={`relative ${ratio} w-full max-w-[180px] rounded-xl overflow-hidden border border-white/10 group`}>
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button onClick={() => ref.current?.click()} className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => onChange("")} className="p-2 rounded-lg bg-rose-500/30 text-rose-200 hover:bg-rose-500/50 transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
          className={`${ratio} w-full max-w-[180px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition ${drag ? "border-[#d72638] bg-[#d72638]/10" : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"}`}>
          <ImageIcon className="w-6 h-6 text-white/30" />
          <span className="text-xs text-white/40 px-3 text-center">Kéo thả hoặc bấm chọn ảnh</span>
          {hint && <span className="text-[10px] text-white/25">{hint}</span>}
        </button>
      )}
    </div>
  );
}

export function VideoUpload({ label, name, size, onChange, hint }: { label: string; name: string; size: string; onChange: (name: string, size: string) => void; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const accept = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) { toast.error("Chỉ chấp nhận file video"); return; }
    const mb = (f.size / 1024 / 1024).toFixed(1) + " MB";
    setProgress(1);
    const t = setInterval(() => setProgress(p => {
      if (p >= 100) { clearInterval(t); onChange(f.name, mb); toast.success("Tải video hoàn tất"); return 0; }
      return p + 20;
    }), 120);
  };
  return (
    <div className="mb-4">
      <span className="block text-xs text-white/50 mb-1.5">{label}</span>
      <input ref={ref} type="file" accept="video/*" hidden onChange={e => accept(e.target.files?.[0])} />
      {progress > 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-sm text-white/70 mb-2"><Upload className="w-4 h-4 text-[#f4536b] animate-pulse" /> Đang tải lên... {progress}%</div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "linear-gradient(90deg,#f4536b,#d4a648)" }} /></div>
        </div>
      ) : name ? (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="w-10 h-10 rounded-lg bg-[#d72638]/15 flex items-center justify-center shrink-0"><FileVideo className="w-5 h-5 text-[#f4536b]" /></div>
          <div className="flex-1 min-w-0"><div className="text-sm text-white truncate">{name}</div><div className="text-xs text-white/40">{size} · Đã tải lên</div></div>
          <button onClick={() => ref.current?.click()} className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => onChange("", "")} className="p-1.5 rounded-lg text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      ) : (
        <button onClick={() => ref.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]); }}
          className={`w-full rounded-xl border-2 border-dashed py-6 flex flex-col items-center justify-center gap-2 transition ${drag ? "border-[#d72638] bg-[#d72638]/10" : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"}`}>
          <Clapperboard className="w-7 h-7 text-white/30" />
          <span className="text-sm text-white/50">Kéo thả file video hoặc bấm để chọn</span>
          {hint && <span className="text-[10px] text-white/25">{hint}</span>}
        </button>
      )}
    </div>
  );
}

export const emptyContent = (type: string): Content => ({ id: 0, title: "", studio: "", year: new Date().getFullYear(), ep: 0, status: "Sắp ra mắt", score: 0, views: "—", tags: [], type, episodes: [], chapters: [] });

export const isVideoType = (t: string) => t === "anime" || t === "phim";

export function EpisodeManager({ episodes, onChange }: { episodes: Episode[]; onChange: (eps: Episode[]) => void }) {
  const add = () => {
    const num = episodes.length ? Math.max(...episodes.map(e => e.num)) + 1 : 1;
    onChange([...episodes, { id: Date.now(), num, title: "", duration: "24:00", videoName: "", videoSize: "", published: false }]);
  };
  const upd = (id: number, patch: Partial<Episode>) => onChange(episodes.map(e => e.id === id ? { ...e, ...patch } : e));
  const del = (id: number) => onChange(episodes.filter(e => e.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= episodes.length) return;
    const next = [...episodes]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="sm:col-span-2 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50">Danh sách tập ({episodes.length})</span>
        <button onClick={add} className="flex items-center gap-1 text-xs text-[#f4536b] hover:text-white transition"><Plus className="w-3.5 h-3.5" /> Thêm tập</button>
      </div>
      {episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-white/30">Chưa có tập nào. Bấm "Thêm tập" để bắt đầu.</div>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep, i) => (
            <div key={ep.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex flex-col">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20 transition"><ChevronDown className="w-3.5 h-3.5 rotate-180" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === episodes.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 transition"><ChevronDown className="w-3.5 h-3.5" /></button>
                </div>
                <div className="w-9 h-9 rounded-lg bg-[#d72638]/15 flex items-center justify-center shrink-0 text-sm font-semibold text-[#f4536b]">{ep.num}</div>
                <input className={inputCls} value={ep.title} onChange={e => upd(ep.id, { title: e.target.value })} placeholder={`Tên tập ${ep.num}`} />
                <input className="w-24 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-2.5 text-sm text-white text-center focus:outline-none focus:border-[#d72638]/50" value={ep.duration} onChange={e => upd(ep.id, { duration: e.target.value })} placeholder="24:00" />
                <button onClick={() => upd(ep.id, { published: !ep.published })} className={`px-2.5 py-2 rounded-lg text-xs whitespace-nowrap transition ${ep.published ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-white/[0.04] text-white/40 border border-white/10"}`}>{ep.published ? "Đã đăng" : "Nháp"}</button>
                <button onClick={() => del(ep.id)} className="p-2 rounded-lg text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition shrink-0"><Trash2 className="w-4 h-4" /></button>
              </div>
              <VideoUpload label={`Video tập ${ep.num}`} name={ep.videoName} size={ep.videoSize} onChange={(name, size) => upd(ep.id, { videoName: name, videoSize: size })} hint="MP4 / MKV · tối đa 2GB" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChapterManager({ chapters, onChange }: { chapters: Chapter[]; onChange: (chs: Chapter[]) => void }) {
  const add = () => {
    const num = chapters.length ? Math.max(...chapters.map(c => c.num)) + 1 : 1;
    onChange([...chapters, { id: Date.now(), num, title: "", pages: 0, published: false }]);
  };
  const upd = (id: number, patch: Partial<Chapter>) => onChange(chapters.map(c => c.id === id ? { ...c, ...patch } : c));
  const del = (id: number) => onChange(chapters.filter(c => c.id !== id));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= chapters.length) return;
    const next = [...chapters]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  return (
    <div className="sm:col-span-2 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50">Danh sách chương ({chapters.length})</span>
        <button onClick={add} className="flex items-center gap-1 text-xs text-[#f4536b] hover:text-white transition"><Plus className="w-3.5 h-3.5" /> Thêm chương</button>
      </div>
      {chapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-6 text-center text-xs text-white/30">Chưa có chương nào. Bấm "Thêm chương" để bắt đầu.</div>
      ) : (
        <div className="space-y-2">
          {chapters.map((ch, i) => (
            <div key={ch.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20 transition"><ChevronDown className="w-3.5 h-3.5 rotate-180" /></button>
                <button onClick={() => move(i, 1)} disabled={i === chapters.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 transition"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#d4a648]/15 flex items-center justify-center shrink-0 text-sm font-semibold text-[#d4a648]">{ch.num}</div>
              <input className={inputCls} value={ch.title} onChange={e => upd(ch.id, { title: e.target.value })} placeholder={`Tên chương ${ch.num}`} />
              <div className="flex items-center gap-1 shrink-0">
                <input type="number" className="w-20 bg-white/[0.04] border border-white/10 rounded-xl px-2.5 py-2.5 text-sm text-white text-center focus:outline-none focus:border-[#d72638]/50" value={ch.pages || ""} onChange={e => upd(ch.id, { pages: +e.target.value })} placeholder="0" />
                <span className="text-xs text-white/30">trang</span>
              </div>
              <button onClick={() => upd(ch.id, { published: !ch.published })} className={`px-2.5 py-2 rounded-lg text-xs whitespace-nowrap transition ${ch.published ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-white/[0.04] text-white/40 border border-white/10"}`}>{ch.published ? "Đã đăng" : "Nháp"}</button>
              <button onClick={() => del(ch.id)} className="p-2 rounded-lg text-white/40 hover:bg-rose-500/20 hover:text-rose-400 transition shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({ item, onCancel, onConfirm, title, desc }: { item: unknown; onCancel: () => void; onConfirm: () => void; title: string; desc: string }) {
  return (
    <Modal open={!!item} onClose={onCancel} title={title}
      footer={<><GhostBtn onClick={onCancel}>Huỷ</GhostBtn>
        <button onClick={onConfirm} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition"><Trash2 className="w-4 h-4" /> Xác nhận xoá</button></>}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-rose-400" /></div>
        <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
      </div>
    </Modal>
  );
}

export const COLOR_CHOICES = ["pink", "violet", "cyan", "blue", "green", "amber", "red", "gray"];
export const emptyCat = (type: string): Category => ({ id: 0, name: "", slug: "", type, count: 0, color: "pink", active: true, desc: "", cover: "" });

export const emptySched = (): Sched => ({ id: 0, time: "12:00", title: "", ep: "", day: "T2", type: "Anime" });
const DEFAULT_CFG = { darkDefault: true, sakura: true, watchParty: true, studioAI: true, communityWorks: true, maintenance: false, registration: true, premiumRequired: false };