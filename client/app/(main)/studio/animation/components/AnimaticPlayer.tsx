"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import {
  formatDuration,
  postSettingsOf,
  type AnimProject,
} from "../lib/animProject";
import {
  contentTimeInSegment,
  filmTimeline,
  previewTimeline,
  segmentAtTime,
  segmentAtWallTime,
} from "../lib/animatic";
import { drawSceneFrame } from "../lib/renderFrame";
import { fxCustomTextureUrls, loadFxImage } from "../lib/fx2d";
import { createPrevizFilmRenderer } from "../lib/previzFilmRender";
import { listAnimAssets } from "../lib/animStorage";
import type { EffectFormula } from "../lib/effectFormula";
import {
  createFilmPreviewAudio,
  dialogueAtWallTime,
  type FilmPreviewAudio,
} from "../lib/filmPreview";
import {
  CREDIT_LINE_HEIGHT,
  CREDIT_SPEED_DEFAULT,
  TRANSITION_SEC,
  drawCreditRoll,
  drawLowerThird,
  drawTitleCard,
  drawTransitionOverlay,
  fadeBlackAlpha,
  transitionCover,
} from "../lib/postFx";

const W = 960;
const H = 540;

/**
 * Phát thử toàn phim ĐỒNG BỘ (S1): chiếu KHUNG HÌNH THẬT của mọi cảnh
 * (2D vẽ theo timeline, 3D dựng theo cảnh 3D) trên cùng một đồng hồ với
 * tiếng thoại + nhạc nền và phụ đề — trước đây bản phát thử chỉ hiện
 * tên cảnh, tiếng chỉ nghe được từng cảnh trong editor nên nhịp hình và
 * tiếng không bao giờ khớp nhau khi xem toàn phim. Khi phim có tiếng,
 * đồng hồ chủ là AudioContext (hình bám tiếng); chưa có tiếng thì dùng
 * đồng hồ hiệu năng. Mốc thoại dùng chung bản kế hoạch với bản xuất.
 */
export function AnimaticPlayer({
  project,
  jumpRequest,
}: {
  project: AnimProject;
  /** Nhảy xem thử tới mốc này (đổi nonce để nhảy lại cùng mốc). */
  jumpRequest?: { sec: number; nonce: number } | null;
}) {
  const post = postSettingsOf(project);
  // Timeline phát thử: tiêu đề đầu phim + cảnh theo thời gian chiếu
  // (đã áp tốc độ từng cảnh) + credit cuối phim.
  const tl = useMemo(
    () => previewTimeline({ scenes: project.scenes, post }),
    [project.scenes, post],
  );
  const segments = tl.segments;
  const wallSegments = useMemo(() => filmTimeline(project.scenes), [project.scenes]);
  const totalSec = tl.totalSec;
  const titleSec = tl.titleSec;
  const [playing, setPlaying] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<FilmPreviewAudio | null>(null);
  const audioReadyRef = useRef(false);
  const perfBaseRef = useRef<{ stamp: number; from: number } | null>(null);
  const filmRef = useRef<ReturnType<typeof createPrevizFilmRenderer> | null>(null);
  // Công thức hiệu ứng từ thư viện (luồn vào renderer phim qua tham số,
  // không để renderer đọc IndexedDB) — nạp 1 lần khi mở trang xem thử.
  const [effectFormulas, setEffectFormulas] = useState<EffectFormula[]>([]);
  const effectFormulasRef = useRef<EffectFormula[]>([]);
  useEffect(() => {
    let alive = true;
    listAnimAssets()
      .then((assets) => {
        if (!alive) return;
        const fs: EffectFormula[] = [];
        for (const a of assets) if (a.kind === "effect") fs.push(a.formula);
        effectFormulasRef.current = fs;
        setEffectFormulas(fs);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // Công thức về sau thì đẩy vào renderer đang chạy + renderer nạp trước.
  useEffect(() => {
    filmRef.current?.setEffectFormulas(effectFormulas);
    preloadRef.current?.renderer.setEffectFormulas(effectFormulas);
  }, [effectFormulas]);
  const filmSceneRef = useRef<string | null>(null);
  const filmLoadingRef = useRef<string | null>(null);
  // Renderer nạp trước cảnh 3D kế tiếp để chuyển đoạn không khựng hình.
  const preloadRef = useRef<{
    renderer: ReturnType<typeof createPrevizFilmRenderer>;
    sceneId: string;
    scene: (typeof project.scenes)[number];
    ready: boolean;
  } | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesTick, setImagesTick] = useState(0);
  // Ảnh chụp khung cuối của cảnh trước — dùng cho chuyển cảnh phát thử.
  const snapshotRef = useRef<HTMLCanvasElement | null>(null);
  const lastSegIndexRef = useRef<number | null>(null);

  // Đồng hồ hiện tại theo nguồn chủ đang dùng
  const currentTime = (): number => {
    const audio = audioRef.current;
    if (audio && audioReadyRef.current && audio.hasAudio) return audio.now();
    if (perfBaseRef.current) {
      return perfBaseRef.current.from + (performance.now() - perfBaseRef.current.stamp) / 1000;
    }
    return timeSec;
  };

  // Chữ ký dữ liệu TIẾNG của dự án: engine phát thử phải dựng lại khi
  // người dùng thu giọng mới / thêm clip hiệu ứng / đổi nhạc nền trong
  // lúc trang đang mở — trước đây engine chỉ dựng 1 lần lúc mở trang
  // nên giọng thu sau đó không bao giờ được nhận (phải tải lại trang).
  const audioSignature = useMemo(
    () =>
      JSON.stringify({
        bgm: project.bgm?.blobKey ?? "",
        title: post.titleCard,
        scenes: project.scenes.map((s) => ({
          d: s.durationSec,
          speed: s.speed ?? 1,
          takes: (s.dialogue ?? []).map(
            (l) => `${l.selectedTakeId ?? ""}@${l.startSec}`,
          ),
          clips: (s.audioClips ?? []).map(
            (c) => `${c.id}@${c.startSec}/${c.durationSec}/${c.volume}`,
          ),
        })),
      }),
    [project, post.titleCard],
  );

  // Chuẩn bị tiếng (dựng lại khi dữ liệu tiếng thay đổi)
  useEffect(() => {
    const audio = createFilmPreviewAudio(project, titleSec);
    audioRef.current = audio;
    audioReadyRef.current = false;
    void audio.prepare().then(() => {
      audioReadyRef.current = true;
    });
    return () => {
      audio.dispose();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, audioSignature, titleSec]);

  // Nạp trước ảnh hạt custom của hiệu ứng 2D khi công thức về tới
  // (cache module của fx2d — khung chưa xong thì bỏ qua hạt đó).
  useEffect(() => {
    if (project.kind !== "2d" || effectFormulas.length === 0) return;
    const urls = new Set<string>();
    for (const s of project.scenes)
      for (const u of fxCustomTextureUrls(s.fxEvents ?? [], effectFormulas))
        urls.add(u);
    if (urls.size === 0) return;
    let alive = true;
    Promise.all([...urls].map((u) => loadFxImage(u))).then(() => {
      if (alive) setImagesTick((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [project, effectFormulas]);

  // Nạp trước hình layer 2D
  useEffect(() => {
    if (project.kind !== "2d") return;
    const urls = new Set<string>();
    for (const s of project.scenes)
      for (const l of s.timeline?.layers ?? [])
        if (l.imageDataUrl) urls.add(l.imageDataUrl);
    for (const url of urls) {
      if (imagesRef.current.has(url)) continue;
      const img = new Image();
      img.onload = () => setImagesTick((v) => v + 1);
      img.src = url;
      imagesRef.current.set(url, img);
    }
  }, [project]);

  // Vẽ khung hình tại thời điểm XEM t lên sân khấu (gồm tiêu đề đầu
  // phim, chuyển cảnh giữa các cảnh, chữ chạy dưới, credit cuối phim).
  const drawAt = (t: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (t < titleSec) {
      drawTitleCard(
        ctx,
        W,
        H,
        post.titleText ?? project.name,
        post.titleSubtitle ?? "Một bộ phim làm bằng AniMan",
        { sizeScale: post.titleSize, position: post.titlePosition },
      );
      return;
    }
    const tWall = t - titleSec;
    const wallTotal = wallSegments.length > 0 ? wallSegments[wallSegments.length - 1].endSec : 0;
    if (tWall >= wallTotal && tl.creditsSec > 0) {
      drawCreditRoll(
        ctx,
        W,
        H,
        post.creditsLines ?? [],
        tWall - wallTotal,
        {
          speed: post.creditsSpeed && post.creditsSpeed > 0 ? post.creditsSpeed : CREDIT_SPEED_DEFAULT,
          lineHeight: CREDIT_LINE_HEIGHT,
        },
      );
      return;
    }
    const seg = segmentAtWallTime(wallSegments, Math.min(tWall, Math.max(0, wallTotal - 0.001)));
    if (!seg) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const scene = project.scenes[seg.index];
    const tInSceneWall = tWall - seg.startSec;
    const tInScene = contentTimeInSegment(seg, tWall);
    // Đổi cảnh: chụp khung cuối của cảnh trước để làm chuyển cảnh.
    if (lastSegIndexRef.current !== null && lastSegIndexRef.current !== seg.index) {
      const snap = document.createElement("canvas");
      snap.width = W;
      snap.height = H;
      snap.getContext("2d")!.drawImage(canvas, 0, 0);
      snapshotRef.current = snap;
    }
    lastSegIndexRef.current = seg.index;
    if (project.kind === "2d") {
      drawSceneFrame(ctx, scene, tInScene, W, H, (url) => imagesRef.current.get(url) ?? null, {
        effectFormulas: effectFormulasRef.current,
      });
    } else {
      if (!filmRef.current)
        filmRef.current = createPrevizFilmRenderer(W, H, {
          effectFormulas: effectFormulasRef.current,
        });
      // Cảnh kế tiếp đã nạp trước xong thì đổi sang, khỏi chờ nạp lại.
      const pre = preloadRef.current;
      if (
        filmSceneRef.current !== scene.id &&
        pre &&
        pre.sceneId === scene.id &&
        pre.ready
      ) {
        filmRef.current.dispose();
        filmRef.current = pre.renderer;
        filmSceneRef.current = scene.id;
        preloadRef.current = null;
      }
      const film = filmRef.current;
      if (filmSceneRef.current !== scene.id && filmLoadingRef.current !== scene.id) {
        filmLoadingRef.current = scene.id;
        void film.loadScene(scene).then(() => {
          filmSceneRef.current = scene.id;
          filmLoadingRef.current = null;
        });
      }
      if (filmSceneRef.current === scene.id) {
        film.drawAt(scene, tInScene);
        ctx.drawImage(film.canvas, 0, 0);
      } else {
        ctx.fillStyle = "#0a0614";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Đang dựng cảnh "${scene.name}"…`, W / 2, H / 2);
      }
    }
    // Chuyển cảnh đầu cảnh (trừ cảnh đầu khi không có tiêu đề trước nó).
    if (seg.index > 0 || titleSec > 0) {
      const cover = transitionCover(tInSceneWall, seg.index, post);
      if (post.transition === "crossfade" && cover > 0 && snapshotRef.current) {
        ctx.save();
        ctx.globalAlpha = cover;
        ctx.drawImage(snapshotRef.current, 0, 0);
        ctx.restore();
      } else if (snapshotRef.current) {
        drawTransitionOverlay(ctx, snapshotRef.current, W, H, post.transition, cover);
      }
    }
    if (scene.lowerThird) {
      drawLowerThird(ctx, W, H, scene.lowerThird, tInScene);
    }
    if (post.transition === "fade") {
      const black = fadeBlackAlpha(
        tInSceneWall,
        seg.endSec - seg.startSec,
        seg.index === 0 && titleSec === 0,
        seg.index === project.scenes.length - 1,
        post,
      );
      if (black > 0) {
        ctx.fillStyle = `rgba(0,0,0,${black})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  };

  // Vòng lặp phát: cập nhật thời gian từ đồng hồ chủ + vẽ khung
  useEffect(() => {
    if (!playing) {
      drawAt(timeSec);
      return;
    }
    let raf = 0;
    const step = () => {
      const t = currentTime();
      if (t >= totalSec) {
        setTimeSec(totalSec);
        setPlaying(false);
        audioRef.current?.stop();
        perfBaseRef.current = null;
        drawAt(totalSec - 0.001);
        return;
      }
      setTimeSec(t);
      drawAt(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, segments, project, imagesTick]);

  // Nhảy tới cảnh đang sửa: dừng ở đúng mốc bắt đầu của cảnh đó.
  useEffect(() => {
    if (!jumpRequest) return;
    audioRef.current?.stop();
    perfBaseRef.current = null;
    setPlaying(false);
    const clamped = Math.max(0, Math.min(jumpRequest.sec, totalSec));
    setTimeSec(clamped);
    drawAt(clamped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpRequest]);

  // Nạp trước cảnh 3D kế tiếp (theo đoạn đang xem).
  const currentSegIndex = segmentAtTime(segments, timeSec)?.index ?? -1;
  useEffect(() => {
    if (project.kind !== "3d" || currentSegIndex < 0) {
      preloadRef.current?.renderer.dispose();
      preloadRef.current = null;
      return;
    }
    const next = project.scenes[currentSegIndex + 1];
    if (!next) {
      preloadRef.current?.renderer.dispose();
      preloadRef.current = null;
      return;
    }
    if (
      preloadRef.current?.sceneId === next.id &&
      preloadRef.current.scene === next
    )
      return;
    preloadRef.current?.renderer.dispose();
    const renderer = createPrevizFilmRenderer(W, H, {
      effectFormulas: effectFormulasRef.current,
    });
    const entry = { renderer, sceneId: next.id, scene: next, ready: false };
    preloadRef.current = entry;
    void renderer
      .loadScene(next)
      .then(() => {
        if (preloadRef.current === entry) entry.ready = true;
      })
      .catch(() => {
        if (preloadRef.current === entry) preloadRef.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegIndex, project]);

  // Huỷ renderer 3D khi rời trang
  useEffect(() => {
    return () => {
      filmRef.current?.dispose();
      filmRef.current = null;
      preloadRef.current?.renderer.dispose();
      preloadRef.current = null;
    };
  }, []);

  const startPlayback = (from: number) => {
    const audio = audioRef.current;
    if (audio && audioReadyRef.current && audio.hasAudio) {
      audio.play(from);
      perfBaseRef.current = null;
    } else {
      perfBaseRef.current = { stamp: performance.now(), from };
    }
    setTimeSec(from);
    setPlaying(true);
  };

  const pausePlayback = () => {
    const audio = audioRef.current;
    const t = audio && audioReadyRef.current && audio.hasAudio ? audio.pause() : currentTime();
    perfBaseRef.current = null;
    setTimeSec(Math.min(t, totalSec));
    setPlaying(false);
  };

  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(t, totalSec));
    if (playing) startPlayback(clamped);
    else {
      setTimeSec(clamped);
      drawAt(clamped);
    }
  };

  const currentSeg = segmentAtTime(segments, timeSec);
  const subtitle = dialogueAtWallTime(project, timeSec, titleSec);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          PHÁT THỬ TOÀN PHIM — HÌNH + TIẾNG + PHỤ ĐỀ ĐỒNG BỘ
        </h2>
        <span className="text-[12px] text-white/40 tabular-nums">
          {formatDuration(timeSec)} / {formatDuration(totalSec)}
        </span>
      </div>

      {/* Sân khấu: khung hình thật + phụ đề phủ dưới */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
        <canvas ref={canvasRef} width={W} height={H} className="w-full aspect-video block" />
        {subtitle && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none px-6">
            <p className="max-w-[86%] text-center text-[15px] leading-snug font-semibold text-white bg-black/65 rounded-lg px-3 py-1.5">
              <span className="text-pink-300">{subtitle.line.speaker}: </span>
              {subtitle.line.text}
            </p>
          </div>
        )}
        {currentSeg && (
          <div className="absolute top-2 left-2 text-[10px] tracking-[0.2em] text-white/70 bg-black/55 rounded-md px-2 py-1 pointer-events-none">
            CẢNH {currentSeg.index + 1} / {project.scenes.length} — {project.scenes[currentSeg.index]?.name}
          </div>
        )}
      </div>

      {/* Điều khiển */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => seek(0)}
          aria-label="Về đầu"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => currentSeg && seek(segments[Math.max(0, currentSeg.index - 1)]?.startSec ?? 0)}
          aria-label="Cảnh trước"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (playing) pausePlayback();
            else startPlayback(timeSec >= totalSec ? 0 : timeSec);
          }}
          aria-label={playing ? "Tạm dừng" : "Phát"}
          className="p-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 transition"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={() =>
            currentSeg &&
            seek(segments[Math.min(segments.length - 1, currentSeg.index + 1)]?.startSec ?? 0)
          }
          aria-label="Cảnh sau"
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="flex-1 flex gap-1 ml-2">
          {segments.map((seg) => {
            const span = totalSec > 0 ? (seg.endSec - seg.startSec) / totalSec : 0;
            const isCurrent = currentSeg?.sceneId === seg.sceneId;
            const fill = isCurrent
              ? Math.max(0, Math.min(1, (timeSec - seg.startSec) / Math.max(0.001, seg.endSec - seg.startSec)))
              : timeSec >= seg.endSec
                ? 1
                : 0;
            return (
              <button
                key={seg.sceneId}
                onClick={() => seek(seg.startSec)}
                title={`${project.scenes[seg.index]?.name ?? ""} — ${formatDuration(seg.endSec - seg.startSec)}`}
                className={`relative h-6 rounded-md overflow-hidden border transition ${
                  isCurrent ? "border-pink-400/60" : "border-white/10 hover:border-white/30"
                }`}
                style={{ flexGrow: Math.max(0.2, span * 100) }}
              >
                <span className="absolute inset-0 bg-white/10" />
                <span className="absolute inset-y-0 left-0 bg-pink-500/50" style={{ width: `${fill * 100}%` }} />
                <span className="relative text-[10px] text-white/70 leading-6">{seg.index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
