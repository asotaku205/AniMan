"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, BookOpen,
  AlignLeft, Type, List, X,
  BookMarked, Scroll
} from "lucide-react";
import type { Novel } from "@/app/components/data/novels";
import { NovelChapterList } from "./NovelChapterList";
import { NovelReaderHeader } from "./NovelReaderHeader";
import { NovelReaderProgress } from "./NovelReaderProgress";

type FontSize = "sm" | "md" | "lg" | "xl";
type Theme = "paper" | "dark" | "sepia" | "night";
type FontFamily = "serif" | "mincho" | "sans";
type ReadMode = "scroll" | "book";

const FONT_SIZES: Record<FontSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

const THEMES: Record<Theme, { bg: string; text: string; label: string; border: string }> = {
  paper: { bg: "bg-[#f5eedb]", text: "text-[#2a1a0a]", label: "Giấy", border: "border-[#d4c4a0]" },
  sepia: { bg: "bg-[#ede0c8]", text: "text-[#3a2510]", label: "Sepia", border: "border-[#c8b090]" },
  dark: { bg: "bg-[#1a1a2e]", text: "text-[#c8c0d8]", label: "Tối", border: "border-[#2a2a4e]" },
  night: { bg: "bg-[#0d0d0d]", text: "text-[#b0a898]", label: "Đêm", border: "border-[#1a1a1a]" },
};

const FONTS: Record<FontFamily, { style: React.CSSProperties; label: string }> = {
  serif: { style: { fontFamily: "Georgia, serif" }, label: "Serif" },
  mincho: { style: { fontFamily: "Shippori Mincho, serif" }, label: "Mincho" },
  sans: { style: { fontFamily: "system-ui, sans-serif" }, label: "Sans" },
};

// Mock chapter content generator
function getChapterContent(chapterNum: number, excerpt: string): string[] {
  const paragraphs = [
    excerpt,
    "Tôi không còn cảm thấy đôi chân của mình. Chỉ có gió, và những cánh hoa rời khỏi tôi, mỗi cánh mang theo một tên người tôi từng yêu...",
    "\"Cậu có tin vào kiếp sau không?\" — em hỏi, không nhìn tôi.\n\nTôi chưa kịp đáp. Một cánh hoa rơi xuống bàn tay em, rồi tan thành giọt mực loang trên trang giấy của ký ức.",
    "Tiếng chuông gió xa xăm vọng lại, như một câu hỏi không lời mà tôi đã giấu trong lòng suốt nhiều năm. Tôi muốn nói gì đó, nhưng cổ họng đã bị mùa xuân khóa kín.",
    "Có những điều, có lẽ, sinh ra để không có câu trả lời. Chương " + chapterNum + " này, tôi hiểu điều đó hơn bao giờ hết.",
    "Ánh nắng buổi chiều xiên qua khe cửa sổ, rọi vào bụi bặm lơ lửng trong không khí. Mỗi hạt bụi như một ký ức — nhỏ bé, vô hình, nhưng luôn ở đó.",
    "\"Em sẽ không nhớ mình đã khóc lần này,\" tôi tự nhủ. Nhưng lần nào tôi cũng nhớ. Đó là cách ký ức hành hạ ta — không phải bằng cách xóa đi, mà bằng cách cho ta xem lại mãi mãi.",
  ];
  return paragraphs;
}

export function NovelReaderPage({ novel, chapterNum }: { novel: Novel; chapterNum: number }) {
  const router = useRouter();
  const n = novel;
  const slug = n.slug;

  const chapterIdx = Math.max(0, Math.min(chapterNum - 1, n.chapters.length - 1));
  const currentChapter = n.chapters[chapterIdx];

  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [theme, setTheme] = useState<Theme>("paper");
  const [fontFamily, setFontFamily] = useState<FontFamily>("mincho");
  const [lineHeight, setLineHeight] = useState<"normal" | "relaxed" | "loose">("relaxed");
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [progress, setProgress] = useState(0);
  const [readMode, setReadMode] = useState<ReadMode>("scroll");
  const [spreadIdx, setSpreadIdx] = useState(0);
  const [flipDir, setFlipDir] = useState<"none" | "next" | "prev">("none");
  const bookStageRef = useRef<HTMLDivElement>(null);

  const th = THEMES[theme];
  const fn = FONTS[fontFamily];
  const content = getChapterContent(currentChapter.n, n.excerpt);

  const lineHeightClass = { normal: "leading-7", relaxed: "leading-9", loose: "leading-10" }[lineHeight];

  // Book mode: split content into pages (3 paragraphs per page)
  const PARAS_PER_PAGE = 2;
  const bookPages: string[][] = [];
  for (let i = 0; i < content.length; i += PARAS_PER_PAGE) {
    bookPages.push(content.slice(i, i + PARAS_PER_PAGE));
  }
  const totalSpreads = Math.ceil(bookPages.length / 2);
  const leftPageContent = bookPages[spreadIdx * 2] ?? [];
  const rightPageContent = bookPages[spreadIdx * 2 + 1] ?? [];

  const scrollToBookTop = () => {
    bookStageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const flipPage = (dir: "next" | "prev") => {
    if (dir === "next" && spreadIdx >= totalSpreads - 1) return;
    if (dir === "prev" && spreadIdx <= 0) return;
    scrollToBookTop();
    setFlipDir(dir);
    setTimeout(() => {
      setSpreadIdx((prev) => (dir === "next" ? prev + 1 : prev - 1));
    }, 230);
    setTimeout(() => {
      setFlipDir("none");
    }, 460);
  };

  // Track scroll progress
  useEffect(() => {
    if (readMode === "book") return;
    function handleScroll() {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [readMode]);

  // Hide/show header on scroll
  useEffect(() => {
    if (readMode === "book") return;
    let last = window.scrollY;
    function handleScroll() {
      const curr = window.scrollY;
      setShowHeader(curr < 100 || curr < last);
      last = curr;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [readMode]);

  const hasPrev = chapterIdx > 0;
  const hasNext = chapterIdx < n.chapters.length - 1;

  // ─── BOOK MODE ────────────────────────────────────────────────────
  if (readMode === "book") {
    const isLight = theme === "paper" || theme === "sepia";
    const pageBg = theme === "paper" ? "#f5eedb" : theme === "sepia" ? "#ede0c8" : theme === "dark" ? "#1e1b2e" : "#141414";
    const pageText = theme === "paper" ? "#2a1a0a" : theme === "sepia" ? "#3a2510" : "#c8c0d8";
    const spineBg = isLight
      ? "linear-gradient(90deg, #d4b896, #b8956a, #c8a878, #b8956a, #d4b896)"
      : "linear-gradient(90deg, #2a2040, #1a1530, #252040, #1a1530, #2a2040)";
    const coverShadow = isLight
      ? "0 60px 120px -20px rgba(0,0,0,0.75), 0 20px 40px rgba(0,0,0,0.45)"
      : "0 60px 120px -20px rgba(0,0,0,0.95), 0 20px 40px rgba(0,0,0,0.7)";
    // Caveat handwriting for light themes — matching NovelStudio look
    const pageBodyStyle: React.CSSProperties = isLight
      ? { fontFamily: "Caveat, cursive" }
      : fn.style;

    return (
      <div
        ref={bookStageRef}
        className="min-h-screen flex flex-col scroll-mt-16"
        style={{
          background: isLight
            ? "radial-gradient(ellipse at 50% 30%, #4a2e12 0%, #2a1a08 50%, #1a0e05 100%)"
            : "radial-gradient(ellipse at 50% 40%, #1a0f2e 0%, #0d0820 60%, #07040e 100%)",
        }}
      >
        {/* Wood grain overlay */}
        {isLight && (
          <div
            className="fixed inset-0 pointer-events-none opacity-20"
            style={{ background: "repeating-linear-gradient(90deg, transparent 0 70px, rgba(0,0,0,0.22) 70px 71px)" }}
          />
        )}

        {/* Book mode header */}
        <header
          className="sticky top-0 z-50 backdrop-blur-lg border-b px-6 h-14 flex items-center gap-4"
          style={{
            background: isLight ? "rgba(50,25,8,0.82)" : "rgba(7,4,14,0.85)",
            borderColor: isLight ? "rgba(180,120,60,0.25)" : "rgba(255,255,255,0.08)",
          }}
        >
          <button
            onClick={() => setReadMode("scroll")}
            className="flex items-center gap-2 text-sm transition"
            style={{ color: isLight ? "rgba(255,210,150,0.7)" : "rgba(255,255,255,0.5)" }}
          >
            <Scroll className="w-4 h-4" /> Chế độ cuộn
          </button>
          <div className="flex-1 text-center text-sm truncate" style={{ color: isLight ? "rgba(255,220,170,0.9)" : pageText }}>
            {n.t} · Chương {currentChapter.n}
          </div>
          <button
            onClick={() => setShowToc(!showToc)}
            className="p-2 rounded-lg transition"
            style={{ color: isLight ? "rgba(255,210,150,0.7)" : "rgba(255,255,255,0.5)" }}
          >
            <List className="w-4 h-4" />
          </button>
        </header>

        {/* TOC panel */}
        {showToc && (
          <div
            className="fixed top-14 right-4 z-50 w-72 max-h-[70vh] rounded-2xl shadow-2xl border flex flex-col"
            style={{
              background: isLight ? "#3a2010" : "#1a1a2e",
              borderColor: isLight ? "rgba(180,120,60,0.3)" : "rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: isLight ? "rgba(180,120,60,0.2)" : "rgba(255,255,255,0.1)" }}
            >
              <span className="text-sm" style={{ color: isLight ? "rgba(255,215,170,0.9)" : pageText }}>Mục lục</span>
              <button onClick={() => setShowToc(false)} className="p-1" style={{ color: isLight ? "rgba(255,215,170,0.6)" : pageText }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {n.chapters.map((ch, i) => (
                <Link
                  key={ch.n}
                  href={`/novel/${n.slug}/${ch.n}`}
                  onClick={() => { setShowToc(false); setSpreadIdx(0); }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${i === chapterIdx ? "bg-pink-400/20 text-pink-400" : ""}`}
                  style={i !== chapterIdx ? { color: isLight ? "rgba(255,205,155,0.7)" : pageText, opacity: 0.7 } : undefined}
                >
                  <div>
                    <div className="text-xs opacity-60">Chương {ch.n}</div>
                    <div className="truncate max-w-[180px]">{ch.title}</div>
                  </div>
                  <span className="text-[10px] opacity-40 shrink-0">{(ch.words / 1000).toFixed(1)}k</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Book container */}
        <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
          {/* Chapter title */}
          <div className="text-center mb-8 relative z-10">
            <div className="text-xs tracking-[0.45em] uppercase mb-2" style={{ color: isLight ? "rgba(255,205,140,0.55)" : "rgba(200,192,216,0.5)" }}>
              Chương {currentChapter.n}
            </div>
            <div className="text-lg" style={{ color: isLight ? "rgba(255,220,175,0.88)" : "#e0d8f0", fontFamily: "Shippori Mincho, serif" }}>
              {currentChapter.title}
            </div>
          </div>

          {/* ── Book spread ── */}
          <div className="relative w-full max-w-4xl mx-auto" style={{ perspective: "1800px" }}>
            <style>{`
              @keyframes spineGlowPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
            `}</style>

            {/* Animated book */}
            <div
              className="relative"
              style={{
                transform: flipDir === "next"
                  ? "rotateX(6deg) rotateY(-20deg) scale(0.91)"
                  : flipDir === "prev"
                  ? "rotateX(6deg) rotateY(20deg) scale(0.91)"
                  : "rotateX(6deg) rotateY(0deg) scale(1)",
                transformStyle: "preserve-3d",
                transition: "transform 230ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 180ms ease",
                opacity: flipDir !== "none" ? 0.68 : 1,
              }}
            >
              {/* Leather cover */}
              <div
                className="absolute -inset-5 rounded-[14px] -z-10"
                style={{
                  background: isLight
                    ? "linear-gradient(135deg, #5a2a13, #3a1908, #2a1206)"
                    : "linear-gradient(135deg, #1a1230, #0d0920, #060410)",
                  boxShadow: isLight
                    ? "inset 0 2px 8px rgba(255,180,80,0.15), inset 0 -2px 8px rgba(0,0,0,0.5), 0 60px 120px -20px rgba(0,0,0,0.8)"
                    : "inset 0 2px 8px rgba(180,120,255,0.08), inset 0 -2px 8px rgba(0,0,0,0.7), 0 60px 120px -20px rgba(0,0,0,0.95)",
                }}
              />
              {/* Corner studs */}
              {["-top-3 -left-3", "-top-3 -right-3", "-bottom-3 -left-3", "-bottom-3 -right-3"].map((pos) => (
                <div key={pos} className={`absolute ${pos} w-3 h-3 rounded-full -z-10`}
                  style={{ background: isLight ? "#c8784a" : "#3a2060" }} />
              ))}

              <div className="flex" style={{ boxShadow: coverShadow, borderRadius: "4px" }}>
                {/* Left page */}
                <div className="flex-1 relative px-8 py-10 min-h-[560px] rounded-l" style={{ background: pageBg, color: pageText }}>
                  {/* Ruled lines */}
                  {isLight && (
                    <div className="absolute inset-0 pointer-events-none opacity-[0.06] rounded-l"
                      style={{ background: "repeating-linear-gradient(transparent, transparent 31px, #8a6a3a 31px, #8a6a3a 32px)" }} />
                  )}
                  <div className="absolute top-5 left-8 right-8 flex items-center gap-2 opacity-20">
                    <div className="flex-1 h-px" style={{ background: pageText }} />
                    <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: "Shippori Mincho, serif" }}>{n.t}</span>
                    <div className="flex-1 h-px" style={{ background: pageText }} />
                  </div>
                  <div className={`mt-8 space-y-5 ${FONT_SIZES[fontSize]} ${lineHeightClass}`} style={pageBodyStyle}>
                    {leftPageContent.length > 0 ? (
                      leftPageContent.map((para, i) => <p key={i} className="text-justify">{para}</p>)
                    ) : (
                      <p className="opacity-25 italic text-center mt-20" style={{ fontFamily: "Shippori Mincho, serif" }}>— Hết trang —</p>
                    )}
                  </div>
                  <div className="absolute bottom-5 left-8 text-xs opacity-30" style={{ color: pageText, fontFamily: "Shippori Mincho, serif" }}>{spreadIdx * 2 + 1}</div>
                  <div className="absolute bottom-0 left-0 w-7 h-7" style={{ background: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.04)", clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }} />
                </div>

                {/* Spine */}
                <div className="w-6 shrink-0" style={{ background: spineBg, boxShadow: "inset 3px 0 8px rgba(0,0,0,0.3), inset -3px 0 8px rgba(0,0,0,0.3)" }} />

                {/* Right page */}
                <div className="flex-1 relative px-8 py-10 min-h-[560px] rounded-r" style={{ background: theme === "paper" ? "#f8f2e4" : pageBg, color: pageText }}>
                  {isLight && (
                    <div className="absolute inset-0 pointer-events-none opacity-[0.06] rounded-r"
                      style={{ background: "repeating-linear-gradient(transparent, transparent 31px, #8a6a3a 31px, #8a6a3a 32px)" }} />
                  )}
                  <div className="absolute top-5 left-8 right-8 flex items-center gap-2 opacity-20">
                    <div className="flex-1 h-px" style={{ background: pageText }} />
                    <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: "Shippori Mincho, serif" }}>Chương {currentChapter.n}</span>
                    <div className="flex-1 h-px" style={{ background: pageText }} />
                  </div>
                  <div className={`mt-8 space-y-5 ${FONT_SIZES[fontSize]} ${lineHeightClass}`} style={pageBodyStyle}>
                    {rightPageContent.length > 0 ? (
                      rightPageContent.map((para, i) => <p key={i} className="text-justify">{para}</p>)
                    ) : (
                      <div className="flex flex-col items-center justify-center h-60 gap-4 opacity-25">
                        <div className="w-12 h-px" style={{ background: pageText }} />
                        <span className="text-xl" style={{ fontFamily: "Shippori Mincho, serif" }}>✦</span>
                        <div className="w-12 h-px" style={{ background: pageText }} />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-5 right-8 text-xs opacity-30" style={{ color: pageText, fontFamily: "Shippori Mincho, serif" }}>{spreadIdx * 2 + 2}</div>
                </div>
              </div>

              {/* Spine glow on flip */}
              {flipDir !== "none" && (
                <div className="absolute inset-y-0 z-30 pointer-events-none rounded" style={{
                  left: "calc(50% - 16px)", width: "32px",
                  background: isLight
                    ? "linear-gradient(90deg, transparent, rgba(255,200,120,0.75), transparent)"
                    : "linear-gradient(90deg, transparent, rgba(180,150,255,0.3), transparent)",
                  animation: "spineGlowPulse 230ms ease-in-out",
                }} />
              )}

              {/* Click zones */}
              <button onClick={() => flipPage("prev")} disabled={spreadIdx === 0}
                className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 transition disabled:pointer-events-none">
                <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur"
                  style={{ background: isLight ? "rgba(60,20,0,0.25)" : "rgba(255,255,255,0.1)" }}>
                  <ChevronLeft className="w-5 h-5" style={{ color: isLight ? "#f5c88a" : pageText }} />
                </div>
              </button>
              <button onClick={() => flipPage("next")} disabled={spreadIdx >= totalSpreads - 1}
                className="absolute right-0 top-0 bottom-0 w-16 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition disabled:pointer-events-none">
                <div className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur"
                  style={{ background: isLight ? "rgba(60,20,0,0.25)" : "rgba(255,255,255,0.1)" }}>
                  <ChevronRight className="w-5 h-5" style={{ color: isLight ? "#f5c88a" : pageText }} />
                </div>
              </button>
            </div>

            {/* Pen on desk */}
            <div className="absolute pointer-events-none" style={{ bottom: "-28px", right: "48px" }}>
              <div className="relative w-60 h-3 rounded-full rotate-[-8deg]"
                style={{ background: "linear-gradient(to right, #b05a1a, #e8a830, #b87830, #c89040, #8a4010)", boxShadow: "0 8px 20px rgba(0,0,0,0.55)" }} />
              <div className="absolute w-2 h-2 rounded-full bg-yellow-200 shadow-[0_0_6px_rgba(250,200,0,0.7)]"
                style={{ top: "2px", right: "-4px", transform: "rotate(-8deg)" }} />
              <div className="absolute w-3 h-1.5 rounded-r-full"
                style={{ top: "3px", left: "-10px", background: "#d4a040", transform: "rotate(-8deg)" }} />
            </div>
          </div>

          {/* Navigation controls */}
          <div className="mt-14 flex items-center gap-6 relative z-10">
            <button onClick={() => flipPage("prev")} disabled={spreadIdx === 0}
              className="flex items-center gap-2 px-5 h-10 rounded-full border text-sm transition disabled:opacity-30"
              style={{ borderColor: isLight ? "rgba(200,150,80,0.35)" : "rgba(255,255,255,0.2)", color: isLight ? "rgba(255,215,160,0.85)" : "rgba(255,255,255,0.7)", background: "transparent" }}>
              <ChevronLeft className="w-4 h-4" /> Trang trước
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalSpreads, 7) }).map((_, i) => (
                <button key={i} onClick={() => { scrollToBookTop(); setSpreadIdx(i); }} className="rounded-full transition-all"
                  style={{ width: i === spreadIdx ? "24px" : "8px", height: "8px",
                    background: i === spreadIdx ? (isLight ? "#c8855a" : "#e879a8") : (isLight ? "rgba(255,200,130,0.3)" : "rgba(255,255,255,0.2)") }} />
              ))}
              {totalSpreads > 7 && (
                <span className="text-xs opacity-40" style={{ color: isLight ? "#f5d090" : pageText }}>{spreadIdx + 1}/{totalSpreads}</span>
              )}
            </div>

            <button onClick={() => flipPage("next")} disabled={spreadIdx >= totalSpreads - 1}
              className="flex items-center gap-2 px-5 h-10 rounded-full text-sm transition disabled:opacity-30"
              style={{ background: isLight ? "linear-gradient(135deg, #c8855a, #9a6a3a)" : "linear-gradient(135deg, #ec4899, #f43f5e)", color: "#fff",
                boxShadow: isLight ? "0 4px 16px rgba(180,100,40,0.4)" : "0 4px 16px rgba(236,72,153,0.4)" }}>
              Trang sau <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Settings strip */}
          <div className="mt-6 flex items-center gap-3 rounded-2xl border px-4 py-2.5 relative z-10"
            style={{ background: isLight ? "rgba(40,20,8,0.58)" : "rgba(0,0,0,0.4)", borderColor: isLight ? "rgba(180,120,60,0.2)" : "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
            <span className="text-xs opacity-40" style={{ color: isLight ? "#f5d090" : pageText }}>Cỡ chữ</span>
            {(Object.keys(FONT_SIZES) as FontSize[]).map((s) => (
              <button key={s} onClick={() => setFontSize(s)} className="w-7 h-7 rounded-lg text-xs transition border"
                style={{ borderColor: fontSize === s ? "#ec4899" : "transparent", color: fontSize === s ? "#ec4899" : isLight ? "#f5d090" : pageText,
                  background: fontSize === s ? "rgba(236,72,153,0.1)" : "transparent", opacity: fontSize === s ? 1 : 0.5 }}>
                {s.toUpperCase()}
              </button>
            ))}
            <div className="w-px h-5 mx-1" style={{ background: isLight ? "rgba(200,150,80,0.2)" : "rgba(255,255,255,0.1)" }} />
            <span className="text-xs opacity-40" style={{ color: isLight ? "#f5d090" : pageText }}>Giao diện</span>
            {(Object.keys(THEMES) as Theme[]).map((t) => (
              <button key={t} onClick={() => setTheme(t)} className="w-5 h-5 rounded-full border-2 transition"
                style={{ borderColor: theme === t ? "#ec4899" : "transparent" }} title={THEMES[t].label}>
                <div className="w-full h-full rounded-full"
                  style={{ background: t === "paper" ? "#f5eedb" : t === "sepia" ? "#ede0c8" : t === "dark" ? "#1a1a2e" : "#0d0d0d" }} />
              </button>
            ))}
            <div className="flex-1" />
            {hasPrev && (
              <Link href={`/novel/${n.slug}/${n.chapters[chapterIdx - 1].n}`} onClick={() => setSpreadIdx(0)}
                className="text-xs opacity-50 hover:opacity-100 transition flex items-center gap-1" style={{ color: isLight ? "#f5d090" : pageText }}>
                <ChevronLeft className="w-3 h-3" /> Chương trước
              </Link>
            )}
            {hasNext && (
              <Link href={`/novel/${n.slug}/${n.chapters[chapterIdx + 1].n}`} onClick={() => setSpreadIdx(0)}
                className="text-xs opacity-50 hover:opacity-100 transition flex items-center gap-1" style={{ color: isLight ? "#f5d090" : pageText }}>
                Chương sau <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── SCROLL MODE (existing) ────────────────────────────────────────
  return (
    <div className={`min-h-screen ${th.bg} transition-colors duration-300`}>
      <NovelReaderHeader
        novel={n}
        chapter={currentChapter}
        themeClass={th.text}
        isLightTheme={theme === "paper" || theme === "sepia"}
        showHeader={showHeader}
        showSettings={showSettings}
        showToc={showToc}
        onBookMode={() => { setReadMode("book"); setSpreadIdx(0); }}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onToggleToc={() => setShowToc(!showToc)}
      />
      <div className="fixed top-0 left-0 right-0 z-[60] h-0.5 bg-transparent">
        <div className="h-full bg-gradient-to-r from-pink-400 to-rose-300 transition-all duration-150" style={{ width: `${progress}%` }} />
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className={`fixed top-14 right-4 z-50 w-72 rounded-2xl shadow-2xl border p-5 ${theme === "paper" || theme === "sepia" ? "bg-white border-black/10" : "bg-[#1a1a2e] border-white/10"}`}>
          <div className="flex items-center justify-between mb-4">
            <span className={`text-sm ${th.text}`}>Tuỳ chỉnh đọc</span>
            <button onClick={() => setShowSettings(false)} className={`p-1 rounded-lg ${th.text} opacity-60 hover:opacity-100`}><X className="w-4 h-4" /></button>
          </div>

          {/* Read Mode */}
          <div className="mb-4">
            <div className={`text-xs uppercase tracking-wider mb-2 opacity-50 ${th.text}`}>Chế độ đọc</div>
            <div className="flex gap-2">
              <button
                onClick={() => setReadMode("scroll")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition border ${readMode === "scroll" ? "border-pink-400 bg-pink-400/10 text-pink-400" : `border-transparent ${th.text} opacity-60 hover:opacity-100`}`}
              >
                <Scroll className="w-3.5 h-3.5" /> Cuộn
              </button>
              <button
                onClick={() => { setReadMode("book"); setSpreadIdx(0); setShowSettings(false); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition border ${readMode === "scroll" ? "border-pink-400 bg-pink-400/10 text-pink-400" : `border-transparent ${th.text} opacity-60 hover:opacity-100`}`}
              >
                <BookMarked className="w-3.5 h-3.5" /> Quyển sách
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="mb-4">
            <div className={`text-xs uppercase tracking-wider mb-2 opacity-50 ${th.text}`}>Giao diện</div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(THEMES) as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition ${theme === t ? "border-pink-400" : "border-transparent"}`}
                >
                  <div className={`w-8 h-6 rounded ${THEMES[t].bg} border ${THEMES[t].border}`} />
                  <span className={`text-[10px] ${th.text} opacity-70`}>{THEMES[t].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font size */}
          <div className="mb-4">
            <div className={`text-xs uppercase tracking-wider mb-2 opacity-50 ${th.text}`}>Cỡ chữ</div>
            <div className="flex gap-2">
              {(Object.keys(FONT_SIZES) as FontSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`flex-1 py-2 rounded-lg text-sm transition border ${fontSize === s ? "border-pink-400 bg-pink-400/10 text-pink-400" : `border-transparent ${th.text} opacity-60 hover:opacity-100`}`}
                >
                  <Type className="w-3.5 h-3.5 mx-auto" style={{ fontSize: { sm: "12px", md: "14px", lg: "16px", xl: "18px" }[s] }} />
                </button>
              ))}
            </div>
          </div>

          {/* Font family */}
          <div className="mb-4">
            <div className={`text-xs uppercase tracking-wider mb-2 opacity-50 ${th.text}`}>Kiểu chữ</div>
            <div className="flex gap-2">
              {(Object.keys(FONTS) as FontFamily[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFontFamily(f)}
                  className={`flex-1 py-2 rounded-lg text-xs transition border ${fontFamily === f ? "border-pink-400 bg-pink-400/10 text-pink-400" : `border-transparent ${th.text} opacity-60 hover:opacity-100`}`}
                  style={FONTS[f].style}
                >
                  {FONTS[f].label}
                </button>
              ))}
            </div>
          </div>

          {/* Line height */}
          <div>
            <div className={`text-xs uppercase tracking-wider mb-2 opacity-50 ${th.text}`}>Giãn dòng</div>
            <div className="flex gap-2">
              {(["normal", "relaxed", "loose"] as const).map((lh) => (
                <button
                  key={lh}
                  onClick={() => setLineHeight(lh)}
                  className={`flex-1 py-2 rounded-lg text-xs transition border ${lineHeight === lh ? "border-pink-400 bg-pink-400/10 text-pink-400" : `border-transparent ${th.text} opacity-60 hover:opacity-100`}`}
                >
                  <AlignLeft className="w-3.5 h-3.5 mx-auto" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table of Contents panel */}
      {showToc && (
        <div className={`fixed top-14 right-4 z-50 w-72 max-h-[70vh] rounded-2xl shadow-2xl border flex flex-col ${theme === "paper" || theme === "sepia" ? "bg-white border-black/10" : "bg-[#1a1a2e] border-white/10"}`}>
          <div className={`p-4 border-b flex items-center justify-between ${theme === "paper" || theme === "sepia" ? "border-black/10" : "border-white/10"}`}>
            <span className={`text-sm ${th.text}`}>Mục lục</span>
            <button onClick={() => setShowToc(false)} className={`p-1 rounded-lg ${th.text} opacity-60 hover:opacity-100`}><X className="w-4 h-4" /></button>
          </div>
          <NovelChapterList novel={n} currentChapter={chapterIdx} onSelect={() => setShowToc(false)} itemClassName={th.text} />
        </div>
      )}

      {/* Reading content */}
      <main className="pt-24 pb-32">
        <div className="max-w-[680px] mx-auto px-6 md:px-10">
          {/* Chapter header */}
          <div className="text-center mb-12">
            <div className={`text-xs uppercase tracking-[0.4em] opacity-50 mb-3 ${th.text}`}>
              {n.t}
            </div>
            <h2 className={`text-3xl md:text-4xl ${th.text}`} style={{ fontFamily: "Shippori Mincho, serif" }}>
              Chương {currentChapter.n}
            </h2>
            <h3 className={`text-xl mt-2 opacity-70 ${th.text}`} style={fn.style}>
              {currentChapter.title}
            </h3>
            <div className={`mt-4 flex items-center justify-center gap-4 text-xs opacity-40 ${th.text}`}>
              <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {currentChapter.words.toLocaleString()} chữ</span>
              <span>~{Math.ceil(currentChapter.words / 250)} phút đọc</span>
            </div>
            <div className={`mt-6 w-16 mx-auto h-px opacity-30 ${theme === "paper" || theme === "sepia" ? "bg-black" : "bg-white"}`} />
          </div>

          {/* Paragraphs */}
          <div className={`space-y-6 ${FONT_SIZES[fontSize]} ${lineHeightClass} ${th.text}`} style={fn.style}>
            {content.map((para, i) => (
              <p key={i} className="text-justify">
                {para}
              </p>
            ))}
          </div>

          {/* End of chapter decoration */}
          <div className="mt-16 mb-10 flex items-center gap-4">
            <div className={`flex-1 h-px opacity-20 ${theme === "paper" || theme === "sepia" ? "bg-black" : "bg-white"}`} />
            <span className="text-xl opacity-30">✦</span>
            <div className={`flex-1 h-px opacity-20 ${theme === "paper" || theme === "sepia" ? "bg-black" : "bg-white"}`} />
          </div>

          {/* Chapter navigation */}
          <div className="flex items-center justify-between gap-4">
            {hasPrev ? (
              <Link
                href={`/novel/${n.slug}/${n.chapters[chapterIdx - 1].n}`}
                className={`flex items-center gap-2 px-5 h-11 rounded-full border text-sm transition ${theme === "paper" || theme === "sepia" ? "border-black/20 text-black/70 hover:border-black/40 hover:bg-black/5" : "border-white/20 text-white/70 hover:border-white/40 hover:bg-white/5"}`}
              >
                <ChevronLeft className="w-4 h-4" />
                Chương trước
              </Link>
            ) : <div />}

            <button
              onClick={() => setShowToc(true)}
              className={`flex items-center gap-2 px-4 h-11 rounded-full border text-sm transition ${theme === "paper" || theme === "sepia" ? "border-black/20 text-black/60 hover:bg-black/5" : "border-white/20 text-white/60 hover:bg-white/5"}`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:block">Mục lục</span>
            </button>

            {hasNext ? (
              <Link
                href={`/novel/${n.slug}/${n.chapters[chapterIdx + 1].n}`}
                className="flex items-center gap-2 px-5 h-11 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm hover:from-pink-400 hover:to-rose-300 transition shadow-[0_4px_20px_rgba(255,90,150,0.3)]"
              >
                Chương sau <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href={`/novel/${n.slug}`}
                className="flex items-center gap-2 px-5 h-11 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 text-white text-sm hover:from-amber-400 hover:to-orange-300 transition"
              >
                Xem tổng quan <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </main>

      <NovelReaderProgress progress={progress} textClass={th.text} isLightTheme={theme === "paper" || theme === "sepia"} />
    </div>
  );
}
