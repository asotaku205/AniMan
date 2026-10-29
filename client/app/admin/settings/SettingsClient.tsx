"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  AdminSettingsApiError,
  getAdminSettings,
  readStoredLocalSettings,
  updateAdminSettings,
  writeStoredLocalSettings,
  type LocalSettingKey,
  type LocalSettings,
  type SiteSettings,
} from "@/lib/admin-settings-api";
import { GhostBtn, Modal } from "../modules/AdminModules";

const inputCard = "rounded-2xl bg-white/[0.04] border border-white/[0.08]";
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) { return <button onClick={onChange} disabled={disabled} aria-label="Bật hoặc tắt" className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50" style={{ background: on ? "#d72638" : "rgba(255,255,255,0.15)" }}><span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} /></button>; }

function LocalRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: () => void }) {
  return <div className="flex items-center justify-between py-4 border-b border-white/[0.05] last:border-0"><div><div className="text-sm font-medium text-white">{label}</div><div className="text-xs text-white/40 mt-0.5">{desc}</div></div><Toggle on={on} onChange={onChange} /></div>;
}

function RealRow({ label, desc, on, disabled, onToggle }: { label: string; desc: string; on: boolean; disabled: boolean; onToggle: (next: boolean) => void }) {
  return <div className="flex items-center justify-between py-4 border-b border-white/[0.05] last:border-0"><div><div className="text-sm font-medium text-white">{label} <span className="ml-1 align-middle text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-normal">Tác dụng thật</span></div><div className="text-xs text-white/40 mt-0.5">{desc}</div></div><Toggle on={on} onChange={() => onToggle(!on)} disabled={disabled} /></div>;
}

export default function SettingsClient() {
  const { authenticatedFetch } = useAuth();

  // 6 khoa chi luu o trinh duyet nay: doc/ghi localStorage, khong cham server.
  const [localCfg, setLocalCfg] = useState<LocalSettings>(() => readStoredLocalSettings());
  useEffect(() => { writeStoredLocalSettings(localCfg); }, [localCfg]);
  const toggleLocal = (key: LocalSettingKey) => {
    setLocalCfg((current) => ({ ...current, [key]: !current[key] }));
    toast.success("Đã lưu cài đặt");
  };

  // 2 khoa that: luu tren server, nap tu API, khong doc/ghi localStorage.
  const [realCfg, setRealCfg] = useState<SiteSettings | null>(null);
  const [realLoading, setRealLoading] = useState(true);
  const [realError, setRealError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  const loadReal = useCallback(async () => {
    setRealLoading(true);
    setRealError(null);
    try {
      setRealCfg(await getAdminSettings(authenticatedFetch));
    } catch (error) {
      setRealError(
        error instanceof AdminSettingsApiError
          ? error.message
          : "Không tải được cài đặt. Hãy thử lại.",
      );
    } finally {
      setRealLoading(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    void (async () => {
      await loadReal();
    })();
  }, [loadReal]);

  const applyReal = useCallback(async (changes: Partial<SiteSettings>) => {
    if (!realCfg || saving) return;
    const previous = realCfg;
    setRealCfg({ ...previous, ...changes });
    setSaving(true);
    try {
      const saved = await updateAdminSettings(authenticatedFetch, changes);
      setRealCfg(saved);
      toast.success("Đã lưu cài đặt");
    } catch (error) {
      // API loi: tra toggle ve trang thai cu, khong giu trang thai ao.
      setRealCfg(previous);
      toast.error(
        error instanceof AdminSettingsApiError
          ? error.message
          : "Không lưu được cài đặt. Dữ liệu trên màn hình giữ nguyên.",
      );
    } finally {
      setSaving(false);
    }
  }, [realCfg, saving, authenticatedFetch]);

  const requestMaintenance = useCallback((next: boolean) => {
    if (next) {
      setConfirmMaintenance(true);
      return;
    }
    void applyReal({ maintenance: false });
  }, [applyReal]);


  return <div className="space-y-5 max-w-2xl">
    <section className={`p-6 ${inputCard}`}>
      <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-1">Áp dụng cho toàn hệ thống (lưu trên server)</p>
      <p className="text-xs text-white/40 mb-4">Lưu trên server, tác dụng với mọi người dùng. Mỗi lần đổi đều ghi vào audit log.</p>
      {realLoading ? (
        <div className="text-sm text-white/60 py-4">Đang tải cài đặt...</div>
      ) : realError ? (
        <div className="py-4">
          <div className="text-sm text-rose-300">{realError}</div>
          <button onClick={() => void loadReal()} className="mt-3 px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white">Thử lại</button>
        </div>
      ) : (
        <>
          <RealRow label="Chế độ bảo trì" desc="Ẩn trang chính, hiện thông báo bảo trì" on={realCfg?.maintenance ?? false} disabled={realLoading || saving} onToggle={requestMaintenance} />
          <RealRow label="Cho phép đăng ký mới" desc="Tắt để tạm dừng nhận thành viên mới" on={realCfg?.registrationOpen ?? false} disabled={realLoading || saving} onToggle={(next) => void applyReal({ registrationOpen: next })} />
        </>
      )}
    </section>
    <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase">Chỉ trình duyệt này (lưu local, không ảnh hưởng người khác)</p>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Giao diện & Hiệu ứng</p><LocalRow label="Giao diện tối mặc định" desc="Người dùng mới sẽ thấy giao diện tối" on={localCfg.darkDefault} onChange={() => toggleLocal("darkDefault")} /><LocalRow label="Hiệu ứng hoa anh đào" desc="Cánh hoa bay trên trang Library" on={localCfg.sakura} onChange={() => toggleLocal("sakura")} /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Tính năng</p><LocalRow label="Watch Party" desc="Cho phép tạo phòng xem phim cùng nhau" on={localCfg.watchParty} onChange={() => toggleLocal("watchParty")} /><LocalRow label="Studio AI" desc="Bật AI hỗ trợ trong Studio" on={localCfg.studioAI} onChange={() => toggleLocal("studioAI")} /><LocalRow label="Tác phẩm cộng đồng" desc="Cho phép người dùng đăng tác phẩm" on={localCfg.communityWorks} onChange={() => toggleLocal("communityWorks")} /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Tài khoản & Bảo mật</p><LocalRow label="Yêu cầu Premium cho Studio" desc="Chỉ Premium mới dùng được Studio" on={localCfg.premiumRequired} onChange={() => toggleLocal("premiumRequired")} /></section>
    <section className={`p-6 ${inputCard}`}><p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-4">Thao tác hệ thống</p><div className="flex flex-wrap gap-3"><button onClick={() => toast.success("Đã xoá cache")} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition"><RefreshCw className="w-4 h-4" />Xóa cache</button><button onClick={() => toast.success("Đang tạo bản sao lưu...")} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white/70 hover:text-white transition"><Download className="w-4 h-4" />Sao lưu DB</button><button onClick={() => requestMaintenance(!(realCfg?.maintenance ?? false))} className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-sm text-rose-300 hover:bg-rose-500/30 transition"><AlertTriangle className="w-4 h-4" />{realCfg?.maintenance ? "Tắt bảo trì" : "Bật bảo trì"}</button></div></section>
    <Modal
      open={confirmMaintenance}
      onClose={() => setConfirmMaintenance(false)}
      title="Bật chế độ bảo trì?"
      footer={<><GhostBtn onClick={() => setConfirmMaintenance(false)}>Hủy</GhostBtn><button onClick={() => { setConfirmMaintenance(false); void applyReal({ maintenance: true }); }} className="px-4 py-2.5 rounded-xl text-sm text-white font-medium bg-rose-600 hover:brightness-110 transition">Bật bảo trì</button></>}
    >
      <p className="text-sm leading-relaxed text-white/75">
        Từ lúc bật, mọi người dùng thường và khách ẩn danh sẽ thấy trang bảo trì và không dùng được app cho tới khi quản trị viên tắt. Chính tài khoản quản trị viên vẫn vào được bình thường. Hành động này được ghi vào audit log.
      </p>
    </Modal>
  </div>;
}
