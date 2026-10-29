"use client";

import { Download, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  AuditLogsApiError,
  auditActionLabel,
  auditDetailLines,
  buildAuditCsv,
  formatAuditTime,
  listAuditLogs,
  type AuditAction,
  type AuditLog,
} from "@/lib/admin-audit-api";
import { Card } from "../modules/AdminModules";

const PAGE_SIZE = 20;

type ActionFilter = "all" | AuditAction;

const ACTION_FILTERS: { value: ActionFilter; label: string }[] = [
  { value: "all", label: "Tất cả hành động" },
  { value: "user.role_changed", label: "Đổi vai trò" },
  { value: "user.suspended", label: "Khóa tài khoản" },
  { value: "user.unsuspended", label: "Mở khóa tài khoản" },
  { value: "work.approved", label: "Duyệt tác phẩm" },
  { value: "work.rejected", label: "Từ chối tác phẩm" },
];

function actionChipClass(action: AuditAction): string {
  switch (action) {
    case "work.rejected":
      return "text-red-300 bg-red-500/20 border border-red-500/30";
    case "user.suspended":
      return "text-amber-300 bg-amber-500/20 border border-amber-500/30";
    case "work.approved":
    case "user.unsuspended":
      return "text-emerald-300 bg-emerald-500/20 border border-emerald-500/30";
    default:
      return "text-cyan-300 bg-cyan-500/20 border border-cyan-500/30";
  }
}

export default function AuditClient() {
  const { authenticatedFetch } = useAuth();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [actorFilter, setActorFilter] = useState("");
  const [debouncedActor, setDebouncedActor] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedActor(actorFilter), 400);
    return () => clearTimeout(timer);
  }, [actorFilter]);

  const load = useCallback(
    async (
      targetPage: number,
      query: string,
      action: ActionFilter,
      actor: string,
      signal: AbortSignal,
    ) => {
      setLoading(true);
      try {
        const result = await listAuditLogs(
          authenticatedFetch,
          {
            page: targetPage,
            pageSize: PAGE_SIZE,
            search: query || undefined,
            action: action === "all" ? undefined : action,
            actor: actor || undefined,
          },
          signal,
        );
        setRows(result.items);
        setTotal(result.total);
        setLoadError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(
          error instanceof AuditLogsApiError
            ? error.message
            : "Không tải được nhật ký kiểm tra. Hãy thử lại.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await load(
        page,
        debouncedSearch,
        actionFilter,
        debouncedActor,
        controller.signal,
      );
    })();
    return () => controller.abort();
  }, [load, page, debouncedSearch, actionFilter, debouncedActor]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyActionFilter = (next: ActionFilter) => {
    setActionFilter(next);
    setPage(1);
  };

  const retry = () => {
    const controller = new AbortController();
    void load(page, debouncedSearch, actionFilter, debouncedActor, controller.signal);
  };

  const exportCurrentPage = () => {
    if (rows.length === 0) {
      toast.info("Trang hiện tại không có dòng nhật ký nào để xuất.");
      return;
    }
    const csv = buildAuditCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-log-trang-${page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${rows.length} dòng nhật ký của trang hiện tại.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo người thực hiện, hành động, đối tượng..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <input
          value={actorFilter}
          onChange={(event) => {
            setActorFilter(event.target.value);
            setPage(1);
          }}
          placeholder="Lọc theo người thực hiện..."
          aria-label="Lọc theo người thực hiện"
          className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <select
          value={actionFilter}
          onChange={(event) =>
            applyActionFilter(event.target.value as ActionFilter)
          }
          aria-label="Lọc theo hành động"
          className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none [&>option]:text-black"
        >
          {ACTION_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          onClick={exportCurrentPage}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white"
        >
          <Download className="w-4 h-4" />
          Xuất trang đang xem (CSV)
        </button>
      </div>

      {loadError ? (
        <Card>
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-white/70">{loadError}</p>
            <button
              onClick={retry}
              className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-white hover:text-white"
            >
              Thử lại
            </button>
          </div>
        </Card>
      ) : (
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
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-white/40">
                      Đang tải nhật ký...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-white/40">
                      Chưa có dòng nhật ký nào khớp bộ lọc. Nhật ký bắt đầu
                      được ghi từ khi Lát 3 chạy, các hành động trước đó
                      không có dòng audit.
                    </td>
                  </tr>
                ) : (
                  rows.flatMap((log) => {
                    const expanded = expandedId === log.id;
                    const mainRow = (
                      <tr
                        key={log.id}
                        onClick={() =>
                          setExpandedId(expanded ? null : log.id)
                        }
                        className="hover:bg-white/[0.03] cursor-pointer"
                      >
                        <td className="p-4 text-white font-medium">
                          {log.actorUsername}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${actionChipClass(log.action)}`}
                          >
                            {auditActionLabel(log.action)}
                          </span>
                        </td>
                        <td className="p-4 text-white/60">{log.targetLabel}</td>
                        <td className="p-4 text-white/40 text-xs">
                          {formatAuditTime(log.createdAt)}
                        </td>
                        <td className="p-4 text-white/40 font-mono text-xs">
                          {log.ip ?? "không xác định"}
                        </td>
                      </tr>
                    );
                    if (!expanded) return [mainRow];
                    return [
                      mainRow,
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={5} className="p-4 bg-black/20">
                          <p className="text-white font-medium text-sm">
                            {log.actorUsername} ·{" "}
                            {auditActionLabel(log.action)}
                          </p>
                          <p className="text-white/40 text-xs mt-1">
                            {formatAuditTime(log.createdAt)} · IP{" "}
                            {log.ip ?? "không xác định"} · Mã dòng log:{" "}
                            {log.id}
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-white/80">
                            <p>Đối tượng: {log.targetLabel}</p>
                            {auditDetailLines(log).map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                          </div>
                          <p className="text-white/40 text-xs mt-3">
                            Dòng log này là bản ghi lịch sử, không sửa hay
                            xóa được.
                          </p>
                        </td>
                      </tr>,
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/60 flex-wrap">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white disabled:opacity-40"
            >
              Trước
            </button>
            <span>
              Trang {page} / {totalPages} ({total} dòng)
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
