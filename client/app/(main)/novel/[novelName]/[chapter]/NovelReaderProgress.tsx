"use client";

import { Bookmark, Share2 } from "lucide-react";

type NovelReaderProgressProps = {
  progress: number;
  textClass: string;
  isLightTheme: boolean;
};

export function NovelReaderProgress({ progress, textClass, isLightTheme }: NovelReaderProgressProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-all duration-300 ${isLightTheme ? "bg-white/90 border-t border-black/10" : "bg-black/80 border-t border-white/10"} backdrop-blur-lg px-6 py-3`}>
      <div className="max-w-[680px] mx-auto flex items-center gap-4">
        <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-pink-400 to-rose-300 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className={`text-xs opacity-50 shrink-0 ${textClass}`}>{Math.round(progress)}%</span>
        <button className={`p-2 rounded-lg opacity-60 hover:opacity-100 transition ${textClass}`}><Bookmark className="w-4 h-4" /></button>
        <button className={`p-2 rounded-lg opacity-60 hover:opacity-100 transition ${textClass}`}><Share2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
