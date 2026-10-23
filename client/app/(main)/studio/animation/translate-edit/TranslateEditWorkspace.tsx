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
  loadVideoProject,
  saveVideoProject,
} from "../lib/videoEditorStorage";
import { MultiTrackTimeline } from "./components/MultiTrackTimeline";
import { SubTab } from "./components/SubTab";
import { TranslateTab } from "./components/TranslateTab";
import { DubTab } from "./components/DubTab";

/**
 * PHÒNG BIÊN TẬP VIDEO CÓ SẴN — dịch / phụ đề / lồng tiếng cho một tập
 * phim người dùng tự tải lên (video chạy ngay trên máy, không tải lên
 * server). Cue phụ đề + bản thu lồng tiếng lưu trong IndexedDB; xuất
 * .srt ở tab Phụ đề, xuất WebM phụ đề cứng ở đây.
 * (Bản cũ của trang này là mock tĩnh — đã thay toàn bộ bằng tool thật.)
 */
export function TranslateEditWorkspace() {
  const [tab, setTab] = useState<"sub" | "translate" | "dub">("sub");
  const [title, setTitle] = useState("");
  const [cues, setCues] = useState<DialogueLine[]>([]);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [exporting, setExporting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loadedRef = useRef(false);

  // Nạp dự án đã lưu (cue + tiêu đề) khi mở trang
  useEffect(() => {
    void loadVideoProject().then((p) => {
      if (p) {
        setTitle(p.title);
        setCues(p.cues);
      }
      loadedRef.current = true;
    });
  }, []);

  // Lưu tự động mỗi khi cue/tiêu đề đổi
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      void saveVideoProject({
        id: "current",
        title,
        cues,
        updatedAt: Date.now(),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [title, cues]);

  const seek = useCallback((sec: number, cueId: string) => {
    setSelectedCueId(cueId);
    const video = videoRef.current;
    if (video) {
      video.currentTime = sec;
      void video.play().catch(() => undefined);
    }
  }, []);

  const onPickVideo = (file: File) => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setVideoName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const activeCue = dialogueLineAt(cues, currentTime);

  /** Xuất WebM: vẽ khung video + phụ đề lên canvas, giữ nguyên tiếng gốc. */
  const exportBurnedWebM = async () => {
    const video = videoRef.current;
    if (!video || !videoUrl || exporting) return;
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
      const audio = capturable
        .captureStream()
        .getAudioTracks()[0];
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
    await stopped;
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "video").replace(/\s+/g, "-")}-phu-de-cung.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setExporting(false);
  };

  const tabBtn = (
    id: typeof tab,
    icon: React.ReactNode,
    label: string,
  ) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 h-10 rounded-xl text-[13px] font-medium border transition ${
        tab === id
          ? "bg-fuchsia-500/25 border-fuchsia-400/50 text-white"
          : "bg-white/[0.03] border-white/10 text-white/55 hover:bg-white/[0.08]"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/studio/animation"
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Animation Studio
        </Link>
        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide bg-fuchsia-500/20 text-fuchsia-300">
          BIÊN TẬP VIDEO CÓ SẴN
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder="Tên tập phim / dự án biên tập…"
            aria-label="Tên dự án biên tập"
            className="w-full bg-transparent text-2xl font-semibold outline-none border-b border-transparent focus:border-fuchsia-400/50 pb-1 placeholder:text-white/25"
          />
          <p className="text-[12px] text-white/40 mt-1 leading-relaxed">
            Dịch, làm phụ đề và lồng tiếng cho tập phim có sẵn. Video chạy
            ngay trên máy của bạn — không tải lên server; phụ đề và bản thu
            được lưu trong trình duyệt này.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition"
          >
            <Upload className="w-4 h-4" />
            {videoName ? "Đổi video" : "Tải video lên"}
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
            onClick={() => void exportBurnedWebM()}
            disabled={!videoUrl || exporting}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-400 text-[13px] font-medium hover:opacity-90 transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Đang xuất (phát hết video)…" : "Xuất WebM phụ đề cứng"}
          </button>
        </div>
      </div>

      {/* Khung video + phụ đề phủ trực tiếp */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video">
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            {activeCue && (
              <div className="absolute bottom-12 inset-x-0 text-center pointer-events-none px-6">
                <span className="inline-block px-3 py-1 rounded bg-black/60 text-white text-lg font-medium leading-snug">
                  {activeCue.speaker ? `${activeCue.speaker}: ` : ""}
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
            <span className="text-sm">
              Chọn file video của tập phim (mp4/webm/mkv…)
            </span>
            <span className="text-[12px] text-white/30">
              Nếu đã biên tập trước đó: phụ đề và bản thu cũ vẫn còn — chỉ cần
              chọn lại đúng file video.
            </span>
          </button>
        )}
      </div>

      <MultiTrackTimeline
        cues={cues}
        durationSec={duration}
        currentTimeSec={currentTime}
        selectedCueId={selectedCueId}
        onSeek={seek}
      />

      <div className="flex flex-wrap gap-2">
        {tabBtn("sub", <Subtitles className="w-4 h-4" />, "Phụ đề")}
        {tabBtn("translate", <Languages className="w-4 h-4" />, "Dịch")}
        {tabBtn("dub", <Mic className="w-4 h-4" />, "Lồng tiếng")}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4">
        {tab === "sub" && (
          <SubTab
            cues={cues}
            currentTimeSec={currentTime}
            selectedCueId={selectedCueId}
            onCuesChange={setCues}
            onSeek={seek}
          />
        )}
        {tab === "translate" && (
          <TranslateTab title={title} cues={cues} onCuesChange={setCues} />
        )}
        {tab === "dub" && <DubTab cues={cues} onSeek={seek} />}
      </div>
    </div>
  );
}
