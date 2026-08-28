"use client";

import { BookOpen, Brush, Download, FileText, LayoutGrid, Send, User } from "lucide-react";
import type { StudioMode } from "../data";

type Props = {
  mode: StudioMode;
  setMode: (m: StudioMode) => void;
};

export function StudioHeader({ mode, setMode }: Props) {
  return (
    <div className="h-12 bg-[#0d0817] border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Manga Studio</span>
        </div>

        <div className="flex bg-white/5 rounded-xl p-0.5 gap-0.5">
          {([
            ["draw",       <Brush size={13}/>,      "Vẽ trang"],
            ["storyboard", <LayoutGrid size={13}/>,  "Story Board"],
            ["publish",    <Send size={13}/>,         "Xuất bản"],
          ] as [StudioMode, React.ReactNode, string][]).map(([m, icon, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-medium transition-all ${
                mode === m
                  ? "bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-xl">
          <Download size={15}/>
        </button>
        <button className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-xl">
          <FileText size={15}/>
        </button>
        <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-fuchsia-600 rounded-full flex items-center justify-center">
          <User size={13} className="text-white"/>
        </div>
      </div>
    </div>
  );
}
