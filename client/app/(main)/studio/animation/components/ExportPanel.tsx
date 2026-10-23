"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ShieldCheck, XCircle } from "lucide-react";
import {
  formatDuration,
  projectDurationSec,
  type AnimProject,
} from "../lib/animProject";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";
import { drawSceneFrame } from "../lib/renderFrame";

/**
 * Kiểm tra & xuất bản toàn dự án:
 * - Kiểm tra luật cứng (lib/exportCheck) chạy tức thì, liệt kê lỗi/cảnh báo.
 * - Xuất WebM (dự án 2D): render từng cảnh bằng đúng hàm vẽ deterministic
 *   `drawSceneFrame`, ghi bằng MediaRecorder theo thời gian thực.
 * Dự án 3D xuất WebM theo từng cảnh ngay trong PrevizEditor. MP4 qua
 * WebCodecs là nâng cấp sau — WebM chạy được trên mọi trình duyệt demo.
 */
export function ExportPanel({ project }: { project: AnimProject }) {
  const issues = useMemo(() => checkProjectForExport(project), [project]);
  const errors = hasExportErrors(issues);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const cancelRef = useRef(false);

  const exportWebM = async () => {
    if (exporting || project.kind !== "2d") return;
    setExporting(true);
    cancelRef.current = false;
    const W = 960;
    const H = 540;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setExporting(false);
      return;
    }
    // Nạp trước mọi hình layer
    const imageCache = new Map<string, HTMLImageElement>();
    const urls = new Set<string>();
    for (const s of project.scenes) {
      for (const l of s.timeline?.layers ?? []) {
        if (l.imageDataUrl) urls.add(l.imageDataUrl);
      }
    }
    await Promise.all(
      [...urls].map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
            imageCache.set(url, img);
          }),
      ),
    );
    const getImage = (url: string) => imageCache.get(url) ?? null;

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((r) => {
      recorder.onstop = () => r();
    });
    recorder.start(200);

    const startedAt = performance.now();
    let elapsed = 0;
    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i];
      if (cancelRef.current) break;
      setProgress(`Đang render cảnh ${i + 1}/${project.scenes.length}: ${scene.name}`);
      const sceneStart = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (cancelRef.current) return resolve();
          const t = (performance.now() - sceneStart) / 1000;
          if (t >= scene.durationSec) return resolve();
          drawSceneFrame(ctx, scene, t, W, H, getImage);
          requestAnimationFrame(step);
        };
        step();
      });
      elapsed = (performance.now() - startedAt) / 1000;
    }
    recorder.stop();
    await stopped;
    setProgress("");
    setExporting(false);
    void elapsed;
    if (cancelRef.current) return;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "-")}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-white/80 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          KIỂM TRA & XUẤT BẢN
        </h2>
        <span className="text-[12px] text-white/40">
          {project.scenes.length} cảnh · Tổng {formatDuration(projectDurationSec(project))}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-emerald-300">
          <CheckCircle2 className="w-4 h-4" /> Mọi kiểm tra đều đạt — sẵn sàng xuất bản.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-[13px] leading-relaxed ${
                issue.level === "error" ? "text-rose-300" : "text-amber-200/85"
              }`}
            >
              {issue.level === "error" ? (
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      {project.kind === "2d" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void exportWebM()}
            disabled={exporting || errors}
            className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất…" : "Xuất WebM toàn phim"}
          </button>
          {exporting && (
            <button
              onClick={() => {
                cancelRef.current = true;
              }}
              className="px-3 h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
            >
              Huỷ xuất
            </button>
          )}
          {progress && <span className="text-[12px] text-white/50">{progress}</span>}
          {errors && (
            <span className="text-[12px] text-rose-300/80">
              Sửa các lỗi đỏ ở trên trước khi xuất.
            </span>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-white/45 leading-relaxed">
          Dự án 3D: xuất WebM theo từng cảnh ngay trong trình dựng cảnh 3D
          (nút "Xuất WebM cảnh này"). Ghép các đoạn lại bằng trình dựng
          video bất kỳ.
        </p>
      )}
      <p className="text-[11px] text-white/30">
        Định dạng MP4 (WebCodecs) là nâng cấp dự kiến sau; WebM hiện tại phát
        tốt trên Chrome/Edge/Firefox và tải lên được YouTube/TikTok.
      </p>
    </div>
  );
}
