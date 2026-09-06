"use client";

import { useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";

const LOGS = [
  {
    id: 1,
    actor: "Admin Hệ thống",
    action: "Khoá tài khoản",
    target: "spam_bot_01",
    time: "03/09/2026 14:22",
    ip: "113.161.0.12",
  },
  {
    id: 2,
    actor: "anime_lord_vn",
    action: "Duyệt tác phẩm",
    target: "AnimLab: Rồng Hạ Long",
    time: "03/09/2026 11:08",
    ip: "42.116.5.90",
  },
  {
    id: 3,
    actor: "Admin Hệ thống",
    action: "Cập nhật cài đặt",
    target: "Chế độ bảo trì → tắt",
    time: "02/09/2026 22:40",
    ip: "113.161.0.12",
  },
  {
    id: 4,
    actor: "anime_lord_vn",
    action: "Xoá bình luận",
    target: "#comment 88213",
    time: "02/09/2026 19:15",
    ip: "42.116.5.90",
  },
];
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">
      {children}
    </div>
  );
}
export default function AuditClient() {
  const [search, setSearch] = useState("");
  const rows = LOGS.filter((log) =>
    `${log.actor} ${log.action} ${log.target}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo người thực hiện, hành động..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <button
          onClick={() => toast.success("Đã xuất nhật ký")}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white"
        >
          <Download className="w-4 h-4" />
          Xuất log
        </button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {[
                  "NGƯỜI THỰC HIỆN",
                  "HÀNH ĐỘNG",
                  "ĐỐI TƯỢNG",
                  "THỜI GIAN",
                  "IP",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="p-4 text-white/40 font-medium text-xs text-left"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.03]">
                  <td className="p-4 text-white font-medium">{log.actor}</td>
                  <td className="p-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] text-cyan-300 bg-cyan-500/20 border border-cyan-500/30">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-white/60">{log.target}</td>
                  <td className="p-4 text-white/40 text-xs">{log.time}</td>
                  <td className="p-4 text-white/40 font-mono text-xs">
                    {log.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
