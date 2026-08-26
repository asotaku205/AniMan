"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  SkipForward, ChevronLeft, ChevronRight,
  List, Star, Clock, Tv, X, Check, ChevronDown,
  Subtitles, Gauge, Download
} from "lucide-react";
import { animeList, liveList, type Title } from "./data/catalog";
import { ImageWithFallback } from "./ImageWithFallback";
import { MediaActionButtons, MediaBreadcrumb, MediaReviews, WatchPartyCta } from "./MediaPlayerParts";

// ── Shared player UI ──────────────────────────────────────────
export function MediaPlayer({
  content,
  currentEp,
  type,
  basePath,
}: {
  content: Title;
  currentEp: number;
  type: "anime" | "film";
  basePath: "anime" | "film";
}) {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(23);
  const [showControls, setShowControls] = useState(true);
  const [showEpList, setShowEpList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState("1080p");
  const [subtitles, setSubtitles] = useState("VI");
  const [comment, setComment] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const episode = content!.episodes?.[currentEp - 1];
  const totalEps = content!.episodes?.length ?? 0;

  const related =
    type === "anime"
      ? animeList.filter((x) => x.slug !== content!.slug && x.tags.some((t) => content!.tags.includes(t))).slice(0, 5)
      : liveList.filter((x) => x.slug !== content!.slug && x.tags.some((t) => content!.tags.includes(t))).slice(0, 5);

  // Auto-hide controls
  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const goToEp = (n: number) => {
    if (n < 1 || n > totalEps) return;
    router.push(`/anime/${content!.slug}/${n}`);
  };

  const progressWidth = `${progress}%`;

  return (
    <div className="min-h-screen bg-[#07040e] pb-16">
      <MediaBreadcrumb basePath={basePath} content={content} currentEp={currentEp} type={type} />

      {/* ── Video Player ── */}
      <div
        ref={playerRef}
        className={`relative bg-black group w-full ${isFullscreen ? "fixed inset-0 z-[100] h-screen w-screen max-h-none" : ""}`}
        style={{ aspectRatio: isFullscreen ? "auto" : "16/9", maxHeight: isFullscreen ? undefined : "82vh" }}
        onMouseMove={resetHideTimer}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Ken Burns keyframes */}
        <style>{`
          @keyframes kenBurns {
            0%   { transform: scale(1.0)  translate(0%,    0%   ); }
            25%  { transform: scale(1.06) translate(-0.6%, -0.4%); }
            50%  { transform: scale(1.09) translate(0.4%,  0.5% ); }
            75%  { transform: scale(1.06) translate(0.6%,  -0.3%); }
            100% { transform: scale(1.0)  translate(0%,    0%   ); }
          }
          @keyframes filmFlicker {
            0%, 100% { opacity: 1; }
            92%       { opacity: 0.97; }
            94%       { opacity: 1; }
            96%       { opacity: 0.98; }
          }
        `}</style>

        {/* Thumbnail / "video" */}
        <div className="absolute inset-0 overflow-hidden">
          <ImageWithFallback
            src={content!.banner}
            alt={content!.t}
            className={`w-full h-full object-cover transition-[filter] duration-[1500ms] ${isPlaying ? "brightness-[0.78]" : "brightness-50"}`}
            style={isPlaying ? {
              animation: "kenBurns 24s ease-in-out infinite, filmFlicker 8s ease-in-out infinite",
              transformOrigin: "center center",
            } : {}}
          />
        </div>

        {/* Cinematic vignette — intensifies when playing */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-[1200ms] ${isPlaying ? "opacity-100" : "opacity-60"}`}
          style={{ background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.82) 100%)" }}
        />

        {/* Warm color grade — subtle amber/teal split */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-[1500ms] mix-blend-overlay ${isPlaying ? "opacity-100" : "opacity-0"}`}
          style={{ background: "linear-gradient(160deg, rgba(255,160,60,0.06) 0%, transparent 45%, rgba(60,120,255,0.05) 100%)" }}
        />

        {/* Cinematic letterbox bars with gradient fades */}
        <div className="absolute inset-x-0 top-0 h-[8%] bg-black pointer-events-none" />
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{ top: "8%", height: "4%", background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[8%] bg-black pointer-events-none" />
        <div
          className="absolute inset-x-0 pointer-events-none"
          style={{ bottom: "8%", height: "4%", background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}
        />

        {/* Film grain overlay */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${isPlaying ? "opacity-[0.035]" : "opacity-0"}`}
          style={{ background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px" }}
        />

        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025] [background:repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(255,255,255,1)_2px,rgba(255,255,255,1)_3px)]" />

        {/* Episode nav arrows */}
        {type === "anime" && (
          <>
            {currentEp > 1 && (
              <button
                onClick={() => goToEp(currentEp - 1)}
                className={`absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 backdrop-blur border border-white/15 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all duration-200 ${showControls ? "opacity-100" : "opacity-0"}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {currentEp < totalEps && (
              <button
                onClick={() => goToEp(currentEp + 1)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 backdrop-blur border border-white/15 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/70 transition-all duration-200 ${showControls ? "opacity-100" : "opacity-0"}`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {/* Center play button */}
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={() => { setIsPlaying(!isPlaying); resetHideTimer(); }}
        >
          <div
            className={`transition-all duration-300 ${isPlaying ? "opacity-0 scale-75" : "opacity-100 scale-100"}`}
          >
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.2)] hover:bg-white/20 hover:scale-110 transition-all">
              <Play className="w-8 h-8 fill-white text-white ml-1" />
            </div>
          </div>
          {isPlaying && (
            <div className={`transition-all duration-200 ${showControls ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
              <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center">
                <Pause className="w-6 h-6 fill-white text-white" />
              </div>
            </div>
          )}
        </button>

        {/* Playing pulse */}
        {isPlaying && (
          <div className="absolute top-4 left-4 flex items-center gap-1.5">
            <div className="flex gap-0.5 items-end h-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-pink-400 rounded-sm"
                  style={{
                    height: `${40 + i * 20}%`,
                    animation: `pulse ${0.6 + i * 0.15}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span className="text-white/70 text-xs">Đang phát</span>
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={`absolute inset-x-0 bottom-0 transition-all duration-300 ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)" }}
        >
          {/* Episode title */}
          <div className="px-5 pt-4 pb-2 text-white/80 text-sm truncate">
            {type === "anime" ? (
              <span><span className="text-pink-300">Tập {currentEp}</span> — {episode?.title}</span>
            ) : (
              <span>{content!.t} · {content!.year}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 mb-1 text-xs text-white/50">
              <span className="tabular-nums">08:32</span>
              <div className="flex-1 h-1 bg-white/20 rounded-full relative cursor-pointer group/bar hover:h-1.5 transition-all">
                {/* Buffered */}
                <div className="absolute inset-y-0 left-0 bg-white/20 rounded-full" style={{ width: "62%" }} />
                {/* Played */}
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full relative"
                  style={{ width: progressWidth }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition" />
                </div>
              </div>
              <span className="tabular-nums">{episode?.runtime ?? "1:48:00"}</span>
            </div>
          </div>

          {/* Buttons row */}
          <div className="px-5 pb-4 flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={() => { setIsPlaying(!isPlaying); resetHideTimer(); }}
              className="text-white hover:text-pink-300 transition p-1"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => type === "anime" && goToEp(currentEp + 1)}
              className="text-white/70 hover:text-white transition p-1"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button onClick={() => setIsMuted(!isMuted)} className="text-white/70 hover:text-white transition p-1">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
                <div className="w-20 h-1 bg-white/20 rounded-full cursor-pointer">
                  <div className="h-full bg-white rounded-full" style={{ width: isMuted ? "0%" : `${volume}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1" />

            {/* Subtitle */}
            <div className="relative">
              <button
                className="flex items-center gap-1 text-white/60 hover:text-white text-xs transition px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>{subtitles}</span>
              </button>
            </div>

            {/* Quality */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-1 text-white/60 hover:text-white text-xs transition px-2 py-1 rounded bg-white/5 hover:bg-white/10"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{quality}</span>
              </button>
              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-36 rounded-xl bg-black/90 backdrop-blur border border-white/10 py-2">
                  {["1080p", "720p", "480p"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setQuality(q); setShowSettings(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition ${quality === q ? "text-pink-300" : "text-white/70"}`}
                    >
                      {quality === q && <Check className="w-3 h-3" />}
                      {quality !== q && <span className="w-3" />}
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode list toggle */}
            {type === "anime" && (
              <button
                onClick={() => setShowEpList(!showEpList)}
                className={`flex items-center gap-1.5 text-xs transition px-2 py-1 rounded border ${showEpList ? "text-pink-300 border-pink-400/40 bg-pink-500/10" : "text-white/60 hover:text-white border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Tập phim</span>
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white/70 hover:text-white transition p-1"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Episode list panel */}
        {showEpList && type === "anime" && content!.episodes && (
          <div className="absolute top-0 right-0 h-full w-72 bg-black/90 backdrop-blur border-l border-white/10 flex flex-col z-10">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="text-white text-sm">Danh sách tập</div>
              <button onClick={() => setShowEpList(false)} className="text-white/50 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {content!.episodes?.map((ep) => (
                <button
                  key={ep.n}
                  onClick={() => goToEp(ep.n)}
                  className={`w-full flex gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition text-left ${ep.n === currentEp ? "bg-pink-500/10" : ""}`}
                >
                  <div className="relative w-20 h-12 rounded overflow-hidden shrink-0">
                    <ImageWithFallback src={ep.img} alt={ep.title} className="w-full h-full object-cover" />
                    {ep.n === currentEp && (
                      <div className="absolute inset-0 bg-pink-500/40 flex items-center justify-center">
                        <Play className="w-3 h-3 fill-white text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs ${ep.n === currentEp ? "text-pink-400" : "text-white/40"}`}>Tập {ep.n}</div>
                    <div className={`text-sm truncate ${ep.n === currentEp ? "text-pink-200" : "text-white/80"}`}>{ep.title}</div>
                    <div className="text-xs text-white/30">{ep.runtime}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Content below player ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-6">
        <div className={`grid gap-8 ${type === "anime" && content!.episodes ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-[1fr_320px]"}`}>

          {/* ── Main column ── */}
          <div>
            {/* Title block */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-white" style={{ fontFamily: "Shippori Mincho, serif", fontSize: "clamp(18px, 2.5vw, 28px)" }}>
                  {type === "anime" ? episode?.title ?? `Tập ${currentEp}` : content!.t}
                </h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {type === "anime" && (
                    <span className="flex items-center gap-1 text-white/50 text-sm">
                      <Tv className="w-3.5 h-3.5" /> Tập {currentEp}/{content!.ep}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-white/50 text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    {episode?.runtime ?? "1h 48m"}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-300 text-sm">
                    <Star className="w-3.5 h-3.5 fill-yellow-300" /> {content!.score}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/30 text-pink-300 text-xs">
                    {content!.status}
                  </span>
                </div>
              </div>

              <MediaActionButtons />
            </div>

            {/* Genre tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {content!.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/20 transition cursor-pointer">
                  {tag}
                </span>
              ))}
            </div>

            {/* Synopsis */}
            <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/8">
              <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Nội dung</div>
              <p className="text-white/70 text-sm leading-relaxed">{content!.synopsis}</p>
            </div>

            {/* Episode nav strip (anime only) */}
            {type === "anime" && (
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => goToEp(currentEp - 1)}
                  disabled={currentEp <= 1}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition text-sm"
                >
                  <ChevronLeft className="w-4 h-4" /> Tập trước
                </button>
                <button
                  onClick={() => setShowEpList(true)}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white text-sm transition hover:bg-white/10"
                >
                  <ChevronDown className="w-4 h-4" /> Tập {currentEp}/{totalEps}
                </button>
                <button
                  onClick={() => goToEp(currentEp + 1)}
                  disabled={currentEp >= totalEps}
                  className="flex items-center gap-1.5 px-4 h-10 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white disabled:opacity-30 transition text-sm shadow-[0_0_20px_rgba(255,90,150,0.3)]"
                >
                  Tập tiếp <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <WatchPartyCta />

            <MediaReviews reviews={content.reviews} currentEp={currentEp} comment={comment} setComment={setComment} />
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-5">
            {/* ─ ANIME sidebar ─ */}
            {type === "anime" && (
              <>
                {/* Stats panel */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="p-4 border-b border-white/5">
                    <div className="text-xs text-white/40 uppercase tracking-wider">Thông tin tác phẩm</div>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center p-3 rounded-xl bg-white/[0.03]">
                      <div className="flex items-center gap-1 text-yellow-300">
                        <Star className="w-3.5 h-3.5 fill-yellow-300" />
                        <span className="text-base">{content!.score}</span>
                      </div>
                      <div className="text-white/35 text-[11px] mt-1">Điểm IMDb</div>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-xl bg-white/[0.03]">
                      <div className="text-pink-300 text-base">{totalEps}</div>
                      <div className="text-white/35 text-[11px] mt-1">Số tập</div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between p-3 rounded-xl bg-white/[0.03] gap-2">
                      <div>
                        <div className="text-white/70 text-xs">{content!.studio}</div>
                        <div className="text-white/35 text-[11px] mt-0.5">{content!.year}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/30 text-pink-300 text-[11px] shrink-0">
                        {content!.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Episode list */}
                {content!.episodes && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white text-sm" style={{ fontFamily: "Shippori Mincho, serif" }}>Danh sách tập</div>
                      <span className="text-white/40 text-xs">{content!.ep} tập</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden" style={{ maxHeight: "340px", overflowY: "auto" }}>
                      {content!.episodes?.map((ep) => (
                        <Link
                          key={ep.n}
                          href={`/anime/${content!.slug}/${ep.n}`}
                          className={`flex gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition last:border-0 ${ep.n === currentEp ? "bg-pink-500/10" : ""}`}
                        >
                          <div className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback src={ep.img} alt={ep.title} className="w-full h-full object-cover" />
                            {ep.n === currentEp && (
                              <div className="absolute inset-0 bg-pink-500/40 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                  <Play className="w-3 h-3 fill-white text-white ml-0.5" />
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-1 right-1 px-1 rounded bg-black/80 text-[9px] text-white">{ep.runtime}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs mb-0.5 ${ep.n === currentEp ? "text-pink-400" : "text-white/40"}`}>Tập {ep.n}</div>
                            <div className={`text-sm truncate ${ep.n === currentEp ? "text-pink-200" : "text-white/80"}`}>{ep.title}</div>
                            <div className="text-xs text-white/30 mt-0.5 line-clamp-1">{ep.desc}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cast */}
                {content!.cast && content!.cast.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                      <div className="text-xs text-white/40 uppercase tracking-wider">Nhân vật chính</div>
                    </div>
                    <div className="p-3 space-y-1">
                      {content!.cast.slice(0, 4).map((c) => (
                        <div key={c.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-white/10">
                            <ImageWithFallback src={c.img} alt={c.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-xs truncate">{c.name}</div>
                            <div className="text-white/35 text-[11px]">{c.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related anime */}
                {related.length > 0 && (
                  <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-3 px-1">Anime tương tự</div>
                    <div className="space-y-1">
                      {related.map((r) => (
                        <Link
                          key={r.slug}
                          href={`/anime/${r.slug}`}
                          className="flex gap-3 p-2 rounded-xl hover:bg-white/5 transition group"
                        >
                          <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0">
                            <ImageWithFallback src={r.img} alt={r.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs truncate group-hover:text-pink-300 transition">{r.t}</div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-white/35 text-[11px]">{r.ep} tập</span>
                              <span className="text-white/20 text-[11px]">·</span>
                              <span className="flex items-center gap-0.5 text-yellow-300 text-[11px]">
                                <Star className="w-2.5 h-2.5 fill-yellow-300" /> {r.score}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─ FILM sidebar ─ */}
            {type === "film" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <div className="aspect-[3/4] relative">
                    <ImageWithFallback src={content!.img} alt={content!.t} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-white text-sm" style={{ fontFamily: "Shippori Mincho, serif" }}>{content!.t}</h3>
                      <div className="text-white/50 text-xs mt-1">{content!.year}</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 text-sm border-t border-white/5">
                    <div className="flex justify-between">
                      <span className="text-white/40">Đạo diễn</span>
                      <span className="text-white">{content!.director}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Thể loại</span>
                      <span className="text-white text-right max-w-[180px] truncate">{content!.tags.join(", ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Đánh giá</span>
                      <span className="text-yellow-300 flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-300" />{content!.score}/10</span>
                    </div>
                  </div>
                </div>

                {/* Cast for film */}
                {content!.cast && content!.cast.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
                    <div className="p-4 border-b border-white/5">
                      <div className="text-xs text-white/40 uppercase tracking-wider">Diễn viên</div>
                    </div>
                    <div className="p-3 space-y-1">
                      {content!.cast.slice(0, 4).map((c) => (
                        <div key={c.name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                            <ImageWithFallback src={c.img} alt={c.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-xs truncate">{c.name}</div>
                            <div className="text-white/35 text-[11px]">{c.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related films */}
                <div>
                  <div className="text-white/40 text-xs uppercase tracking-wider mb-3">Phim tương tự</div>
                  <div className="space-y-2">
                    {related.map((r) => (
                      <Link
                        key={r.slug}
                        href={`/film/${r.slug}`}
                        className="flex gap-3 p-2 rounded-xl hover:bg-white/5 transition group"
                      >
                        <div className="w-16 h-22 rounded-lg overflow-hidden shrink-0" style={{ height: "88px" }}>
                          <ImageWithFallback src={r.img} alt={r.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white text-sm group-hover:text-pink-300 transition truncate">{r.t}</div>
                          <div className="text-white/40 text-xs mt-1">{r.year}</div>
                          <div className="flex items-center gap-1 text-yellow-300 text-xs mt-1">
                            <Star className="w-3 h-3 fill-yellow-300" /> {r.score}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}