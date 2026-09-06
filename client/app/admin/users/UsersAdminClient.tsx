"use client";

import { Ban, CheckCircle, Eye, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Bdg, Btn, Card, Field, GhostBtn, ImageUpload, Modal, PrimaryBtn, SBdg, Toggle, inputCls, USER_SEED, User } from "../modules/AdminModules";

export default function UserMgmt() {
  const [rows, setRows] = useState<User[]>(USER_SEED);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "user", premium: false, avatar: "" });

  const filtered = rows.filter(u => (u.name.includes(search) || u.email.includes(search)) && (role === "all" || u.role === role));
  const toggleBan = (u: User) => { setRows(rows.map(x => x.id === u.id ? { ...x, status: x.status === "banned" ? "active" : "banned" } : x)); toast.success(u.status === "banned" ? `Đã mở khoá ${u.name}` : `Đã khoá ${u.name}`); };
  const changeRole = (u: User, r: string) => { setRows(rows.map(x => x.id === u.id ? { ...x, role: r } : x)); toast.success(`Đã cấp quyền ${r === "moderator" ? "Moderator" : r === "creator" ? "Creator" : "Thành viên"} cho ${u.name}`); };
  const add = () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Nhập tên và email"); return; }
    setRows([{ id: Math.max(0, ...rows.map(r => r.id)) + 1, name: form.name, email: form.email, role: form.role, joined: new Date().toLocaleDateString("vi-VN"), status: "active", premium: form.premium, reports: 0, avatar: form.avatar }, ...rows]);
    toast.success(`Đã thêm ${form.name}`); setAdding(false); setForm({ name: "", email: "", role: "user", premium: false, avatar: "" });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Tổng thành viên", v: "148,320", c: "text-pink-400" }, { l: "Premium", v: "32,180", c: "text-amber-400" }, { l: "Creator", v: "8,420", c: "text-violet-400" }, { l: "Đã khoá", v: String(rows.filter(r => r.status === "banned").length + 1242), c: "text-rose-400" }].map(s => (
          <Card key={s.l} className="p-4 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-white/40 mt-1">{s.l}</div></Card>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm người dùng..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none">
          <option value="all">Tất cả vai trò</option><option value="user">Thành viên</option><option value="creator">Creator</option><option value="moderator">Moderator</option>
        </select>
        <PrimaryBtn icon={Plus} onClick={() => setAdding(true)}>Thêm thành viên</PrimaryBtn>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.08]">
              {["THÀNH VIÊN", "VAI TRÒ", "THAM GIA", "TRẠNG THÁI", "PREMIUM", "BÁO CÁO", ""].map((h, i) => (
                <th key={i} className={`p-4 text-white/40 font-medium text-xs ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4"><div className="flex items-center gap-3">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{u.name[0].toUpperCase()}</div>}
                    <div><div className="font-medium text-white">{u.name}</div><div className="text-xs text-white/40">{u.email}</div></div>
                  </div></td>
                  <td className="p-4">
                    <select value={u.role} onChange={e => changeRole(u, e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none">
                      <option value="user">Thành viên</option><option value="creator">Creator</option><option value="moderator">Moderator</option>
                    </select>
                  </td>
                  <td className="p-4 text-white/50 text-xs">{u.joined}</td>
                  <td className="p-4"><SBdg s={u.status} /></td>
                  <td className="p-4">{u.premium ? <Bdg c="yellow">Premium</Bdg> : <span className="text-white/30 text-xs">—</span>}</td>
                  <td className="p-4">{u.reports > 0 ? <Bdg c="red">{u.reports} báo cáo</Bdg> : <span className="text-white/30 text-xs">—</span>}</td>
                  <td className="p-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Btn icon={Eye} title="Xem hồ sơ" onClick={() => setViewing(u)} />
                    <Btn icon={u.status === "active" ? Ban : CheckCircle} color={u.status === "active" ? "r" : "g"} title={u.status === "active" ? "Khoá" : "Mở khoá"} onClick={() => toggleBan(u)} />
                  </div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-white/30 text-sm">Không tìm thấy người dùng</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Thêm thành viên"
        footer={<><GhostBtn onClick={() => setAdding(false)}>Huỷ</GhostBtn><PrimaryBtn icon={Plus} onClick={add}>Thêm</PrimaryBtn></>}>
        <div className="max-w-[120px]"><ImageUpload label="Ảnh đại diện" value={form.avatar} onChange={v => setForm({ ...form, avatar: v })} ratio="aspect-square" hint="Ảnh vuông · ≤5MB" /></div>
        <Field label="Tên đăng nhập *"><input className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email *"><input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Vai trò"><select className={inputCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="user">Thành viên</option><option value="creator">Creator</option><option value="moderator">Moderator</option></select></Field>
        <div className="flex items-center justify-between pt-1"><span className="text-sm text-white/70">Cấp Premium</span><Toggle on={form.premium} onChange={() => setForm({ ...form, premium: !form.premium })} /></div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Hồ sơ người dùng">
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              {viewing.avatar ? <img src={viewing.avatar} alt="" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xl font-bold">{viewing.name[0].toUpperCase()}</div>}
              <div><div className="text-white font-semibold text-base">{viewing.name}</div><div className="text-white/50">{viewing.email}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["Vai trò", viewing.role], ["Tham gia", viewing.joined], ["Trạng thái", viewing.status === "active" ? "Hoạt động" : "Đã khoá"], ["Báo cáo", String(viewing.reports)]].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-white/[0.04] p-3"><div className="text-xs text-white/40">{l}</div><div className="text-white mt-0.5">{v}</div></div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


