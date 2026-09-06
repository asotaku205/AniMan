"use client";

import { useState } from "react";
import { Megaphone, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Card, Field, GhostBtn, ImageUpload, PrimaryBtn, SBdg, Announce, ANNOUNCE_SEED, inputCls } from "../modules/AdminModules";

export default function AnnouncementsMgmt() {
  const [rows, setRows] = useState<Announce[]>(ANNOUNCE_SEED);
  const [form, setForm] = useState({ title: "", body: "", audience: "Tất cả", image: "" });
  const send = (status: string) => {
    if (!form.title.trim() || !form.body.trim()) { toast.error("Nhập tiêu đề và nội dung"); return; }
    setRows([{ id: Math.max(0, ...rows.map(r => r.id)) + 1, title: form.title, body: form.body, audience: form.audience, date: new Date().toLocaleDateString("vi-VN"), status, image: form.image }, ...rows]);
    toast.success(status === "sent" ? "Đã gửi thông báo tới người dùng" : "Đã lưu bản nháp");
    setForm({ title: "", body: "", audience: "Tất cả", image: "" });
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 p-5 h-fit">
          <div className="flex items-center gap-2 mb-4"><Megaphone className="w-4 h-4 text-[#f4536b]" /><span className="text-white font-semibold">Soạn thông báo</span></div>
          <Field label="Tiêu đề *"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="VD: Bảo trì hệ thống" /></Field>
          <Field label="Nội dung *"><textarea rows={4} className={inputCls} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Nội dung thông báo..." /></Field>
          <Field label="Đối tượng"><select className={inputCls} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option>Tất cả</option><option>Premium</option><option>Creator</option><option>Moderator</option></select></Field>
          <ImageUpload label="Ảnh đính kèm (banner)" value={form.image} onChange={v => setForm({ ...form, image: v })} ratio="aspect-video" hint="Tỉ lệ 16:9 · ≤5MB" />
          <div className="flex gap-3 mt-2">
            <GhostBtn icon={Save} onClick={() => send("draft")}>Lưu nháp</GhostBtn>
            <PrimaryBtn icon={Send} onClick={() => send("sent")}>Gửi ngay</PrimaryBtn>
          </div>
        </Card>
        <Card className="lg:col-span-3 p-5">
          <div className="text-white font-semibold mb-4">Lịch sử thông báo</div>
          <div className="space-y-3">
            {rows.map(a => (
              <div key={a.id} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-white">{a.title}</span><Bdg c="violet">{a.audience}</Bdg><SBdg s={a.status} /></div>
                {a.image && <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/10 mt-2"><img src={a.image} alt="" className="w-full h-full object-cover" /></div>}
                <p className="text-sm text-white/60 mt-1.5">{a.body}</p>
                <div className="text-xs text-white/30 mt-2">{a.date}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}


