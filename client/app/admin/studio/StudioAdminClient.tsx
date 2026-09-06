"use client";

import { useState } from "react";
import { Check, Eye, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, Modal, PrimaryBtn, SBdg, Work, WORK_SEED, SON } from "../modules/AdminModules";

export default function StudioMgmt() {
  const [rows, setRows] = useState<Work[]>(WORK_SEED);
  const [filter, setFilter] = useState("all");
  const [viewing, setViewing] = useState<Work | null>(null);
  const filtered = rows.filter(w => filter === "all" || w.status === filter);
  const setStatus = (w: Work, status: string) => { setRows(rows.map(x => x.id === w.id ? { ...x, status } : x)); toast.success(status === "approved" ? `Đã duyệt "${w.title}"` : `Đã từ chối "${w.title}"`); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Chờ duyệt", v: String(rows.filter(r => r.status === "pending").length), c: "text-amber-400" }, { l: "Đã duyệt", v: String(rows.filter(r => r.status === "approved").length + 1839), c: "text-emerald-400" }, { l: "Từ chối", v: String(rows.filter(r => r.status === "rejected").length + 311), c: "text-rose-400" }, { l: "Tổng tác phẩm", v: "2,176", c: "text-violet-400" }].map(s => (
          <Card key={s.l} className="p-4 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-white/40 mt-1">{s.l}</div></Card>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm transition ${filter === f ? "text-white font-medium" : "bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:border-white/20"}`} style={filter === f ? SON : {}}>
            {f === "all" ? "Tất cả" : f === "pending" ? "Chờ duyệt" : f === "approved" ? "Đã duyệt" : "Từ chối"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(w => (
          <Card key={w.id} className="p-4 hover:border-white/15 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-16 rounded-lg bg-white/10 shrink-0 flex items-center justify-center"><Wand2 className="w-5 h-5 text-white/30" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-white">{w.title}</span>
                  <Bdg c={w.type === "Manga" ? "pink" : w.type === "Novel" ? "violet" : "cyan"}>{w.type}</Bdg>
                  <SBdg s={w.status} />
                </div>
                <div className="text-xs text-white/50 mt-1">Tác giả: <span className="text-white/70">{w.author}</span>{w.pages > 0 && <> · {w.pages.toLocaleString()} {w.type === "Novel" ? "từ" : "trang"}</>} · Nộp {w.submitted}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {w.status === "pending" && (
                  <>
                    <button onClick={() => setStatus(w, "approved")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 transition"><Check className="w-3.5 h-3.5" /> Duyệt</button>
                    <button onClick={() => setStatus(w, "rejected")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs hover:bg-rose-500/30 transition"><X className="w-3.5 h-3.5" /> Từ chối</button>
                  </>
                )}
                <Btn icon={Eye} onClick={() => setViewing(w)} />
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-10 text-center text-white/30 text-sm">Không có tác phẩm</Card>}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Chi tiết tác phẩm"
        footer={viewing?.status === "pending" ? <><button onClick={() => { setStatus(viewing!, "rejected"); setViewing(null); }} className="px-4 py-2.5 rounded-xl text-sm bg-rose-500/20 text-rose-300 border border-rose-500/30">Từ chối</button><PrimaryBtn icon={Check} onClick={() => { setStatus(viewing!, "approved"); setViewing(null); }}>Duyệt</PrimaryBtn></> : undefined}>
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="text-white font-semibold text-base">{viewing.title}</div>
            <div className="flex gap-2"><Bdg c="pink">{viewing.type}</Bdg><SBdg s={viewing.status} /></div>
            <div className="text-white/60">Tác giả: <span className="text-white">{viewing.author}</span></div>
            <div className="text-white/60">Nộp ngày: <span className="text-white">{viewing.submitted}</span></div>
            <div className="rounded-xl bg-white/[0.04] p-4 text-white/40 text-center">Xem trước nội dung sẽ hiển thị ở đây</div>
          </div>
        )}
      </Modal>
    </div>
  );
}


