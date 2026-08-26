"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, BookOpen, Settings, AlignJustify,
  Columns2, Moon, Sun, X, Home, List, ZoomIn, ZoomOut, RotateCcw,
  ChevronDown, Check
} from "lucide-react";
import type { Manga } from "@/app/components/data/mangas";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";

// Generate mock page images (using banner + different effects via CSS)
function generateMockPages(bannerUrl: string, coverUrl: string, count: number) {
  const sources = [bannerUrl, coverUrl, bannerUrl, coverUrl];
  return Array.from({ length: count }).map((_, i) => ({
    n: i + 1,
    src: sources[i % sources.length],
    // Different object-position to simulate varied pages
    pos: ["top", "center", "bottom", "top", "center"][i % 5],
  }));
}

export function MangaReaderPage({ manga, chapterNum }: { manga: Manga; chapterNum: number }) {
  const router = useRouter();
  const slug = manga.slug;

  const totalChapters = manga.chapters.length;
  const currentChapter = manga.chapters.find((c) => c.n === chapterNum) ?? manga.chapters[0];
  const pages = generateMockPages(manga.banner, manga.cover, Math.min(currentChapter?.pages ?? 18, 12));

  const [readingMode, setReadingMode] = useState<"scroll" | "single" | "double">("scroll");
  const [theme, setTheme] = useState<"dark" | "light" | "sepia">("dark");
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const bgColors = { dark: "bg-[#0a0a0f]", light: "bg-gray-100", sepia: "bg-[#1a1208]" };
  const pageColors = { dark: "bg-[#111118]", light: "bg-white", sepia: "bg-[#f4e8d0]" };
  const textColor = { dark: "text-white", light: "text-gray-900", sepia: "text-[#2c1a00]" };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const progress = scrollHeight - clientHeight > 0
        ? (scrollTop / (scrollHeight - clientHeight)) * 100
        : 0;
      setScrollProgress(Math.min(100, progress));

      // Update current page estimate
      const pageHeight = scrollHeight / pages.length;
      const estimated = Math.floor(scrollTop / pageHeight) + 1;
      setCurrentPage(Math.min(Math.max(1, estimated), pages.length));
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [pages.length]);

  // Auto-hide UI after 3 seconds in scroll mode
  useEffect(() => {
    if (readingMode !== "scroll") return;
    const timer = setTimeout(() => setShowUI(false), 4000);
    return () => clearTimeout(timer);
  }, [readingMode, showUI]);

  const goToChapter = (n: number) => {
    if (n < 1 || n > totalChapters) return;
    router.push(`/manga/${slug}/${n}`);
    setCurrentPage(1);
    containerRef.current?.scrollTo(0, 0);
  };

  return (
    <div className={`flex flex-col overflow-hidden ${bgColors[theme]}`} style={{ height: "calc(100vh - 4rem)" }}>
      {/* Top bar */}
      <header
        className={`z-50 transition-all duration-300 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"} sticky top-0`}
        onMouseEnter={() => setShowUI(true)}
      >
        <div className="h-14 bg-black/80 backdrop-blur border-b border-white/8 flex items-center px-4 gap-3">
          {/* Left: back + title */}
          <Link href={`/manga/${slug}`} className="flex items-center gap-2 text-white/70 hover:text-white transition shrink-0">
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:block text-sm truncate max-w-[140px]">{manga.t}</span>
          </Link>

          <div className="w-px h-5 bg-white/15 hidden sm:block" />

          {/* Chapter selector */}
          <button
            onClick={() => setShowChapterList(!showChapterList)}
            className="flex items-center gap-1.5 text-white/90 text-sm hover:text-pink-300 transition"
          >
            <BookOpen className="w-4 h-4 text-pink-300 shrink-0" />
            <span className="hidden sm:block">Chương {chapterNum}</span>
            <span className="sm:hidden">Ch.{chapterNum}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {currentChapter && (
            <span className="text-white/40 text-sm hidden md:block truncate max-w-[200px]">
              — {currentChapter.title}
            </span>
          )}

          <div className="flex-1" />

          {/* Page counter */}
          <span className="text-white/50 text-xs tabular-nums hidden sm:block">
            {currentPage} / {pages.length}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Reading mode */}
            <button
              onClick={() => setReadingMode(readingMode === "scroll" ? "single" : "scroll")}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-white/70 hover:text-white transition"
              title="Chế độ đọc"
            >
              {readingMode === "scroll" ? <AlignJustify className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-white/70 hover:text-white transition"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Home */}
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-white/70 hover:text-white transition"
            >
              <Home className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-pink-500 to-fuchsia-400 transition-all duration-100"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>

      {/* Chapter list dropdown */}
      {showChapterList && (
        <div className="absolute top-14 left-0 right-0 z-50 bg-[#0d0d18]/95 backdrop-blur border-b border-white/10 max-h-[50vh] overflow-y-auto">
          <div className="max-w-lg mx-auto py-3">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-white/70 text-sm">Danh sách chương ({totalChapters})</span>
              <button onClick={() => setShowChapterList(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {manga.chapters.slice(0, 30).map((c) => (
                <button
                  key={c.n}
                  onClick={() => { goToChapter(c.n); setShowChapterList(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition ${c.n === chapterNum ? "text-pink-300" : "text-white/80"}`}
                >
                  {c.n === chapterNum && <Check className="w-3.5 h-3.5 shrink-0" />}
                  {c.n !== chapterNum && <span className="w-3.5 shrink-0" />}
                  <span className="text-xs text-white/40 w-10 shrink-0">#{c.n}</span>
                  <span className="flex-1 text-sm truncate">{c.title}</span>
                  <span className="text-xs text-white/30 shrink-0">{c.pages}tr</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-14 right-4 z-50 w-72 bg-[#13111f]/95 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white">Tùy chọn đọc</span>
            <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
          </div>

          {/* Theme */}
          <div className="mb-5">
            <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Nền</div>
            <div className="flex gap-2">
              {(["dark", "light", "sepia"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 py-2 rounded-xl text-xs border transition ${
                    theme === t ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-white/10 text-white/60 hover:border-white/20"
                  }`}
                >
                  {t === "dark" ? <><Moon className="w-3 h-3 mx-auto mb-1" />Tối</> :
                   t === "light" ? <><Sun className="w-3 h-3 mx-auto mb-1" />Sáng</> :
                   <><Sun className="w-3 h-3 mx-auto mb-1" />Sepia</>}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom */}
          <div className="mb-5">
            <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Thu phóng: {zoom}%</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(Math.max(60, zoom - 10))} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white">
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range" min={60} max={150} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-pink-500"
              />
              <button onClick={() => setZoom(Math.min(150, zoom + 10))} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom(100)} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Reading mode */}
          <div>
            <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Chế độ đọc</div>
            <div className="flex gap-2">
              {(["scroll", "single", "double"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setReadingMode(m)}
                  className={`flex-1 py-2 rounded-xl text-xs border transition ${
                    readingMode === m ? "border-pink-400 bg-pink-500/20 text-pink-300" : "border-white/10 text-white/60 hover:border-white/20"
                  }`}
                >
                  {m === "scroll" ? "Cuộn" : m === "single" ? "Đơn" : "Đôi"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main reading area */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden ${bgColors[theme]}`}
        onClick={() => setShowUI(!showUI)}
      >
        {readingMode === "scroll" ? (
          <div className="flex flex-col items-center py-4 gap-1">
            {pages.map((page) => (
              <div
                key={page.n}
                className={`relative ${pageColors[theme]} shadow-lg`}
                style={{ width: `${zoom}%`, maxWidth: "900px", minWidth: "280px" }}
              >
                <ImageWithFallback
                  src={page.src}
                  alt={`Trang ${page.n}`}
                  className={`w-full block ${theme === "dark" ? "brightness-90 contrast-110" : theme === "sepia" ? "brightness-75 sepia" : ""}`}
                  style={{ aspectRatio: "3/4", objectFit: "cover", objectPosition: page.pos as any }}
                />
                {/* Manga panel overlay effect */}
                <div className="absolute inset-0 pointer-events-none [background:linear-gradient(transparent_0%,transparent_90%,rgba(0,0,0,0.15)_100%)]" />
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white/70">
                  {page.n}
                </div>
              </div>
            ))}
          </div>
        ) : readingMode === "single" ? (
          <div className="flex flex-col h-full items-center justify-center py-4">
            <div
              className={`relative ${pageColors[theme]} shadow-2xl`}
              style={{ width: `${Math.min(zoom, 95)}%`, maxWidth: "700px" }}
            >
              <ImageWithFallback
                src={pages[currentPage - 1]?.src ?? ""}
                alt={`Trang ${currentPage}`}
                className="w-full block"
                style={{ aspectRatio: "3/4", objectFit: "cover" }}
              />
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-white/70">
                {currentPage} / {pages.length}
              </div>
            </div>
            {/* Page nav */}
            <div className="flex gap-6 mt-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/15 grid place-items-center text-white disabled:opacity-30 hover:bg-white/15 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(pages.length, currentPage + 1))}
                disabled={currentPage >= pages.length}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/15 grid place-items-center text-white disabled:opacity-30 hover:bg-white/15 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* Double page */
          <div className="flex flex-col h-full items-center justify-center py-4">
            <div
              className="flex gap-0.5"
              style={{ width: `${Math.min(zoom, 95)}%`, maxWidth: "1200px" }}
            >
              {[pages[currentPage * 2 - 2], pages[currentPage * 2 - 1]].map((page, idx) =>
                page ? (
                  <div key={idx} className={`flex-1 ${pageColors[theme]} shadow-2xl`}>
                    <ImageWithFallback
                      src={page.src}
                      alt={`Trang ${page.n}`}
                      className="w-full block"
                      style={{ aspectRatio: "3/4", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div key={idx} className={`flex-1 ${pageColors[theme]} opacity-20`} style={{ aspectRatio: "3/4" }} />
                )
              )}
            </div>
            <div className="flex gap-6 mt-4" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/15 grid place-items-center text-white disabled:opacity-30 hover:bg-white/15 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(pages.length / 2), currentPage + 1))}
                disabled={currentPage >= Math.ceil(pages.length / 2)}
                className="w-12 h-12 rounded-full bg-white/10 border border-white/15 grid place-items-center text-white disabled:opacity-30 hover:bg-white/15 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav bar */}
      <footer
        className={`z-50 transition-all duration-300 ${showUI ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full"} sticky bottom-0`}
        onMouseEnter={() => setShowUI(true)}
      >
        <div className="h-14 bg-black/85 backdrop-blur border-t border-white/8 flex items-center justify-between px-4 gap-3">
          <button
            onClick={() => goToChapter(chapterNum - 1)}
            disabled={chapterNum <= 1}
            className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30 transition text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Chương trước
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChapterList(true)}
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition text-sm"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:block">Chương {chapterNum}/{totalChapters}</span>
            </button>
          </div>

          <button
            onClick={() => goToChapter(chapterNum + 1)}
            disabled={chapterNum >= totalChapters}
            className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white disabled:opacity-30 transition text-sm shadow-[0_0_15px_rgba(255,90,150,0.3)]"
          >
            Chương tiếp <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}