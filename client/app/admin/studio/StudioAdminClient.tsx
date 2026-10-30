"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, Modal, PrimaryBtn, SBdg, SON } from "../modules/AdminModules";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  listReviewQueue,
  reviewWork,
  WorksApiError,
  type WorkStatus,
  type WorkSubmission,
} from "@/lib/works-api";
import { formatBytes } from "@/app/(main)/upload/lib/uploadStorage";

type QueueFilter = "all" | WorkStatus;

const TYPE_LABEL: Record<WorkSubmission["type"], string> = {
  manga: "Manga",
  novel: "Novel",
  animation: "Animation",
  fanart: "Fan Art",
};

const TYPE_BADGE_COLOR: Record<WorkSubmission["type"], string> = {
  manga: "pink",
  novel: "violet",
  animation: "cyan",
  fanart: "pink",
};

function StatusBadge({ status }: { status: WorkStatus }) {
  if (status === "approved") {
    return <Bdg c="green">Đã duyệt</Bdg>;
  }
  return <SBdg s={status} />;
}

/**
 * Tải nội dung có bảo vệ (ảnh bìa, file ảnh) qua authenticatedFetch rồi
 * hiện bằng object URL. Thẻ img/video của trình duyệt không gắn được
 * token nên không đọc trực tiếp được file của tác phẩm chờ duyệt.
 */
function useBlobUrl(
  url: string | null,
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let objectUrl: string | null = null;
    void authenticatedFetch(url)
      .then(async (response) => {
        if (!response.ok) return;
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setBlobUrl(objectUrl);
      })
      .catch(() => {
        /* giữ null, giao diện hiện đường dẫn thay thế */
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, authenticatedFetch]);
  return url ? blobUrl : null;
}

function PreviewMedia({
  work,
  authenticatedFetch,
}: {
  work: WorkSubmission;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const coverBlob = useBlobUrl(work.coverUrl, authenticatedFetch);
  const isImageFile = work.mimeType.startsWith("image/");
  const fileBlob = useBlobUrl(isImageFile ? work.fileUrl : null, authenticatedFetch);
  const isVideo = work.mimeType.startsWith("video/");

  return (
    <div className="space-y-3">
      {work.coverUrl && (
        <div>
          {coverBlob ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverBlob} alt="Ảnh bìa" className="w-full max-h-64 object-contain rounded-xl bg-black/40" />
          ) : (
            <div className="rounded-xl bg-white/[0.04] p-4 text-white/40 text-center text-sm">
              Đang tải ảnh bìa…
            </div>
          )}
        </div>
      )}
      {isImageFile && (
        <div>
          {fileBlob ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileBlob} alt={work.title} className="w-full max-h-96 object-contain rounded-xl bg-black/40" />
          ) : (
            <div className="rounded-xl bg-white/[0.04] p-4 text-white/40 text-center text-sm">
              Đang tải file ảnh…
            </div>
          )}
        </div>
      )}
      {isVideo && (
        <div className="bg-black rounded-xl overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={work.fileUrl} controls preload="metadata" className="w-full max-h-96" />
          
        </div>
      )}
      {!isImageFile && !isVideo && (
        <a
          href={work.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white/80 hover:text-white"
        >
          Mở file {work.fileName} ({formatBytes(work.fileSize)})
        </a>
      )}
    </div>
  );
}

export default function StudioMgmt() {
  const { authenticatedFetch } = useAuth();
  const [rows, setRows] = useState<WorkSubmission[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewing, setViewing] = useState<WorkSubmission | null>(null);
  const [rejectTarget, setRejectTarget] = useState<WorkSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      if (filter === "all") {
        const [pending, approved, rejected] = await Promise.all([
          listReviewQueue(authenticatedFetch, { status: "pending", page: 1, pageSize: 20 }),
          listReviewQueue(authenticatedFetch, { status: "approved", page: 1, pageSize: 20 }),
          listReviewQueue(authenticatedFetch, { status: "rejected", page: 1, pageSize: 20 }),
        ]);
        setCounts(pending.counts);
        const merged = [...pending.items, ...approved.items, ...rejected.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setRows(merged);
      } else {
        const list = await listReviewQueue(authenticatedFetch, {
          status: filter,
          page: 1,
          pageSize: 20,
        });
        setCounts(list.counts);
        setRows(list.items);
      }
    } catch (error) {
      setLoadError(
        error instanceof WorksApiError
          ? error.message
          : "Không tải được hàng đợi duyệt. Hãy thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, filter]);

  useEffect(() => {
    // Gọi qua await để state chỉ đổi sau khi fetch xong, không đổi đồng bộ
    // trong thân effect (luật react-hooks/set-state-in-effect).
    void (async () => {
      await loadQueue();
    })();
  }, [loadQueue]);

  const decide = async (work: WorkSubmission, action: "approve" | "reject", reason?: string) => {
    setActingId(work.id);
    try {
      await reviewWork(authenticatedFetch, work.id, action, reason);
      toast.success(
        action === "approve" ? `Đã duyệt "${work.title}"` : `Đã từ chối "${work.title}"`,
      );
      setViewing(null);
      setRejectTarget(null);
      setRejectReason("");
      await loadQueue();
    } catch (error) {
      toast.error(
        error instanceof WorksApiError
          ? error.message
          : "Không thực hiện được. Hãy thử lại.",
      );
    } finally {
      setActingId(null);
    }
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 10) {
      setRejectError("Lý do từ chối phải có ít nhất 10 ký tự.");
      return;
    }
    setRejectError("");
    void decide(rejectTarget, "reject", reason);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: "Chờ duyệt", v: String(counts.pending), c: "text-amber-400" },
          { l: "Đã duyệt", v: String(counts.approved), c: "text-emerald-400" },
          { l: "Từ chối", v: String(counts.rejected), c: "text-rose-400" },
          { l: "Tổng tác phẩm", v: String(counts.total), c: "text-violet-400" },
        ].map((s) => (
          <Card key={s.l} className="p-4 text-center"><div className={`text-2xl font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-white/40 mt-1">{s.l}</div></Card>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as QueueFilter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm transition ${filter === f ? "text-white font-medium" : "bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:border-white/20"}`} style={filter === f ? SON : {}}>
            {f === "all" ? "Tất cả" : f === "pending" ? "Chờ duyệt" : f === "approved" ? "Đã duyệt" : "Từ chối"}
          </button>
        ))}
      </div>
      {loadError && (
        <p role="alert" className="text-sm text-red-300">{loadError}</p>
      )}
      <div className="space-y-3">
        {loading ? (
          <Card className="p-10 text-center text-white/30 text-sm">Đang tải hàng đợi duyệt…</Card>
        ) : (
          <>
            {rows.map((w) => (
              <Card key={w.id} className="p-4 hover:border-white/15 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-16 rounded-lg bg-white/10 shrink-0 flex items-center justify-center overflow-hidden">
                    <Wand2 className="w-5 h-5 text-white/30" />
                    {w.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">{w.title}</span>
                      <Bdg c={TYPE_BADGE_COLOR[w.type]}>{TYPE_LABEL[w.type]}</Bdg>
                      <StatusBadge status={w.status} />
                    </div>
                    <div className="text-xs text-white/50 mt-1">
                      Tác giả: <span className="text-white/70">{w.author.displayName} (@{w.author.username})</span>
                      {" · "}{w.fileName} ({formatBytes(w.fileSize)}) · Nộp {new Date(w.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                    {w.status === "rejected" && w.rejectReason && (
                      <div className="text-xs text-red-300/90 mt-1">Lý do từ chối: {w.rejectReason}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {w.status === "pending" && (
                      <>
                        <button disabled={actingId === w.id} onClick={() => void decide(w, "approve")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs hover:bg-emerald-500/30 transition disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Duyệt</button>
                        <button disabled={actingId === w.id} onClick={() => { setRejectTarget(w); setRejectReason(""); setRejectError(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs hover:bg-rose-500/30 transition disabled:opacity-50"><X className="w-3.5 h-3.5" /> Từ chối</button>
                      </>
                    )}
                    <Btn icon={Eye} onClick={() => setViewing(w)} />
                  </div>
                </div>
              </Card>
            ))}
            {rows.length === 0 && <Card className="p-10 text-center text-white/30 text-sm">Không có tác phẩm</Card>}
          </>
        )}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Chi tiết tác phẩm" wide
        footer={viewing?.status === "pending" ? <><button onClick={() => { if (viewing) { setRejectTarget(viewing); setRejectReason(""); setRejectError(""); setViewing(null); } }} className="px-4 py-2.5 rounded-xl text-sm bg-rose-500/20 text-rose-300 border border-rose-500/30">Từ chối</button><PrimaryBtn icon={Check} onClick={() => { if (viewing) void decide(viewing, "approve"); }}>Duyệt</PrimaryBtn></> : undefined}>
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="text-white font-semibold text-base">{viewing.title}</div>
            <div className="flex gap-2"><Bdg c={TYPE_BADGE_COLOR[viewing.type]}>{TYPE_LABEL[viewing.type]}</Bdg><StatusBadge status={viewing.status} /></div>
            <div className="text-white/60">Tác giả: <span className="text-white">{viewing.author.displayName} (@{viewing.author.username})</span></div>
            <div className="text-white/60">Nộp ngày: <span className="text-white">{new Date(viewing.createdAt).toLocaleString("vi-VN")}</span></div>
            {viewing.description && <p className="text-white/75 leading-relaxed">{viewing.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {viewing.tags.map((t) => (
                <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">#{t}</span>
              ))}
            </div>
            <PreviewMedia work={viewing} authenticatedFetch={authenticatedFetch} />
            <div className="text-white/60">
              File: <a href={viewing.fileUrl} target="_blank" rel="noreferrer" className="text-pink-300/80 hover:text-pink-300">{viewing.fileName} ({formatBytes(viewing.fileSize)})</a>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectTarget} onClose={() => { setRejectTarget(null); setRejectReason(""); setRejectError(""); }} title="Từ chối tác phẩm"
        footer={<><button onClick={() => { setRejectTarget(null); setRejectReason(""); setRejectError(""); }} className="px-4 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/10 text-white/70">Hủy</button><button disabled={actingId === rejectTarget?.id} onClick={confirmReject} className="px-4 py-2.5 rounded-xl text-sm bg-rose-500/20 text-rose-300 border border-rose-500/30 disabled:opacity-50">Xác nhận từ chối</button></>}>
        {rejectTarget && (
          <div className="space-y-3 text-sm">
            <p className="text-white/75">
              Từ chối “<span className="text-white">{rejectTarget.title}</span>” của {rejectTarget.author.displayName}. Tác giả sẽ thấy lý do và có thể gửi duyệt lại.
            </p>
            <label className="block">
              <span className="block text-xs text-white/50 mb-1.5">Lý do từ chối (ít nhất 10 ký tự) *</span>
              <textarea
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); if (rejectError) setRejectError(""); }}
                rows={4}
                placeholder="Ví dụ: Nét vẽ chưa rõ, cần tăng độ tương phản và sửa lại khung 3…"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50 resize-none"
              />
            </label>
            {rejectError && <p role="alert" className="text-red-300 text-xs">{rejectError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
