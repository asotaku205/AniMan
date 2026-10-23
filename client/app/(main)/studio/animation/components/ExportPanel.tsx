"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clapperboard, Download, Music, ShieldCheck, Trash2, XCircle } from "lucide-react";
import {
  formatDuration,
  projectDurationSec,
  type AnimProject,
} from "../lib/animProject";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";
import { drawSceneFrame } from "../lib/renderFrame";
import { postSettingsOf } from "../lib/animProject";
import {
  GRADE_FILTERS,
  TITLE_CARD_SEC,
  crossfadeBlend,
  drawTitleCard,
  fadeBlackAlpha,
  type ColorGrade,
  type TransitionType,
} from "../lib/postFx";
import { buildFilmAudioPlan, renderFilmAudioMix } from "../lib/filmAudio";
import { createPrevizFilmRenderer } from "../lib/previzFilmRender";
import {
  bgmBlobKey,
  deleteVoiceBlob,
  saveVoiceBlob,
} from "../lib/animStorage";

/**
 * Kiểm tra & xuất bản toàn dự án:
 * - Kiểm tra luật cứng (lib/exportCheck) chạy tức thì, liệt kê lỗi/cảnh báo.
 * - Xuất WebM toàn phim (Slice B4/B5): 2D render bằng `drawSceneFrame`,
 *   3D render bằng `createPrevizFilmRenderer` — cả hai đều ghi kèm bản
 *   trộn tiếng (thoại + nhạc nền) vào cùng một file WebM. MP4 qua
 * WebCodecs là nâng cấp sau — WebM chạy được trên mọi trình duyệt demo.
 */
export function ExportPanel({
  project,
  onProjectChange,
}: {
  project: AnimProject;
  onProjectChange?: (project: AnimProject) => void;
}) {
  const issues = useMemo(() => checkProjectForExport(project), [project]);
  const errors = hasExportErrors(issues);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [doneNote, setDoneNote] = useState("");
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

    // Hậu kỳ (Đ3): hợp thành khung hình qua canvas riêng để áp chuyển
    // cảnh + chỉnh màu + màn hình tiêu đề
    const post = postSettingsOf(project);
    const titleSec = post.titleCard ? TITLE_CARD_SEC : 0;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d")!;
    let prevSnapshot: HTMLCanvasElement | null = null;
    const snapshotOut = () => {
      const snap = document.createElement("canvas");
      snap.width = W;
      snap.height = H;
      snap.getContext("2d")!.drawImage(out, 0, 0);
      prevSnapshot = snap;
    };
    const composite = (
      source: HTMLCanvasElement,
      tInScene: number,
      sceneIndex: number,
      sceneDur: number,
    ) => {
      octx.save();
      octx.filter = GRADE_FILTERS[post.grade];
      octx.globalAlpha = 1;
      octx.drawImage(source, 0, 0);
      octx.restore();
      const blend = crossfadeBlend(tInScene, sceneIndex, post);
      if (blend > 0 && prevSnapshot) {
        octx.save();
        octx.globalAlpha = blend;
        octx.drawImage(prevSnapshot, 0, 0);
        octx.restore();
      }
      const black = fadeBlackAlpha(
        tInScene,
        sceneDur,
        sceneIndex === 0,
        sceneIndex === project.scenes.length - 1,
        post,
      );
      if (black > 0) {
        octx.fillStyle = `rgba(0,0,0,${black})`;
        octx.fillRect(0, 0, W, H);
      }
    };
    const playTitleCard = async () => {
      if (!post.titleCard) return;
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (cancelRef.current) return resolve();
          const t = (performance.now() - start) / 1000;
          if (t >= TITLE_CARD_SEC) return resolve();
          drawTitleCard(octx, W, H, project.name, "Một bộ phim làm bằng AniMan");
          requestAnimationFrame(step);
        };
        step();
      });
    };

    // Trộn tiếng (thoại đã chọn + nhạc nền) TRƯỚC khi ghi hình
    setProgress("Đang trộn tiếng cho phim…");
    const mix = await renderFilmAudioMix(project, titleSec).catch(() => null);
    const audioPlan = buildFilmAudioPlan(project);
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream = out.captureStream(30);
    if (mix) {
      try {
        audioCtx = new AudioContext();
        const mixBuf = await audioCtx.decodeAudioData(
          await mix.arrayBuffer(),
        );
        const src = audioCtx.createBufferSource();
        src.buffer = mixBuf;
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        stream = new MediaStream([
          ...stream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
        // Phát bản trộn đồng bộ với lúc bắt đầu ghi hình (ngay dưới đây)
        queueMicrotask(() => {
          try {
            src.start();
          } catch {
            /* nguồn đã huỷ */
          }
        });
      } catch {
        audioCtx = null;
        stream = out.captureStream(30);
      }
    }
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((r) => {
      recorder.onstop = () => r();
    });
    recorder.start(200);
    await playTitleCard();

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
          composite(canvas, t, i, scene.durationSec);
          requestAnimationFrame(step);
        };
        step();
      });
      snapshotOut();
      elapsed = (performance.now() - startedAt) / 1000;
    }
    recorder.stop();
    await stopped;
    if (audioCtx) void audioCtx.close().catch(() => undefined);
    setProgress("");
    setExporting(false);
    void elapsed;
    if (cancelRef.current) return;
    setDoneNote(
      mix
        ? `Đã xuất phim kèm tiếng: ${audioPlan.clips.length} dòng thoại có giọng${
            project.bgm ? " + nhạc nền" : ""
          }${
            audioPlan.missing.length > 0
              ? ` (${audioPlan.missing.length} dòng chưa có giọng — chỉ hiện phụ đề)`
              : ""
          }.`
        : "Đã xuất phim (chưa có tiếng — hãy thu giọng cho các dòng thoại để phim có tiếng).",
    );
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "-")}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const exportWebM3D = async () => {
    if (exporting || project.kind !== "3d") return;
    setExporting(true);
    cancelRef.current = false;
    setDoneNote("");
    setProgress("Đang trộn tiếng cho phim…");
    const post = postSettingsOf(project);
    const titleSec = post.titleCard ? TITLE_CARD_SEC : 0;
    const mix = await renderFilmAudioMix(project, titleSec).catch(() => null);
    const audioPlan = buildFilmAudioPlan(project);
    const film = createPrevizFilmRenderer(960, 540);
    const out = document.createElement("canvas");
    out.width = 960;
    out.height = 540;
    const octx = out.getContext("2d")!;
    let prevSnapshot: HTMLCanvasElement | null = null;
    const composite3D = (
      tInScene: number,
      sceneIndex: number,
      sceneDur: number,
    ) => {
      octx.save();
      octx.filter = GRADE_FILTERS[post.grade];
      octx.globalAlpha = 1;
      octx.drawImage(film.canvas, 0, 0);
      octx.restore();
      const blend = crossfadeBlend(tInScene, sceneIndex, post);
      if (blend > 0 && prevSnapshot) {
        octx.save();
        octx.globalAlpha = blend;
        octx.drawImage(prevSnapshot, 0, 0);
        octx.restore();
      }
      const black = fadeBlackAlpha(
        tInScene,
        sceneDur,
        sceneIndex === 0,
        sceneIndex === project.scenes.length - 1,
        post,
      );
      if (black > 0) {
        octx.fillStyle = `rgba(0,0,0,${black})`;
        octx.fillRect(0, 0, 960, 540);
      }
    };
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream = out.captureStream(30);
    if (mix) {
      try {
        audioCtx = new AudioContext();
        const mixBuf = await audioCtx.decodeAudioData(
          await mix.arrayBuffer(),
        );
        const src = audioCtx.createBufferSource();
        src.buffer = mixBuf;
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        stream = new MediaStream([
          ...stream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
        queueMicrotask(() => {
          try {
            src.start();
          } catch {
            /* nguồn đã huỷ */
          }
        });
      } catch {
        audioCtx = null;
        stream = out.captureStream(30);
      }
    }
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((r) => {
      recorder.onstop = () => r();
    });
    recorder.start(200);
    if (post.titleCard) {
      setProgress("Đang dựng màn hình tiêu đề…");
      const start = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (cancelRef.current) return resolve();
          const t = (performance.now() - start) / 1000;
          if (t >= TITLE_CARD_SEC) return resolve();
          drawTitleCard(octx, 960, 540, project.name, "Một bộ phim làm bằng AniMan");
          requestAnimationFrame(step);
        };
        step();
      });
    }
    for (let i = 0; i < project.scenes.length; i++) {
      const scene = project.scenes[i];
      if (cancelRef.current) break;
      setProgress(
        `Đang dựng cảnh ${i + 1}/${project.scenes.length}: ${scene.name}`,
      );
      await film.loadScene(scene);
      const sceneStart = performance.now();
      await new Promise<void>((resolve) => {
        const step = () => {
          if (cancelRef.current) return resolve();
          const t = (performance.now() - sceneStart) / 1000;
          if (t >= scene.durationSec) return resolve();
          film.drawAt(scene, t);
          composite3D(t, i, scene.durationSec);
          requestAnimationFrame(step);
        };
        step();
      });
      const snap = document.createElement("canvas");
      snap.width = 960;
      snap.height = 540;
      snap.getContext("2d")!.drawImage(out, 0, 0);
      prevSnapshot = snap;
    }
    recorder.stop();
    await stopped;
    film.dispose();
    if (audioCtx) void audioCtx.close().catch(() => undefined);
    setProgress("");
    setExporting(false);
    if (cancelRef.current) return;
    setDoneNote(
      mix
        ? `Đã xuất phim 3D hoàn chỉnh kèm tiếng: ${audioPlan.clips.length} dòng thoại có giọng${
            project.bgm ? " + nhạc nền" : ""
          }.`
        : "Đã xuất phim 3D hoàn chỉnh (chưa có tiếng — hãy thu giọng cho các dòng thoại để phim có tiếng).",
    );
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

      {onProjectChange && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
          <h3 className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5" /> NHẠC NỀN TOÀN PHIM
          </h3>
          {project.bgm ? (
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              <span className="text-white/75">{project.bgm.name}</span>
              <label className="flex items-center gap-1.5 text-white/45">
                Âm lượng
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={project.bgm.volume}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      bgm: {
                        ...project.bgm!,
                        volume: Number(e.currentTarget.value),
                      },
                    })
                  }
                  className="w-24 accent-emerald-400"
                />
              </label>
              <label className="flex items-center gap-1.5 text-white/45">
                <input
                  type="checkbox"
                  checked={project.bgm.loop}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      bgm: { ...project.bgm!, loop: e.currentTarget.checked },
                    })
                  }
                  className="accent-emerald-400"
                />
                Lặp khi nhạc ngắn hơn phim
              </label>
              <button
                onClick={() => {
                  void deleteVoiceBlob(project.bgm!.blobKey).catch(
                    () => undefined,
                  );
                  onProjectChange({ ...project, bgm: null });
                }}
                className="flex items-center gap-1 text-white/40 hover:text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xoá nhạc nền
              </button>
            </div>
          ) : (
            <label className="flex flex-wrap items-center gap-2 text-[12px] text-white/50">
              <span>Chọn một file nhạc — nhạc tự nhỏ dần ở cuối phim khi xuất.</span>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (!file) return;
                  const key = bgmBlobKey(project.id);
                  void saveVoiceBlob(key, file)
                    .then(() =>
                      onProjectChange({
                        ...project,
                        bgm: {
                          blobKey: key,
                          name: file.name,
                          volume: 0.35,
                          loop: true,
                        },
                      }),
                    )
                    .catch(() => undefined);
                }}
                className="text-[12px] file:mr-2 file:px-3 file:h-8 file:rounded-lg file:border file:border-white/15 file:bg-white/5 file:text-white/70"
              />
            </label>
          )}
        </div>
      )}

      {onProjectChange && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
          <h3 className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5" /> HẬU KỲ BẢN XUẤT
          </h3>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
            <label className="flex items-center gap-2">
              Chuyển cảnh
              <select
                value={postSettingsOf(project).transition}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    post: {
                      ...postSettingsOf(project),
                      transition: e.currentTarget.value as TransitionType,
                    },
                  })
                }
                className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
              >
                <option value="none">Không chuyển cảnh</option>
                <option value="crossfade">Hoà tan (khuyên dùng)</option>
                <option value="fade">Mờ qua đen</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Tông màu
              <select
                value={postSettingsOf(project).grade}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    post: {
                      ...postSettingsOf(project),
                      grade: e.currentTarget.value as ColorGrade,
                    },
                  })
                }
                className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
              >
                <option value="none">Nguyên bản</option>
                <option value="fresh">Tươi sáng</option>
                <option value="warm">Ấm áp</option>
                <option value="cool">Mát lạnh</option>
                <option value="cinema">Điện ảnh</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={postSettingsOf(project).titleCard}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    post: {
                      ...postSettingsOf(project),
                      titleCard: e.currentTarget.checked,
                    },
                  })
                }
                className="accent-pink-400"
              />
              Màn hình tiêu đề đầu phim
            </label>
          </div>
          <p className="text-[11px] text-white/35">
            Hậu kỳ chỉ áp khi xuất phim — không thay đổi cảnh gốc, đổi ý thì
            xuất lại là xong.
          </p>
        </div>
      )}

      {doneNote && (
        <p className="text-[12px] text-emerald-300/90">{doneNote}</p>
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void exportWebM3D()}
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
          {progress && (
            <span className="text-[12px] text-white/50">{progress}</span>
          )}
          {errors && (
            <span className="text-[12px] text-rose-300/80">
              Sửa các lỗi đỏ ở trên trước khi xuất.
            </span>
          )}
          <span className="text-[12px] text-white/35">
            Toàn bộ các cảnh 3D được ghép thành một phim duy nhất kèm
            tiếng. Vẫn có thể xuất riêng từng cảnh trong trình dựng cảnh 3D.
          </span>
        </div>
      )}
      <p className="text-[11px] text-white/30">
        Định dạng MP4 (WebCodecs) là nâng cấp dự kiến sau; WebM hiện tại phát
        tốt trên Chrome/Edge/Firefox và tải lên được YouTube/TikTok.
      </p>
    </div>
  );
}
