"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Brush,
  Download,
  FileText,
  HelpCircle,
  FolderOpen,
  ChevronDown,
  Keyboard,
  LayoutGrid,
  Send,
  User,
  X,
} from "lucide-react";
import type { StudioMode } from "../data";

type Props = {
  mode: StudioMode;
  setMode: (m: StudioMode) => void;
  projectName?: string;
  onOpenProjectManager?: () => void;
  onExport?: () => void;
};

export function StudioHeader({
  mode,
  setMode,
  projectName,
  onOpenProjectManager,
  onExport,
}: Props) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <div className="h-12 bg-[#0d0817] border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight hidden sm:inline">
              Manga Studio
            </span>
          </div>

          {/* Nút Chọn / Đổi Dự Án */}
          {onOpenProjectManager && (
            <button
              onClick={onOpenProjectManager}
              title="Nhấn để đổi hoặc tạo dự án mới"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-medium transition-all group"
            >
              <FolderOpen size={13} className="text-pink-400 group-hover:scale-110 transition-transform" />
              <span className="truncate max-w-[130px] font-semibold">
                {projectName || "Chọn dự án"}
              </span>
              <ChevronDown size={12} className="text-white/40" />
            </button>
          )}

          <div className="flex bg-white/5 rounded-xl p-0.5 gap-0.5">
            {(
              [
                ["projects", <FolderOpen size={13} />, "Dự án"],
                ["draw", <Brush size={13} />, "Vẽ trang"],
                ["storyboard", <LayoutGrid size={13} />, "Story Board"],
                ["publish", <Send size={13} />, "Xuất bản"],
              ] as [StudioMode, React.ReactNode, string][]
            ).map(([m, icon, label]) => (
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
          {onExport && (
            <button
              onClick={onExport}
              title="Xuất trang truyện thành ảnh PNG"
              className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-xl"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={() => setShowHelp(true)}
            title="Phím tắt & Hướng dẫn sử dụng Studio"
            className="text-white/40 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-xl"
          >
            <Keyboard size={15} />
          </button>
          <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-fuchsia-600 rounded-full flex items-center justify-center cursor-pointer shadow-md">
            <User size={13} className="text-white" />
          </div>
        </div>
      </div>

      {/* Modal Phím tắt & Hướng dẫn */}
      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#120a1f] border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Keyboard size={16} className="text-pink-400" />
                <span>Phím tắt & Hướng dẫn Studio</span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03]">
                <span className="text-white/70">Hoàn tác nét vẽ (Undo)</span>
                <kbd className="px-2 py-0.5 bg-black/50 border border-white/20 rounded text-pink-400 font-mono text-[11px]">
                  Ctrl + Z
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03]">
                <span className="text-white/70">Làm lại nét vẽ (Redo)</span>
                <kbd className="px-2 py-0.5 bg-black/50 border border-white/20 rounded text-pink-400 font-mono text-[11px]">
                  Ctrl + Y / Ctrl + Shift + Z
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03]">
                <span className="text-white/70">Lưu tiến độ vẽ (Save Draft)</span>
                <kbd className="px-2 py-0.5 bg-black/50 border border-white/20 rounded text-pink-400 font-mono text-[11px]">
                  Ctrl + S
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.03]">
                <span className="text-white/70">Thoát toàn màn hình / Hủy</span>
                <kbd className="px-2 py-0.5 bg-black/50 border border-white/20 rounded text-pink-400 font-mono text-[11px]">
                  Escape
                </kbd>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 text-[11px] text-white/50 space-y-1">
              
              
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-medium text-xs transition-colors"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
