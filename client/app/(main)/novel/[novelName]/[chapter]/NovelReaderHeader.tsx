"use client";

import Link from "next/link";
import { BookMarked, ChevronLeft, List, Settings2 } from "lucide-react";
import type { Novel } from "@/app/components/data/novels";

type NovelReaderHeaderProps = {
  novel: Novel;
  chapter: Novel["chapters"][number];
  themeClass: string;
  isLightTheme: boolean;
  showHeader: boolean;
  showSettings: boolean;
  showToc: boolean;
  onBookMode: () => void;
  onToggleSettings: () => void;
  onToggleToc: () => void;
};

export function NovelReaderHeader({
  novel,
  chapter,
  themeClass,
  isLightTheme,
  showHeader,
  showSettings,
  showToc,
  onBookMode,
  onToggleSettings,
  onToggleToc,
}: NovelReaderHeaderProps) {
  const muted = isLightTheme ? "text-black/60" : "text-white/60";
  const hover = isLightTheme ? "hover:bg-black/10" : "hover:bg-white/10";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showHeader ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"} ${isLightTheme ? "bg-white/80 border-b border-black/10" : "bg-black/80 border-b border-white/10"} backdrop-blur-lg`}>
      <div className="max-w-[900px] mx-auto px-6 h-14 flex items-center gap-4">
        <Link href={`/novel/${novel.slug}`} className={`flex items-center gap-2 text-sm transition ${muted} ${isLightTheme ? "hover:text-black" : "hover:text-white"}`}>
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:block truncate max-w-32">{novel.t}</span>
        </Link>
        <div className="flex-1 text-center">
          <div className={`text-sm truncate ${isLightTheme ? "text-black/70" : "text-white/70"}`}>
            Chương {chapter.n} · {chapter.title}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBookMode} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition ${hover} ${muted}`}>
            <BookMarked className="w-4 h-4" />
            <span className="hidden sm:block">Quyển sách</span>
          </button>
          <button onClick={onToggleToc} className={`p-2 rounded-lg transition ${hover} ${showToc ? (isLightTheme ? "bg-black/10" : "bg-white/10") : ""}`}>
            <List className={`w-4 h-4 ${muted}`} />
          </button>
          <button onClick={onToggleSettings} className={`p-2 rounded-lg transition ${hover} ${showSettings ? (isLightTheme ? "bg-black/10" : "bg-white/10") : ""}`}>
            <Settings2 className={`w-4 h-4 ${muted}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
