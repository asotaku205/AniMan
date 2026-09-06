"use client";

import { useState } from "react";
import { Eye, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, ConfirmDialog, Modal, SBdg, Party, PARTY_SEED } from "../modules/AdminModules";

export default function WatchPartyMgmt() {
  const [rows, setRows] = useState<Party[]>(PARTY_SEED);
  const [confirmClose, setConfirmClose] = useState<Party | null>(null);
  const close = (r: Party) => { setRows(rows.filter(x => x.id !== r.id)); setConfirmClose(null); toast.success(`Đã đóng phòng "${r.title}"`); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ l: "Đang diễn ra", v: String(rows.filter(r => r.status === "live").length), c: "text-emerald-400" }, { l: "Tổng người xem", v: String(rows.reduce((a, r) => a + r.viewers, 0)), c: "text-cyan-400" }, { l: "Lên lịch", v: String(rows.filter(r => r.status === "scheduled").length), c: "text-amber-400" }, { l: "Phòng hôm nay", v: "312", c: "text-pink-400" }].map(s => (
          <Card key={s.l} className="p-4 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-white/40 mt-1">{s.l}</div></Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <span className="text-white font-semibold text-sm">Phòng Watch Party</span>
          <div className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /><span className="text-xs text-white/40">Cập nhật tự động</span></div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors">
              <div className={`w-2 h-2 rounded-full shrink-0 ${r.status === "live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-sm">{r.title}</div>
                <div className="text-xs text-white/40 mt-0.5">Host: {r.host} · {r.started} · {r.id}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right"><div className="text-sm text-white font-medium">{r.viewers}/{r.max}</div><div className="text-xs text-white/40">người xem</div></div>
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(r.viewers / r.max) * 100}%`, background: "linear-gradient(90deg,#f4536b,#d4a648)" }} />
                </div>
              </div>
              <SBdg s={r.status} />
              <div className="flex items-center gap-1"><Btn icon={Eye} title="Xem phòng" onClick={() => toast.info(`Đang mở phòng ${r.id}...`)} /><Btn icon={XCircle} color="r" title="Đóng phòng" onClick={() => setConfirmClose(r)} /></div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-10 text-center text-white/30 text-sm">Không có phòng nào đang hoạt động</div>}
        </div>
      </Card>
      <ConfirmDialog item={confirmClose} onCancel={() => setConfirmClose(null)} onConfirm={() => confirmClose && close(confirmClose)}
        title="Đóng phòng Watch Party?" desc={confirmClose ? `Đóng phòng "${confirmClose.title}" sẽ ngắt kết nối tất cả người xem.` : ""} />
    </div>
  );
}


