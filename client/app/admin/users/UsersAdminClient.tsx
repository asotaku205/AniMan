"use client";

import { Ban, CheckCircle, Eye, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  AdminUsersApiError,
  changeAdminUserRole,
  changeAdminUserStatus,
  listAdminUsers,
  type AdminUser,
} from "@/lib/admin-users-api";
import { Btn, Card, GhostBtn, Modal, PrimaryBtn, SBdg } from "../modules/AdminModules";

const PAGE_SIZE = 20;

type RoleFilter = "all" | "user" | "admin";
type StatusFilter = "all" | "active" | "suspended";

type ConfirmAction =
  | { kind: "role"; user: AdminUser; role: "user" | "admin" }
  | { kind: "status"; user: AdminUser; status: "active" | "suspended" };

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

function roleLabel(role: AdminUser["role"]): string {
  return role === "admin" ? "Quản trị viên" : "Thành viên";
}

export default function UserMgmt() {
  const { user: currentUser, authenticatedFetch } = useAuth();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [counts, setCounts] = useState({ total: 0, admin: 0, active: 0, suspended: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [mutating, setMutating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (targetPage: number, query: string, role: RoleFilter, status: StatusFilter, signal: AbortSignal) => {
      setLoading(true);
      try {
        const result = await listAdminUsers(
          authenticatedFetch,
          {
            page: targetPage,
            pageSize: PAGE_SIZE,
            q: query || undefined,
            role: role === "all" ? undefined : role,
            status: status === "all" ? undefined : status,
          },
          signal,
        );
        setRows(result.items);
        setCounts(result.counts);
        setTotal(result.total);
        setLoadError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(
          error instanceof AdminUsersApiError
            ? error.message
            : "Không tải được danh sách người dùng. Hãy thử lại.",
        );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [authenticatedFetch],
  );

  useEffect(() => {
    const controller = new AbortController();
    // Gọi qua await để state chỉ đổi sau khi fetch xong, không đổi đồng bộ
    // trong thân effect (luật react-hooks/set-state-in-effect).
    void (async () => {
      await load(page, debouncedSearch, roleFilter, statusFilter, controller.signal);
    })();
    return () => controller.abort();
  }, [load, page, debouncedSearch, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyFilter = (nextRole: RoleFilter, nextStatus: StatusFilter) => {
    setRoleFilter(nextRole);
    setStatusFilter(nextStatus);
    setPage(1);
  };

  const refresh = useCallback(() => {
    const controller = new AbortController();
    void load(page, debouncedSearch, roleFilter, statusFilter, controller.signal);
  }, [load, page, debouncedSearch, roleFilter, statusFilter]);

  const runConfirm = async () => {
    if (!confirm || mutating) return;
    setMutating(true);
    try {
      if (confirm.kind === "role") {
        await changeAdminUserRole(authenticatedFetch, confirm.user.id, confirm.role);
        toast.success(`Đã đổi vai trò của @${confirm.user.username} thành ${roleLabel(confirm.role)}.`);
      } else {
        await changeAdminUserStatus(authenticatedFetch, confirm.user.id, confirm.status);
        toast.success(
          confirm.status === "suspended"
            ? `Đã khóa @${confirm.user.username}.`
            : `Đã mở khóa @${confirm.user.username}.`,
        );
      }
      setConfirm(null);
      refresh();
    } catch (error) {
      toast.error(
        error instanceof AdminUsersApiError
          ? error.message
          : "Không lưu được thay đổi. Dữ liệu trên màn hình giữ nguyên.",
      );
    } finally {
      setMutating(false);
    }
  };

  const confirmBody = !confirm
    ? ""
    : confirm.kind === "role"
      ? confirm.role === "admin"
        ? `Cấp quyền quản trị viên cho @${confirm.user.username} (${confirm.user.displayName}). Tài khoản này sẽ vào được trang Admin.`
        : `Hạ @${confirm.user.username} (${confirm.user.displayName}) xuống Thành viên. Tài khoản này sẽ không vào được trang Admin nữa.`
      : confirm.status === "suspended"
        ? `Khóa @${confirm.user.username} (${confirm.user.displayName}). Tài khoản này sẽ không đăng nhập được nữa cho tới khi được mở khóa.`
        : `Mở khóa @${confirm.user.username} (${confirm.user.displayName}). Tài khoản này sẽ đăng nhập lại bình thường.`;

  const confirmWarning =
    confirm?.kind === "role" && confirm.role === "user"
      ? "Nếu đây là quản trị viên cuối cùng, hệ thống sẽ chặn và giữ nguyên vai trò."
      : confirm?.kind === "status" && confirm.status === "suspended"
        ? "Khóa là tạm thời, mở lại được. Hành động này được ghi log và sẽ hiện trong nhật ký hoạt động ở Lát 3."
        : "";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: "Tổng thành viên", v: String(counts.total), c: "text-pink-400" },
          { l: "Quản trị viên", v: String(counts.admin), c: "text-violet-400" },
          { l: "Đang hoạt động", v: String(counts.active), c: "text-emerald-400" },
          { l: "Đã khóa", v: String(counts.suspended), c: "text-rose-400" },
        ].map((s) => (
          <Card key={s.l} className="p-4 text-center">
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-xs text-white/40 mt-1">{s.l}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên hiển thị hoặc username..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => applyFilter(e.target.value as RoleFilter, statusFilter)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none"
        >
          <option value="all">Tất cả vai trò</option>
          <option value="user">Thành viên</option>
          <option value="admin">Quản trị viên</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => applyFilter(roleFilter, e.target.value as StatusFilter)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="suspended">Đã khóa</option>
        </select>
        <span className="text-xs text-white/40">
          Người dùng tự đăng ký, admin chỉ cấp quyền và khóa tài khoản.
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["THÀNH VIÊN", "VAI TRÒ", "THAM GIA", "TRẠNG THÁI", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`p-4 text-white/40 font-medium text-xs ${i === 4 ? "text-right" : "text-left"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loadError && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center">
                    <div className="text-sm text-rose-300">{loadError}</div>
                    <button
                      onClick={refresh}
                      className="mt-3 px-4 py-2 rounded-xl text-sm bg-white/[0.04] border border-white/10 text-white/70 hover:text-white transition"
                    >
                      Thử lại
                    </button>
                  </td>
                </tr>
              ) : loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-white/30 text-sm">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {u.displayName}
                              {isSelf && <span className="text-white/40 text-xs"> (bạn)</span>}
                            </div>
                            <div className="text-xs text-white/40">@{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          disabled={isSelf || mutating}
                          title={isSelf ? "Không thể tự đổi vai trò của chính mình" : undefined}
                          onChange={(e) => {
                            const next = e.target.value as "user" | "admin";
                            if (next !== u.role) setConfirm({ kind: "role", user: u, role: next });
                          }}
                          className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none disabled:opacity-50"
                        >
                          <option value="user">Thành viên</option>
                          <option value="admin">Quản trị viên</option>
                        </select>
                      </td>
                      <td className="p-4 text-white/50 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="p-4">
                        <SBdg s={u.status} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Btn icon={Eye} title="Xem hồ sơ" onClick={() => setViewing(u)} />
                          <Btn
                            icon={u.status === "active" ? Ban : CheckCircle}
                            color={u.status === "active" ? "r" : "g"}
                            title={
                              isSelf
                                ? "Không thể tự khóa chính mình"
                                : u.status === "active"
                                  ? "Khóa"
                                  : "Mở khóa"
                            }
                            onClick={() => {
                              if (isSelf) {
                                toast.error("Không thể tự khóa tài khoản của chính mình.");
                                return;
                              }
                              setConfirm({
                                kind: "status",
                                user: u,
                                status: u.status === "active" ? "suspended" : "active",
                              });
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && !loadError && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-white/30 text-sm">
                    Không tìm thấy người dùng
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06] text-xs text-white/40">
          <span>
            Trang {page} / {totalPages} ({total} người dùng)
          </span>
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/70 hover:text-white transition disabled:opacity-40"
          >
            Trước
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/70 hover:text-white transition disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => {
          if (!mutating) setConfirm(null);
        }}
        title={
          confirm?.kind === "role"
            ? confirm.role === "admin"
              ? "Cấp quyền quản trị viên?"
              : "Hạ quyền quản trị viên?"
            : confirm?.status === "suspended"
              ? "Khóa tài khoản?"
              : "Mở khóa tài khoản?"
        }
        footer={
          <>
            <GhostBtn onClick={() => setConfirm(null)}>Hủy</GhostBtn>
            <PrimaryBtn onClick={() => void runConfirm()}>Xác nhận</PrimaryBtn>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-white/70">{confirmBody}</p>
          {confirmWarning && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-2.5 text-xs text-amber-200/90">
              {confirmWarning}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Hồ sơ người dùng">
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xl font-bold">
                {viewing.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-semibold text-base">{viewing.displayName}</div>
                <div className="text-white/50">@{viewing.username}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Vai trò", roleLabel(viewing.role)],
                ["Trạng thái", viewing.status === "active" ? "Đang hoạt động" : "Đã khóa"],
                ["Tham gia", formatDate(viewing.createdAt)],
                ["Chấp nhận điều khoản", formatDate(viewing.termsAcceptedAt)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-white/[0.04] p-3">
                  <div className="text-xs text-white/40">{l}</div>
                  <div className="text-white mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
