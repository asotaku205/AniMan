"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Languages,
  Mic,
  Subtitles,
  Upload,
} from "lucide-react";
import { dialogueLineAt, type DialogueLine } from "../lib/dialogue";
import {
  characterName,
  createCue,
  EPISODE_STATUS_OPTIONS,
  type CueV2,
  type Episode,
  type Series,
} from "../lib/library";
import {
  getEpisode,
  loadTakeBlob,
  getSeriesOfEpisode,
  listCues,
  replaceEpisodeCues,
  saveEpisode,
} from "../lib/libraryStorage";
import { MultiTrackTimeline } from "./components/MultiTrackTimeline";
import { FPS_OPTIONS, formatTimecode, snapToFrame } from "../lib/timecode";
import {
  mergeCueWithNext,
  setCueInOut,
  splitCue,
} from "../lib/cueEngine";
import { extractWaveformPeaks } from "../lib/waveform";
import { toAss, toCueSheetCsv, toVtt } from "../lib/exportFormats";
import { renderDubMix, type DubTakeInput } from "../lib/dubMix";
import {
  applyMechanicalFixes,
  loadQcProfile,
  saveQcProfile,
  validateCues,
  type QcProfile,
} from "../lib/qcEngine";
import { CueTable } from "./components/CueTable";
import { CueInspector } from "./components/CueInspector";
import { QcPanel } from "./components/QcPanel";
import { SubTab } from "./components/SubTab";
import {
  TranslateTab,
  FLAG_AI_TRANSLATION,
} from "./components/TranslateTab";
import { DubTab } from "./components/DubTab";

/**
 * Editor biên tập MỘT TẬP (dữ liệu v2 — thư viện Series/Season/Episode).
 * Cue lưu theo episode trong `libraryStorage`; bản thu lồng tiếng tạm
 * vẫn qua store cũ theo cueId (Slice S5 sẽ chuyển hẳn sang takes v2).
 * Layout 3 vùng chuẩn studio thuộc Slice S2 — bản này giữ khung cũ.
 */
export function TranslateEditWorkspace({ episodeId }: { episodeId: string }) {
  const [tab, setTab] = useState<"sub" | "translate" | "dub">("sub");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [seasonTitle, setSeasonTitle] = useState("");
  const [cues, setCues] = useState<CueV2[]>([]);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [fps, setFps] = useState<number>(25);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [waveBusy, setWaveBusy] = useState(false);
  const [spotIn, setSpotIn] = useState<number | null>(null);
  // loadQcProfile tự rơi về chuẩn Netflix khi không có localStorage (SSR)
  const [qcProfile, setQcProfile] = useState<QcProfile>(() => loadQcProfile());
  const qcIssues = validateCues(cues, qcProfile, fps);
  const historyRef = useRef<CueV2[][]>([]);
  const cuesRef = useRef<CueV2[]>([]);
  cuesRef.current = cues;

  /** Mọi thay đổi cue đi qua đây để có undo (Ctrl+Z). */
  const commitCues = useCallback((next: CueV2[]) => {
    historyRef.current = [...historyRef.current.slice(-59), cuesRef.current];
    setCues(next);
  }, []);
  const undoCues = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setCues(prev);
  }, []);
  const [notFound, setNotFound] = useState(false);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; at: Date }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ep = await getEpisode(episodeId);
      if (cancelled) return;
      if (!ep) {
        setNotFound(true);
        return;
      }
      setEpisode(ep);
      setDuration(ep.durationSec || 0);
      const ctx = await getSeriesOfEpisode(ep);
      if (ctx && !cancelled) {
        setSeries(ctx.series);
        setSeasonTitle(ctx.series.useSeasons ? ctx.season.title : "");
      }
      const loaded = await listCues(episodeId);
      if (!cancelled) {
        setCues(loaded);
        loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  // Lưu cue tự động (gộp thay đổi trong 400ms) — trạng thái lưu HIỂN THỊ
  // cho người dùng thấy, lỗi không còn bị nuốt âm thầm như trước.
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveState({ kind: "saving" });
    const t = setTimeout(() => {
      replaceEpisodeCues(episodeId, cues)
        .then(() => setSaveState({ kind: "saved", at: new Date() }))
        .catch((err: unknown) =>
          setSaveState({
            kind: "error",
            message:
              err instanceof Error ? err.message : "Không lưu được dữ liệu",
          }),
        );
    }, 400);
    return () => clearTimeout(t);
  }, [cues, episodeId]);

  /** Tabs làm việc trên DialogueLine — hợp nhất lại vào CueV2 theo id. */
  const applyCueLines = useCallback(
    (next: DialogueLine[]) => {
      const prev = cuesRef.current;
      {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const merged = next.map((line) => {
          const old = byId.get(line.id);
          if (old) {
            return {
              ...old,
              text: line.text,
              startSec: line.startSec,
              durationSec: line.durationSec,
            };
          }
          const cue = createCue(episodeId, line.startSec, line.durationSec);
          cue.id = line.id;
          cue.text = line.text;
          return cue;
        });
        commitCues(merged);
      }
    },
    [episodeId, commitCues],
  );

  const seek = useCallback((sec: number, cueId: string) => {
    setSelectedCueId(cueId);
    const video = videoRef.current;
    if (video) {
      video.currentTime = sec;
      void video.play().catch(() => undefined);
    }
  }, []);

  const patchEpisode = async (patch: Partial<Episode>) => {
    if (!episode) return;
    const next = { ...episode, ...patch };
    setEpisode(next);
    try {
      await saveEpisode(next);
    } catch (err) {
      setSaveState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Không lưu được thông tin tập",
      });
    }
  };

  const onPickVideo = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    void patchEpisode({ videoName: file.name });
    setWaveBusy(true);
    void extractWaveformPeaks(file).then((result) => {
      setPeaks(result);
      setWaveBusy(false);
    });
  };

  const playheadFrame = () => snapToFrame(videoRef.current?.currentTime ?? currentTime, fps);

  const pressIn = useCallback(() => {
    const t = playheadFrame();
    const selected = cuesRef.current.find((c) => c.id === selectedCueId);
    if (selected) {
      commitCues(setCueInOut(cuesRef.current, selected.id, t, selected.startSec + selected.durationSec));
    } else {
      setSpotIn(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCueId, fps, commitCues]);

  const pressOut = useCallback(() => {
    const t = playheadFrame();
    const selected = cuesRef.current.find((c) => c.id === selectedCueId);
    if (selected) {
      commitCues(setCueInOut(cuesRef.current, selected.id, selected.startSec, t));
    } else if (spotIn != null && t > spotIn + 0.3) {
      const cue = createCue(episodeId, spotIn, t - spotIn);
      commitCues([...cuesRef.current, cue].sort((a, b) => a.startSec - b.startSec));
      setSelectedCueId(cue.id);
      setSpotIn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCueId, spotIn, fps, commitCues, episodeId]);

  // Phím tắt studio: Space phát/dừng · ↑/↓ qua cue · I/O spotting · Ctrl+Z undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const video = videoRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (video) {
          if (video.paused) void video.play().catch(() => undefined);
          else video.pause();
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const sorted = [...cuesRef.current].sort((a, b) => a.startSec - b.startSec);
        if (sorted.length === 0) return;
        const now = video?.currentTime ?? 0;
        const next =
          e.key === "ArrowDown"
            ? (sorted.find((c) => c.startSec > now + 0.01) ?? sorted[0])
            : ([...sorted].reverse().find((c) => c.startSec < now - 0.01) ??
              sorted[sorted.length - 1]);
        seek(next.startSec, next.id);
      } else if (e.key.toLowerCase() === "i") {
        pressIn();
      } else if (e.key.toLowerCase() === "o") {
        pressOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoCues();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressIn, pressOut, seek, undoCues]);

  const activeCue = dialogueLineAt(cues, currentTime);
  const activeCueV2 = activeCue
    ? (cues.find((c) => c.id === activeCue.id) ?? null)
    : null;
  const activeSpeaker = characterName(series, activeCueV2?.speakerId);

  const segmentEndRef = useRef<number | null>(null);
  const playSegment = useCallback((startSec: number, endSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    segmentEndRef.current = endSec;
    video.currentTime = startSec;
    void video.play().catch(() => undefined);
  }, []);

  /** Nghe thử take đã chọn kèm video: tiếng gốc hạ xuống (ducking). */
  const previewDub = useCallback(async (cue: CueV2) => {
    const video = videoRef.current;
    const take = cue.takes.find((t) => t.id === cue.selectedTakeId);
    if (!video || !take) return;
    const blob = await loadTakeBlob(take.id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = Math.min(1, take.volume);
    const originalVolume = video.volume;
    video.volume = 0.15;
    video.currentTime = cue.startSec;
    segmentEndRef.current = cue.startSec + cue.durationSec;
    await video.play().catch(() => undefined);
    await audio.play().catch(() => undefined);
    const restore = () => {
      video.volume = originalVolume;
      URL.revokeObjectURL(url);
    };
    audio.onended = restore;
    setTimeout(restore, (cue.durationSec + 1.5) * 1000);
  }, []);

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };
  const downloadText = (text: string, name: string, type: string) =>
    downloadBlob(new Blob([text], { type }), name);

  /**
   * Xuất WebM LỒNG TIẾNG (S6): render bản trộn offline (tiếng gốc bị
   * ducking trong các đoạn có thoại + take đã chọn đúng mốc, đúng âm
   * lượng) rồi ghi hình thời gian thực kèm phụ đề cứng như bản thường.
   * Đây là khâu trước đây bị thiếu — lồng xong không ra được sản phẩm.
   */
  const exportDubbedWebM = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl || !videoFile || exporting || !episode) return;
    const dubbedCues = cues.filter((c) => c.selectedTakeId);
    if (dubbedCues.length === 0) return;
    setExporting(true);
    try {
      const decodeCtx = new AudioContext();
      let original: AudioBuffer | null = null;
      try {
        original = await decodeCtx.decodeAudioData(
          await videoFile.arrayBuffer(),
        );
      } catch {
        original = null;
      }
      const takes: DubTakeInput[] = [];
      for (const cue of dubbedCues) {
        const take = cue.takes.find((t) => t.id === cue.selectedTakeId);
        const blob = take ? await loadTakeBlob(take.id) : null;
        if (!take || !blob) continue;
        try {
          const buffer = await decodeCtx.decodeAudioData(
            await blob.arrayBuffer(),
          );
          takes.push({ buffer, startSec: cue.startSec, volume: take.volume });
        } catch {
          /* bỏ take không decode được */
        }
      }
      void decodeCtx.close();
      if (takes.length === 0) {
        setExporting(false);
        return;
      }
      const durationSec = video.duration || duration;
      const mixed = await renderDubMix({ original, takes, durationSec });

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
      const playCtx = new AudioContext();
      const dest = playCtx.createMediaStreamDestination();
      const src = playCtx.createBufferSource();
      src.buffer = mixed;
      src.connect(dest);
      const stream = new MediaStream([
        ...canvas.captureStream(30).getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((r) => {
        recorder.onstop = () => r();
      });
      video.pause();
      video.currentTime = 0;
      await new Promise((r) => setTimeout(r, 150));
      recorder.start(200);
      src.start(0);
      await video.play().catch(() => undefined);
      const draw = () => {
        if (video.ended || video.paused) return;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        const vw = video.videoWidth || W;
        const vh = video.videoHeight || H;
        const scale = Math.min(W / vw, H / vh);
        const w = vw * scale;
        const h = vh * scale;
        ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
        const line = dialogueLineAt(cues, video.currentTime);
        if (line?.text.trim()) {
          ctx.font = "600 26px sans-serif";
          ctx.textAlign = "center";
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.fillStyle = "#fff";
          ctx.strokeText(line.text, W / 2, H - 26);
          ctx.fillText(line.text, W / 2, H - 26);
        }
        requestAnimationFrame(draw);
      };
      draw();
      await new Promise<void>((resolve) => {
        const onEnd = () => {
          video.removeEventListener("ended", onEnd);
          resolve();
        };
        video.addEventListener("ended", onEnd);
      });
      recorder.stop();
      src.stop();
      void playCtx.close();
      await stopped;
      downloadBlob(
        new Blob(chunks, { type: "video/webm" }),
        `${(episode.title || "video").replace(/\s+/g, "-")}-long-tieng.webm`,
      );
      await patchEpisode({ status: "exported" });
    } finally {
      setExporting(false);
    }
  };

  const exportBurnedWebM = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl || exporting || !episode) return;
    setExporting(true);
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
    const canvasStream = canvas.captureStream(30);
    const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
    const capturable = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
    };
    if (typeof capturable.captureStream === "function") {
      const audio = capturable.captureStream().getAudioTracks()[0];
      if (audio) tracks.push(audio);
    }
    const recorder = new MediaRecorder(new MediaStream(tracks), {
      mimeType: "video/webm",
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((r) => {
      recorder.onstop = () => r();
    });
    video.pause();
    video.currentTime = 0;
    await new Promise((r) => setTimeout(r, 150));
    recorder.start(200);
    await video.play().catch(() => undefined);
    const draw = () => {
      if (video.ended || video.paused) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      const vw = video.videoWidth || W;
      const vh = video.videoHeight || H;
      const scale = Math.min(W / vw, H / vh);
      const w = vw * scale;
      const h = vh * scale;
      ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
      const line = dialogueLineAt(cues, video.currentTime);
      if (line?.text.trim()) {
        const cue = cues.find((c) => c.id === line.id);
        const name = characterName(series, cue?.speakerId);
        const label = name ? `${name}: ${line.text}` : line.text;
        ctx.font = "600 26px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.fillStyle = "#fff";
        ctx.strokeText(label, W / 2, H - 26);
        ctx.fillText(label, W / 2, H - 26);
      }
      requestAnimationFrame(draw);
    };
    draw();
    await new Promise<void>((resolve) => {
      const onEnd = () => {
        video.removeEventListener("ended", onEnd);
        resolve();
      };
      video.addEventListener("ended", onEnd);
    });
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(episode.title || "video").replace(/\s+/g, "-")}-phu-de-cung.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    void patchEpisode({ status: "exported" });
    setExporting(false);
  };

  const selectedCue = cues.find((c) => c.id === selectedCueId) ?? null;
  const patchCue = (id: string, patch: Partial<CueV2>) =>
    commitCues(
      cuesRef.current.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        // Tự tay sửa lời dịch = đã xem lại → gỡ cờ của AI (trừ khi patch đặt cờ)
        if ("text" in patch && !("flag" in patch)) next.flag = undefined;
        return next;
      }),
    );
  const markTranslated = useCallback(
    (ids: string[]) =>
      commitCues(
        cuesRef.current.map((c) =>
          ids.includes(c.id) ? { ...c, flag: FLAG_AI_TRANSLATION } : c,
        ),
      ),
    [commitCues],
  );
  const deleteCue = (id: string) => {
    commitCues(cuesRef.current.filter((c) => c.id !== id));
    setSelectedCueId(null);
  };

  const tabBtn = (id: typeof tab, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 h-9 rounded-full text-[13px] font-semibold transition-all duration-200 ${
        tab === id
          ? "bg-gradient-to-r from-fuchsia-500 to-pink-400 text-white shadow-[0_6px_18px_rgba(217,70,239,0.45)]"
          : "text-white/55 hover:text-white hover:bg-white/[0.07]"
      }`}
    >
      {icon} {label}
    </button>
  );

  if (notFound) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-10 text-center">
        <p className="text-white/70 font-medium">Không tìm thấy tập này trong thư viện</p>
        <Link
          href="/studio/animation/translate-edit"
          className="inline-block mt-4 px-4 h-10 leading-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
        >
          Về thư viện
        </Link>
      </div>
    );
  }
  if (!episode) {
    return <p className="text-sm text-white/40">Đang tải tập…</p>;
  }

  return (
    <div className="relative space-y-5">
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/3 w-[520px] h-[300px] rounded-full bg-fuchsia-600/[0.13] blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute top-40 -left-24 w-[380px] h-[280px] rounded-full bg-pink-500/[0.08] blur-[110px]" />
      <div className="relative flex flex-wrap items-center gap-3">
        <Link
          href="/studio/animation/translate-edit"
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Thư viện
        </Link>
        <span className="text-[12px] text-white/40">
          {series?.title}
          {seasonTitle ? ` › ${seasonTitle}` : ""} › Tập {episode.number}
        </span>
        <span
          className={`text-[11px] ml-auto px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur ${
            saveState.kind === "error"
              ? "text-rose-300 font-medium"
              : saveState.kind === "saved"
                ? "text-emerald-300/80"
                : "text-white/35"
          }`}
          title={saveState.kind === "error" ? saveState.message : undefined}
        >
          {saveState.kind === "saving" && "Đang lưu…"}
          {saveState.kind === "saved" &&
            `✓ Đã lưu ${saveState.at.toLocaleTimeString("vi-VN")}`}
          {saveState.kind === "error" &&
            `⚠ Lỗi lưu dữ liệu: ${saveState.message}`}
        </span>
        <select
          value={episode.status}
          onChange={(e) =>
            void patchEpisode({
              status: e.currentTarget.value as Episode["status"],
            })
          }
          aria-label="Trạng thái tập"
          className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
        >
          {EPISODE_STATUS_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            value={episode.title}
            onChange={(e) => setEpisode({ ...episode, title: e.currentTarget.value })}
            onBlur={(e) => void patchEpisode({ title: e.currentTarget.value })}
            placeholder="Tên tập…"
            aria-label="Tên tập"
            className="w-full bg-transparent text-[26px] font-bold tracking-tight outline-none border-b border-transparent focus:border-fuchsia-400/50 pb-1 placeholder:text-white/25"
          />
          <p className="text-[12px] text-white/40 mt-1 leading-relaxed">
            Video chạy ngay trên máy của bạn — không tải lên server.
            {episode.videoName
              ? ` Lần trước đã dùng file: ${episode.videoName} — chọn lại đúng file đó để xem tiếp.`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition"
          >
            <Upload className="w-4 h-4" />
            {episode.videoName ? "Chọn video" : "Tải video lên"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) onPickVideo(f);
              e.currentTarget.value = "";
            }}
          />
          <button
            onClick={() => void exportDubbedWebM()}
            disabled={!videoUrl || !videoFile || exporting || !cues.some((c) => c.selectedTakeId)}
            title="Trộn các take đã ★ với tiếng gốc bị hạ (ducking) + phụ đề cứng"
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-[13px] font-medium hover:bg-emerald-500/35 transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất…" : "Xuất WebM lồng tiếng"}
          </button>
          <button
            onClick={() => void exportBurnedWebM()}
            disabled={!videoUrl || exporting}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[13px] font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất (phát hết video)…" : "Xuất WebM phụ đề cứng"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px]">
        <span className="text-white/35 py-1.5">Xuất định dạng:</span>
        <button
          onClick={() => downloadText(toVtt(cues), `${episode.title || "phu-de"}.vtt`, "text/vtt;charset=utf-8")}
          disabled={cues.length === 0}
          className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          .vtt
        </button>
        <button
          onClick={() => downloadText(toAss(cues, episode.title), `${episode.title || "phu-de"}.ass`, "text/plain;charset=utf-8")}
          disabled={cues.length === 0}
          className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          .ass
        </button>
        <button
          onClick={() => downloadText(toCueSheetCsv(cues, series), `${episode.title || "cue-sheet"}.csv`, "text/csv;charset=utf-8")}
          disabled={cues.length === 0}
          className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-40"
        >
          Cue sheet CSV (cho buổi thu)
        </button>
      </div>

      {/* Bố cục studio 3 vùng (S2): trái = công cụ + bảng cue · giữa = video + timeline · phải = mode + inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)_330px] gap-4 items-start">
        <div className="space-y-3 order-2 xl:order-1">
          <SubTab
            cues={cues}
            currentTimeSec={currentTime}
            onCuesChange={applyCueLines}
          />
          <CueTable
            cues={cues}
            series={series}
            currentTimeSec={currentTime}
            selectedCueId={selectedCueId}
            onSelect={(cue) => seek(cue.startSec, cue.id)}
            qcMaxCps={qcProfile.maxCps}
          />
        </div>

        <div className="space-y-3 order-1 xl:order-2">
      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video shadow-[0_20px_50px_rgba(0,0,0,0.5),0_10px_36px_rgba(217,70,239,0.14)]">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full"
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration || 0;
                setDuration(d);
                void patchEpisode({ durationSec: d });
              }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                setCurrentTime(v.currentTime);
                if (
                  segmentEndRef.current != null &&
                  v.currentTime >= segmentEndRef.current
                ) {
                  segmentEndRef.current = null;
                  v.pause();
                }
              }}
            />
            {activeCue && (
              <div className="absolute bottom-12 inset-x-0 text-center pointer-events-none px-6">
                <span className="inline-block px-3 py-1 rounded bg-black/60 text-white text-lg font-medium leading-snug">
                  {activeSpeaker ? `${activeSpeaker}: ` : ""}
                  {activeCue.text}
                </span>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 w-full flex flex-col items-center justify-center gap-2 text-white/40 hover:text-white/70 transition"
          >
            <Upload className="w-10 h-10" />
            <span className="text-sm">Chọn file video của tập này (mp4/webm/mkv…)</span>
            <span className="text-[12px] text-white/30">
              Phụ đề và bản thu của tập đã được lưu — chọn lại đúng file video là làm tiếp được.
            </span>
          </button>
        )}
      </div>

          {/* Thanh transport: timecode + fps + spotting I/O + tách/gộp + undo */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-2">
            <span className="text-[13px] font-mono tabular-nums text-emerald-300">
              {formatTimecode(currentTime, fps)}
            </span>
            <span className="text-[11px] text-white/35 font-mono tabular-nums">
              / {formatTimecode(duration, fps)}
            </span>
            <select
              value={fps}
              onChange={(e) => setFps(Number(e.currentTarget.value))}
              aria-label="FPS của video"
              className="h-7 rounded-lg bg-black/50 border border-white/10 px-1.5 text-[11px] outline-none"
            >
              {FPS_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f} fps
                </option>
              ))}
            </select>
            <span className="w-px h-5 bg-white/10" />
            <button
              onClick={pressIn}
              className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
              title="Phím I — đặt In tại playhead (cho cue đang chọn hoặc bắt đầu spotting)"
            >
              [I] In{spotIn != null && !selectedCue ? ` · ${formatTimecode(spotIn, fps)}` : ""}
            </button>
            <button
              onClick={pressOut}
              className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
              title="Phím O — đặt Out tại playhead / hoàn tất cue đang spotting"
            >
              [O] Out
            </button>
            {selectedCue && (
              <>
                <button
                  onClick={() =>
                    commitCues(splitCue(cuesRef.current, selectedCue.id, videoRef.current?.currentTime ?? currentTime))
                  }
                  className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                  title="Tách cue đang chọn tại playhead"
                >
                  Tách tại playhead
                </button>
                <button
                  onClick={() => commitCues(mergeCueWithNext(cuesRef.current, selectedCue.id))}
                  className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                  title="Gộp cue đang chọn với cue ngay sau"
                >
                  Gộp cue sau
                </button>
              </>
            )}
            <button
              onClick={undoCues}
              className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 ml-auto"
              title="Ctrl+Z — hoàn tác thay đổi cue"
            >
              ↩ Hoàn tác
            </button>
            {waveBusy && <span className="text-[10px] text-white/35">Đang phân tích sóng âm…</span>}
          </div>

          <MultiTrackTimeline
            cues={cues}
            durationSec={duration}
            currentTimeSec={currentTime}
            selectedCueId={selectedCueId}
            peaks={peaks}
            fps={fps}
            onSeek={seek}
          />
        </div>

        <div className="space-y-3 order-3">
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur p-1">
        {tabBtn("sub", <Subtitles className="w-4 h-4" />, "Phụ đề")}
        {tabBtn("translate", <Languages className="w-4 h-4" />, "Dịch")}
        {tabBtn("dub", <Mic className="w-4 h-4" />, "Lồng tiếng")}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
        {tab === "sub" &&
          (selectedCue ? (
            <CueInspector
              cue={selectedCue}
              series={series}
              onPatch={(patch) => patchCue(selectedCue.id, patch)}
              onDelete={() => deleteCue(selectedCue.id)}
            />
          ) : (
            <p className="text-[13px] text-white/40 leading-relaxed">
              Chọn một cue trong bảng bên trái để sửa mốc thời gian, gán nhân
              vật và chỉnh nội dung tại đây. Bấm vào hàng cue cũng sẽ nhảy
              video tới đúng vị trí.
            </p>
          ))}
        {tab === "translate" && (
          <TranslateTab
            title={episode.title}
            cues={cues}
            series={series}
            onCuesChange={applyCueLines}
            onPatchCue={patchCue}
            onTranslated={markTranslated}
          />
        )}
        {tab === "dub" && (
          <DubTab
            cues={cues}
            series={series}
            onPatchCue={patchCue}
            onSeek={seek}
            playSegment={playSegment}
            previewDub={previewDub}
          />
        )}
      </div>

          <QcPanel
            issues={qcIssues}
            profile={qcProfile}
            onProfileChange={(next) => {
              setQcProfile(next);
              saveQcProfile(next);
            }}
            onFix={() => {
              const { cues: fixed } = applyMechanicalFixes(cues, qcProfile, fps);
              commitCues(fixed);
            }}
            onJump={(cueId) => {
              const cue = cues.find((c) => c.id === cueId);
              if (cue) seek(cue.startSec, cue.id);
            }}
          />
        </div>
      </div>
    </div>
  );
}
