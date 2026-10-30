"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clapperboard, Download, Music, ShieldCheck, Trash2, XCircle } from "lucide-react";
import {
  CREDIT_LINE_HEIGHT,
  CREDIT_SPEED_DEFAULT,
  GRADE_FILTERS,
  TITLE_CARD_SEC,
  creditRollDuration,
  crossfadeBlend,
  drawCreditRoll,
  drawLowerThird,
  drawTitleCard,
  drawTransitionOverlay,
  fadeBlackAlpha,
  transitionCover,
  type ColorGrade,
  type TransitionType,
} from "../lib/postFx";
import {
  formatDuration,
  postSettingsOf,
  exportScenePostOf,
  projectDurationSec,
  sceneSpeed,
  type AnimProject,
} from "../lib/animProject";
import { checkProjectForExport, hasExportErrors } from "../lib/exportCheck";
import { drawSceneFrame } from "../lib/renderFrame";
import { buildFilmAudioPlan, renderFilmAudioMix } from "../lib/filmAudio";
import { createPrevizFilmRenderer } from "../lib/previzFilmRender";
import {
  bgmBlobKey,
  deleteVoiceBlob,
  listAnimAssets,
  saveVoiceBlob,
} from "../lib/animStorage";
import type { EffectFormula } from "../lib/effectFormula";
import { fxCustomTextureUrls, loadFxImage } from "../lib/fx2d";
import {
  EXPORT_PRESETS,
  EXPORT_PRESET_LIST,
  exportPresetOf,
  resolveExportSize,
  type ExportPresetId,
} from "../lib/exportPresets";
import { audioMasterOf } from "../lib/audioMaster";

/**
 * Kiểm tra & xuất bản toàn dự án:
 * - Kiểm tra luật cứng (lib/exportCheck) chạy tức thì, liệt kê lỗi/cảnh báo.
 * - Xuất WebM toàn phim (Slice B4/B5): 2D render bằng `drawSceneFrame`,
 *   3D render bằng `createPrevizFilmRenderer` — cả hai đều ghi kèm bản
 *   trộn tiếng (thoại + nhạc nền) vào cùng một file WebM. MP4 qua
 * WebCodecs là nâng cấp sau — WebM chạy được trên mọi trình duyệt demo.
 */
/**
 * Chạy credit roll lên canvas xuất (mỗi dòng một hàng, cuộn từ dưới lên);
 * trả về ngay khi không có dòng nào hoặc người dùng huỷ.
 */
async function playCreditRollOn(
  octx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
  speed: number,
  isCancelled: () => boolean,
): Promise<void> {
  if (lines.length === 0) return;
  const dur = creditRollDuration(lines.length, CREDIT_LINE_HEIGHT, height, speed);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const step = () => {
      if (isCancelled()) return resolve();
      const t = (performance.now() - start) / 1000;
      if (t >= dur) return resolve();
      drawCreditRoll(octx, width, height, lines, t, {
        speed,
        lineHeight: CREDIT_LINE_HEIGHT,
      });
      requestAnimationFrame(step);
    };
    step();
  });
}

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
  const [exportFile, setExportFile] = useState<{ url: string; name: string } | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const clearExportFile = () => {
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
    setExportFile(null);
  };

  const exportWebM = async () => {
    if (exporting || project.kind !== "2d") return;
    setExporting(true);
    cancelRef.current = false;
    clearExportFile();
    // Khổ khung + tốc độ khung hình theo kiểu xuất (giai đoạn D).
    const { width: W, height: H, fps } = resolveExportSize(
      exportPresetOf(project),
    );
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

    // Công thức hiệu ứng 2D từ thư viện + nạp trước ảnh hạt custom
    // (không có thì khung đầu thiếu hạt ảnh — giống cách nạp ảnh layer).
    const effectFormulas2d: EffectFormula[] = [];
    try {
      for (const a of await listAnimAssets()) {
        if (a.kind === "effect") effectFormulas2d.push(a.formula);
      }
    } catch {
      // Thư viện hiệu ứng lỗi — xuất tiếp không có hiệu ứng.
    }
    for (const s of project.scenes) {
      await Promise.all(
        fxCustomTextureUrls(s.fxEvents ?? [], effectFormulas2d).map((u) =>
          loadFxImage(u),
        ),
      );
    }

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
      tWall: number,
      tContent: number,
      sceneIndex: number,
      sceneWallDur: number,
      scene: (typeof project.scenes)[number],
    ) => {
      octx.save();
      octx.filter = GRADE_FILTERS[post.grade];
      octx.globalAlpha = 1;
      octx.drawImage(source, 0, 0);
      octx.restore();
      // Chuyển cảnh: hoà tan dùng phủ alpha cũ; quét/phóng/vòng tròn
      // dùng phủ khung mới; mờ qua đen dùng màn đen (xem postFx).
      const blend = crossfadeBlend(tWall, sceneIndex, post);
      if (blend > 0 && prevSnapshot) {
        octx.save();
        octx.globalAlpha = blend;
        octx.drawImage(prevSnapshot, 0, 0);
        octx.restore();
      } else if (prevSnapshot) {
        drawTransitionOverlay(
          octx,
          prevSnapshot,
          W,
          H,
          post.transition,
          transitionCover(tWall, sceneIndex, post),
        );
      }
      if (scene.lowerThird) {
        drawLowerThird(octx, W, H, scene.lowerThird, tContent);
      }
      const black = fadeBlackAlpha(
        tWall,
        sceneWallDur,
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
          drawTitleCard(
            octx,
            W,
            H,
            post.titleText ?? project.name,
            post.titleSubtitle ?? "Một bộ phim làm bằng AniMan",
            { sizeScale: post.titleSize, position: post.titlePosition },
          );
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
    let stream: MediaStream = out.captureStream(fps);
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
        stream = out.captureStream(fps);
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
          const speed = sceneSpeed(scene);
          const wallDur = scene.durationSec / speed;
          if (t >= wallDur) return resolve();
          drawSceneFrame(ctx, scene, t * speed, W, H, getImage, {
            effectFormulas: effectFormulas2d,
          });
          composite(canvas, t, t * speed, i, wallDur, scene);
          requestAnimationFrame(step);
        };
        step();
      });
      snapshotOut();
      elapsed = (performance.now() - startedAt) / 1000;
    }
    await playCreditRollOn(
      octx,
      W,
      H,
      post.creditsLines ?? [],
      post.creditsSpeed && post.creditsSpeed > 0
        ? post.creditsSpeed
        : CREDIT_SPEED_DEFAULT,
      () => cancelRef.current,
    );
    recorder.stop();
    await stopped;
    if (audioCtx) void audioCtx.close().catch(() => undefined);
    setProgress("");
    setExporting(false);
    void elapsed;
    if (cancelRef.current) return;
    setDoneNote(
      mix
        ? `Đã xuất phim kèm tiếng: ${audioPlan.clips.length} clip tiếng${
            project.bgm ? " + nhạc nền" : ""
          }${
            audioPlan.missing.length > 0
              ? ` (${audioPlan.missing.length} dòng chưa có giọng, chỉ hiện phụ đề)`
              : ""
          }.`
        : "Đã xuất phim (chưa có tiếng — hãy thu giọng cho các dòng thoại để phim có tiếng).",
    );
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const fileName = `${project.name.replace(/\s+/g, "-")}.webm`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Giu duong dan file de nut tai hien thi ben duoi co the bam bang chuot that;
    // thu hoi khi xuat moi hoac sau khi bam nut tai.
    exportUrlRef.current = url;
    setExportFile({ url, name: fileName });
  };

  const exportWebM3D = async () => {
    if (exporting || project.kind !== "3d") return;
    setExporting(true);
    cancelRef.current = false;
    clearExportFile();
    setDoneNote("");
    setProgress("Đang trộn tiếng cho phim…");
    const post = postSettingsOf(project);
    const titleSec = post.titleCard ? TITLE_CARD_SEC : 0;
    const mix = await renderFilmAudioMix(project, titleSec).catch(() => null);
    const audioPlan = buildFilmAudioPlan(project);
    const { width: W, height: H, fps } = resolveExportSize(
      exportPresetOf(project),
    );
    // Công thức hiệu ứng từ thư viện (luồn qua tham số, renderer thuần).
    const effectFormulas: EffectFormula[] = [];
    try {
      for (const a of await listAnimAssets()) {
        if (a.kind === "effect") effectFormulas.push(a.formula);
      }
    } catch {
      // Thư viện hiệu ứng lỗi — xuất tiếp không có hiệu ứng.
    }
    const film = createPrevizFilmRenderer(W, H, {
      applyScenePost: exportScenePostOf(project),
      effectFormulas,
    });
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const octx = out.getContext("2d")!;
    let prevSnapshot: HTMLCanvasElement | null = null;
    const composite3D = (
      tWall: number,
      tContent: number,
      sceneIndex: number,
      sceneWallDur: number,
      scene: (typeof project.scenes)[number],
    ) => {
      octx.save();
      octx.filter = GRADE_FILTERS[post.grade];
      octx.globalAlpha = 1;
      octx.drawImage(film.canvas, 0, 0);
      octx.restore();
      const blend = crossfadeBlend(tWall, sceneIndex, post);
      if (blend > 0 && prevSnapshot) {
        octx.save();
        octx.globalAlpha = blend;
        octx.drawImage(prevSnapshot, 0, 0);
        octx.restore();
      } else if (prevSnapshot) {
        drawTransitionOverlay(
          octx,
          prevSnapshot,
          W,
          H,
          post.transition,
          transitionCover(tWall, sceneIndex, post),
        );
      }
      if (scene.lowerThird) {
        drawLowerThird(octx, W, H, scene.lowerThird, tContent);
      }
      const black = fadeBlackAlpha(
        tWall,
        sceneWallDur,
        sceneIndex === 0,
        sceneIndex === project.scenes.length - 1,
        post,
      );
      if (black > 0) {
        octx.fillStyle = `rgba(0,0,0,${black})`;
        octx.fillRect(0, 0, W, H);
      }
    };
    let audioCtx: AudioContext | null = null;
    let stream: MediaStream = out.captureStream(fps);
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
        stream = out.captureStream(fps);
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
          drawTitleCard(
            octx,
            W,
            H,
            post.titleText ?? project.name,
            post.titleSubtitle ?? "Một bộ phim làm bằng AniMan",
            { sizeScale: post.titleSize, position: post.titlePosition },
          );
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
          const speed = sceneSpeed(scene);
          const wallDur = scene.durationSec / speed;
          if (t >= wallDur) return resolve();
          film.drawAt(scene, t * speed);
          composite3D(t, t * speed, i, wallDur, scene);
          requestAnimationFrame(step);
        };
        step();
      });
      const snap = document.createElement("canvas");
      snap.width = W;
      snap.height = H;
      snap.getContext("2d")!.drawImage(out, 0, 0);
      prevSnapshot = snap;
    }
    await playCreditRollOn(
      octx,
      W,
      H,
      post.creditsLines ?? [],
      post.creditsSpeed && post.creditsSpeed > 0
        ? post.creditsSpeed
        : CREDIT_SPEED_DEFAULT,
      () => cancelRef.current,
    );
    recorder.stop();
    await stopped;
    film.dispose();
    if (audioCtx) void audioCtx.close().catch(() => undefined);
    setProgress("");
    setExporting(false);
    if (cancelRef.current) return;
    setDoneNote(
      mix
        ? `Đã xuất phim 3D hoàn chỉnh kèm tiếng: ${audioPlan.clips.length} clip tiếng${
            project.bgm ? " + nhạc nền" : ""
          }.`
        : "Đã xuất phim 3D hoàn chỉnh (chưa có tiếng — hãy thu giọng cho các dòng thoại để phim có tiếng).",
    );
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const fileName = `${project.name.replace(/\s+/g, "-")}.webm`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Giu duong dan file de nut tai hien thi ben duoi co the bam bang chuot that;
    // thu hoi khi xuat moi hoac sau khi bam nut tai.
    exportUrlRef.current = url;
    setExportFile({ url, name: fileName });
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
            <Music className="w-3.5 h-3.5" /> ÂM THANH TỔNG
          </h3>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={audioMasterOf(project).enabled}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    master: {
                      ...audioMasterOf(project),
                      enabled: e.currentTarget.checked,
                    },
                  })
                }
                className="accent-emerald-400"
              />
              Nhạc tự nhỏ dưới thoại + cân âm lượng
            </label>
            <label className="flex items-center gap-2">
              Nhạc còn lại khi có thoại
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.05}
                value={audioMasterOf(project).duckLevel}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    master: {
                      ...audioMasterOf(project),
                      duckLevel: Number(e.currentTarget.value),
                    },
                  })
                }
                className="w-24 accent-emerald-400"
              />
              <span className="w-9 text-white/70">
                {Math.round(audioMasterOf(project).duckLevel * 100)}%
              </span>
            </label>
            <label className="flex items-center gap-2">
              Hạ nhanh (giây)
              <input
                type="range"
                min={0.02}
                max={1}
                step={0.05}
                value={audioMasterOf(project).attackSec}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    master: {
                      ...audioMasterOf(project),
                      attackSec: Number(e.currentTarget.value),
                    },
                  })
                }
                className="w-24 accent-emerald-400"
              />
            </label>
            <label className="flex items-center gap-2">
              Nhả chậm (giây)
              <input
                type="range"
                min={0.05}
                max={2}
                step={0.05}
                value={audioMasterOf(project).releaseSec}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    master: {
                      ...audioMasterOf(project),
                      releaseSec: Number(e.currentTarget.value),
                    },
                  })
                }
                className="w-24 accent-emerald-400"
              />
            </label>
          </div>
          
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
                <option value="wipe-left">Quét sang trái</option>
                <option value="wipe-right">Quét sang phải</option>
                <option value="wipe-up">Quét lên trên</option>
                <option value="wipe-down">Quét xuống dưới</option>
                <option value="zoom">Phóng to rồi mờ</option>
                <option value="iris-open">Vòng tròn mở ra</option>
                <option value="iris-close">Vòng tròn khép lại</option>
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
            <label className="flex items-center gap-2">
              Kiểu xuất
              <select
                value={exportPresetOf(project)}
                onChange={(e) => {
                  const id = e.currentTarget.value as ExportPresetId;
                  const p = EXPORT_PRESETS[id];
                  onProjectChange({
                    ...project,
                    exportPreset: id,
                    post: {
                      ...postSettingsOf(project),
                      transition: p.transition,
                      grade: p.grade,
                      titleCard: p.titleCard,
                    },
                  });
                }}
                className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
              >
                {EXPORT_PRESET_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exportScenePostOf(project)}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    exportScenePost: e.currentTarget.checked,
                  })
                }
                className="accent-pink-400"
              />
              Hậu kỳ cảnh khi xuất phim 3D (phát sáng, mờ hậu cảnh, dư ảnh)
            </label>
          </div>
          <p className="text-[11px] text-white/35">
            {EXPORT_PRESETS[exportPresetOf(project)].desc} Chọn kiểu xuất sẽ
            đặt lại hậu kỳ mặc định — chỉnh lại sau nếu muốn. Khung dọc
            9:16 xuất đúng tỉ lệ và khung xem trong trình dựng cũng hiện
            khung dọc để căn hình. Tắt hậu kỳ cảnh nếu máy yếu — xuất sẽ
            nhanh hơn nhưng mất hiệu ứng hậu kỳ của từng cảnh.
          </p>
          {postSettingsOf(project).titleCard && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/55">
              <label className="flex items-center gap-2">
                Chữ tiêu đề
                <input
                  value={postSettingsOf(project).titleText ?? ""}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      post: {
                        ...postSettingsOf(project),
                        titleText: e.currentTarget.value || undefined,
                      },
                    })
                  }
                  placeholder={project.name}
                  className="h-8 w-44 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80 outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                Dòng phụ
                <input
                  value={postSettingsOf(project).titleSubtitle ?? ""}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      post: {
                        ...postSettingsOf(project),
                        titleSubtitle: e.currentTarget.value || undefined,
                      },
                    })
                  }
                  placeholder="Một bộ phim làm bằng AniMan"
                  className="h-8 w-52 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80 outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                Cỡ chữ
                <input
                  type="range"
                  min={0.7}
                  max={1.5}
                  step={0.1}
                  value={postSettingsOf(project).titleSize ?? 1}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      post: {
                        ...postSettingsOf(project),
                        titleSize: Number(e.currentTarget.value),
                      },
                    })
                  }
                  className="w-24 accent-pink-400"
                />
              </label>
              <label className="flex items-center gap-2">
                Vị trí
                <select
                  value={postSettingsOf(project).titlePosition ?? "center"}
                  onChange={(e) =>
                    onProjectChange({
                      ...project,
                      post: {
                        ...postSettingsOf(project),
                        titlePosition: e.currentTarget.value as
                          | "center"
                          | "top"
                          | "bottom",
                      },
                    })
                  }
                  className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
                >
                  <option value="center">Giữa</option>
                  <option value="top">Trên</option>
                  <option value="bottom">Dưới</option>
                </select>
              </label>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-[12px] text-white/55">
              Credit cuối phim (mỗi dòng một hàng, để trống là không có)
              <textarea
                value={(postSettingsOf(project).creditsLines ?? []).join("\n")}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    post: {
                      ...postSettingsOf(project),
                      creditsLines: e.currentTarget.value
                        .split("\n")
                        .filter((l) => l.trim().length > 0),
                    },
                  })
                }
                placeholder={"Đạo diễn: An\nDiễn viên: …"}
                rows={2}
                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-[12px] text-white/80 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-[12px] text-white/55">
              Tốc độ cuộn credit
              <input
                type="range"
                min={30}
                max={120}
                step={10}
                value={postSettingsOf(project).creditsSpeed ?? CREDIT_SPEED_DEFAULT}
                onChange={(e) =>
                  onProjectChange({
                    ...project,
                    post: {
                      ...postSettingsOf(project),
                      creditsSpeed: Number(e.currentTarget.value),
                    },
                  })
                }
                className="w-24 accent-pink-400"
              />
              <span className="tabular-nums">
                {postSettingsOf(project).creditsSpeed ?? CREDIT_SPEED_DEFAULT} px/giây
              </span>
            </label>
          </div>
          
        </div>
      )}

      {doneNote && (
        <p className="text-[12px] text-emerald-300/90">{doneNote}</p>
      )}

      {exportFile && (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportFile.url}
            download={exportFile.name}
            onClick={() => {
              setTimeout(() => clearExportFile(), 4000);
            }}
            className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 text-sm font-medium hover:opacity-90 transition"
          >
            <Download className="w-4 h-4" />
            Tải file WebM xuống
          </a>
          <span className="text-[12px] text-white/50">{exportFile.name}</span>
        </div>
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
      
    </div>
  );
}
