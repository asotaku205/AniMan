"use client";

import { useState } from "react";
import { Eye, Pin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, ConfirmDialog, Modal, SBdg, Thread, FORUM_SEED } from "../modules/AdminModules";

export default function ForumMgmt() {
  const [rows, setRows] = useState<Thread[]>(FORUM_SEED);
  const [confirmDel, setConfirmDel] = useState<Thread | null>(null);
  const pin = (t: Thread) => { setRows(rows.map(x => x.id === t.id ? { ...x, pinned: !x.pinned } : x)); toast.success(t.pinned ? "Đã bỏ ghim" : "Đã ghim chủ đề"); };
  const del = (t: Thread) => { setRows(rows.filter(x => x.id !== t.id)); setConfirmDel(null); toast.success("Đã xoá chủ đề"); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Tổng chủ đề", v: "28,140", c: "text-pink-400" }, { l: "Bình luận hôm nay", v: "1,832", c: "text-emerald-400" }, { l: "Chờ kiểm duyệt", v: String(rows.filter(r => r.reports > 0).length), c: "text-amber-400" }, { l: "Đã xóa hôm nay", v: "23", c: "text-rose-400" }].map(s => (
          <Card key={s.l} className="p-4 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-white/40 mt-1">{s.l}</div></Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.08]">
              {["CHỦ ĐỀ", "DANH MỤC", "TÁC GIẢ", "BÌNH LUẬN", "BÁO CÁO", "THỜI GIAN", ""].map((h, i) => (
                <th key={i} className={`p-4 text-white/40 font-medium text-xs ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map(p => (
                <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4"><div className="flex items-center gap-2">{p.pinned && <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400" />}<span className={`font-medium line-clamp-1 max-w-[260px] ${p.reports > 5 ? "text-rose-300" : "text-white"}`}>{p.title}</span></div></td>
                  <td className="p-4"><Bdg>{p.cat}</Bdg></td>
                  <td className="p-4 text-white/60 text-xs">{p.author}</td>
                  <td className="p-4 text-white/60">{p.replies}</td>
                  <td className="p-4">{p.reports > 0 ? <Bdg c={p.reports > 5 ? "red" : "yellow"}>{p.reports} báo cáo</Bdg> : <span className="text-white/30 text-xs">—</span>}</td>
                  <td className="p-4 text-white/40 text-xs">{p.time}</td>
                  <td className="p-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition"><Btn icon={Pin} color="a" title={p.pinned ? "Bỏ ghim" : "Ghim"} onClick={() => pin(p)} /><Btn icon={Eye} onClick={() => toast.info("Đang mở chủ đề...")} /><Btn icon={Trash2} color="r" onClick={() => setConfirmDel(p)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ConfirmDialog item={confirmDel} onCancel={() => setConfirmDel(null)} onConfirm={() => confirmDel && del(confirmDel)}
        title="Xoá chủ đề?" desc={confirmDel ? `Xoá "${confirmDel.title}" và toàn bộ bình luận bên trong?` : ""} />
    </div>
  );
}


