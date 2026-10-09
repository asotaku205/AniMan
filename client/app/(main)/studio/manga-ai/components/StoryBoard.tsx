"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Brush,
  Plus,
  Send,
  Trash2,
  BookOpen,
  ArrowRight,
  Layers,
  Sparkles,
} from "lucide-react";
import { LAYOUTS, type LayoutDef } from "../data";
import type { MangaProject, MangaProjectPage } from "../hooks/useMangaProjects";

interface Props {
  project: MangaProject | null;
  onEditPage: (pageNumber: number) => void;
  onAddPage: () => void;
  onRemovePage: (pageNumber: number) => void;
  onProceedToPublish: () => void;
  onBack: () => void;
}

export default function StoryBoard({
  project,
  onEditPage,
  onAddPage,
  onRemovePage,
  onProceedToPublish,
  onBack,
}: Props) {
  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b0612] p-8 text-center">
        <p className="text-white/40 text-sm mb-3">Chưa có dự án nào được chọn.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-pink-500 text-white text-xs font-semibold"
        >
          Quay lại Studio
        </button>
      </div>
    );
  }

  const pages = project.pages || [];

  return (
    <div className="flex-1 flex flex-col bg-[#0b0612] overflow-hidden">
      {/* Top Banner / Actions */}
      <div className="h-14 border-b border-white/5 bg-[#0e0717] px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-sm tracking-tight">
                Story Board: {project.title}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-pink-500/20 text-pink-300 border border-pink-500/30">
                {project.genre}
              </span>
            </div>
            <p className="text-white/40 text-[10px]">
              Sắp xếp mạch truyện theo thứ tự trang • Tổng cộng {pages.length} trang
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAddPage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-all"
          >
            <Plus size={13} />
            <span>Thêm trang</span>
          </button>
          <button
            onClick={onProceedToPublish}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-semibold shadow-lg shadow-pink-500/20 transition-all"
          >
            <span>Tiến hành Xuất bản</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Pages Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {pages.map((pg, idx) => {
              const layoutDef =
                LAYOUTS.find((l) => l.id === pg.layoutId) || LAYOUTS[0];
              const panelsCount = layoutDef.panels.length;
              const drawnPanelsCount = Object.keys(pg.panels || {}).filter(
                (k) => !!pg.panels[k],
              ).length;

              return (
                <motion.div
                  key={pg.pageNumber}
                  whileHover={{ y: -4 }}
                  className="bg-[#120a1f] border border-white/10 hover:border-pink-500/50 rounded-2xl p-2.5 flex flex-col justify-between group shadow-xl transition-all"
                >
                  {/* Thumbnail canvas visualizer */}
                  <div
                    onClick={() => onEditPage(pg.pageNumber)}
                    className="aspect-[3/4] bg-white rounded-xl overflow-hidden relative cursor-pointer border border-gray-200 shadow-inner group-hover:ring-2 group-hover:ring-pink-500/50 transition-all"
                  >
                    {layoutDef.panels.map((p) => {
                      const panelImg = pg.panels?.[p.id];
                      return (
                        <div
                          key={p.id}
                          className="absolute border border-gray-300 overflow-hidden bg-gray-50 flex items-center justify-center"
                          style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                            width: `${p.w}%`,
                            height: `${p.h}%`,
                          }}
                        >
                          {panelImg ? (
                            <img
                              src={panelImg}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-[7px] text-gray-400 font-mono">
                              Khung
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPage(pg.pageNumber);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-[11px] font-semibold flex items-center gap-1 shadow-lg"
                      >
                        <Brush size={12} />
                        <span>Vẽ tiếp</span>
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Xóa Trang ${pg.pageNumber}?`)) {
                              onRemovePage(pg.pageNumber);
                            }
                          }}
                          className="text-white/60 hover:text-red-400 text-[10px] flex items-center gap-1 pt-1"
                        >
                          <Trash2 size={11} /> Xóa trang
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Page Footer Info */}
                  <div className="pt-2 px-1 flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-xs">
                        Trang {pg.pageNumber}
                      </p>
                      <p className="text-white/30 text-[9px]">
                        {drawnPanelsCount}/{panelsCount} khung đã vẽ
                      </p>
                    </div>
                    <button
                      onClick={() => onEditPage(pg.pageNumber)}
                      className="w-6 h-6 rounded-lg bg-white/5 hover:bg-pink-500 hover:text-white text-white/40 flex items-center justify-center transition-colors"
                      title="Chỉnh sửa trang"
                    >
                      <Brush size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {/* Quick Add Page Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAddPage}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/10 hover:border-pink-500/40 bg-white/[0.01] hover:bg-pink-500/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-white/30 hover:text-pink-400 p-4 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-pink-500/20">
                <Plus size={20} />
              </div>
              <span className="text-xs font-semibold">Thêm trang mới</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
