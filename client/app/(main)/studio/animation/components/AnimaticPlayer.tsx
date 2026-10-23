"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import {
  formatDuration,
  projectDurationSec,
  type AnimProject,
} from "../lib/animProject";
import { animaticTimeline, segmentAtTime } from "../lib/animatic";
import { drawSceneFrame } from "../lib/renderFrame";
import { createPrevizFilmRenderer } from "../lib/previzFilmRender";
import {
  createFilmPreviewAudio,
  dialogueAtFilmTime,
  type FilmPreviewAudio,
} from "../lib/filmPreview";

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
export function AnimaticPlayer({ project }: { project: AnimProject }) {
  const segments = useMemo(() => animaticTimeline(project.scenes), [project.scenes]);
  const totalSec = useMemo(() => projectDurationSec(project), [project]);
  const [playing, setPlaying] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<FilmPreviewAudio | null>(null);
  const audioReadyRef = useRef(false);
  const perfBaseRef = useRef<{ stamp: number; from: number } | null>(null);
  const filmRef = useRef<ReturnType<typeof createPrevizFilmRenderer> | null>(null);
  const filmSceneRef = useRef<string | null>(null);
  const filmLoadingRef = useRef<string | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [imagesTick, setImagesTick] = useState(0);

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
        scenes: project.scenes.map((s) => ({
          d: s.durationSec,
          takes: (s.dialogue ?? []).map(
            (l) => `${l.selectedTakeId ?? ""}@${l.startSec}`,
          ),
          clips: (s.audioClips ?? []).map(
            (c) => `${c.id}@${c.startSec}/${c.durationSec}/${c.volume}`,
          ),
        })),
      }),
    [project],
  );

  // Chuẩn bị tiếng (dựng lại khi dữ liệu tiếng thay đổi)
  useEffect(() => {
    const audio = createFilmPreviewAudio(project);
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
  }, [project.id, audioSignature]);

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

  // Vẽ khung hình tại thời điểm t lên sân khấu
  const drawAt = (t: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const seg = segmentAtTime(segments, Math.min(t, Math.max(0, totalSec - 0.001)));
    if (!seg) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const scene = project.scenes[seg.index];
    const tInScene = t - seg.startSec;
    if (project.kind === "2d") {
      drawSceneFrame(ctx, scene, tInScene, W, H, (url) => imagesRef.current.get(url) ?? null);
    } else {
      if (!filmRef.current) filmRef.current = createPrevizFilmRenderer(W, H);
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

  // Huỷ renderer 3D khi rời trang
  useEffect(() => {
    return () => {
      filmRef.current?.dispose();
      filmRef.current = null;
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
  const subtitle = dialogueAtFilmTime(project, timeSec);

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
      <p className="mt-2 text-[11px] text-white/35">
        Phát thử dùng đúng các bản thu giọng đã chọn và nhạc nền của phim —
        nghe thấy thế nào thì bản xuất ra thế ấy. Dòng thoại chưa thu giọng
        vẫn hiện phụ đề để kiểm tra nhịp.
      </p>
    </div>
  );
}
