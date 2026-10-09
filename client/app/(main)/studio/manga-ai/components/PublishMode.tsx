"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  Send,
  BookOpen,
  ArrowLeft,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { LAYOUTS } from "../data";
import type { MangaProject } from "../hooks/useMangaProjects";

interface Props {
  project: MangaProject | null;
  onPublish: (id: string) => void;
  onBackToDraw: () => void;
}

export function PublishMode({ project, onPublish, onBackToDraw }: Props) {
  const [step, setStep] = useState<"form" | "preview" | "done">("form");
  const [title, setTitle] = useState(project?.title || "");
  const [genre, setGenre] = useState(project?.genre || "Action");
  const [desc, setDesc] = useState(project?.description || "");
  const [chapterName, setChapterName] = useState("Chương 1: Khởi đầu");

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setGenre(project.genre);
      setDesc(project.description);
    }
  }, [project]);

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b0612] p-8 text-center">
        <p className="text-white/40 text-sm mb-3">Chưa có dự án nào được chọn.</p>
        <button
          onClick={onBackToDraw}
          className="px-4 py-2 rounded-xl bg-pink-500 text-white text-xs font-semibold"
        >
          Quay lại Studio
        </button>
      </div>
    );
  }

  const pages = project.pages || [];

  if (step === "done") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#0b0612] p-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 15 }}
          className="w-20 h-20 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center shadow-xl shadow-green-500/20"
        >
          <CheckCircle2 size={40} className="text-green-400" />
        </motion.div>
        <div>
          <h2 className="text-white text-2xl font-bold mb-2">
            Đã xuất bản tác phẩm thành công!
          </h2>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Tác phẩm <span className="text-pink-400 font-semibold">"{title}"</span> ({chapterName}) gồm {pages.length} trang đã được đăng lên nền tảng AniMan Manga Reader.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/manga"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-semibold transition-all shadow-lg shadow-pink-500/20"
          >
            <span>Đến trang Đọc truyện</span>
            <ExternalLink size={13} />
          </Link>
          <button
            onClick={onBackToDraw}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium transition-colors"
          >
            Quay lại Studio tiếp tục vẽ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0612] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h2 className="text-white font-bold text-xl">Xuất bản Manga</h2>
            <p className="text-white/40 text-xs mt-0.5">
              Duyệt trang truyện và phát hành tác phẩm lên cộng đồng
            </p>
          </div>
          <button
            onClick={onBackToDraw}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={13} /> Quay lại Studio
          </button>
        </div>

        {step === "form" ? (
          <div className="space-y-5">
            <div>
              <label className="text-white/70 text-xs font-semibold mb-1 block">
                Tên tác phẩm
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên manga..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-xs font-semibold mb-1 block">
                  Tên tập / Chương
                </label>
                <input
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  placeholder="Chương 1: Khởi đầu..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-semibold mb-1 block">
                  Thể loại
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500 transition-colors"
                >
                  {[
                    "Action",
                    "Romance",
                    "Fantasy",
                    "Sci-Fi",
                    "Horror",
                    "Comedy",
                    "Drama",
                    "Slice of Life",
                  ].map((g) => (
                    <option key={g} className="bg-gray-900">
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-white/70 text-xs font-semibold mb-1 block">
                Mô tả nội dung tập truyện
              </label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Tóm tắt ngắn gọn nội dung tập này..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pink-500 resize-none transition-colors"
              />
            </div>

            {/* Xem nhanh các trang sẽ xuất bản */}
            <div className="bg-[#120a1f] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white text-xs font-semibold">
                  Các trang sẽ xuất bản ({pages.length} trang)
                </span>
                <span className="text-white/40 text-[10px]">
                  Bấm Xem trước để duyệt tranh hoàn chỉnh
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {pages.map((pg) => {
                  const layoutDef =
                    LAYOUTS.find((l) => l.id === pg.layoutId) || LAYOUTS[0];
                  return (
                    <div
                      key={pg.pageNumber}
                      className="flex-shrink-0 w-20 aspect-[3/4] bg-white rounded-xl border border-gray-300 relative overflow-hidden shadow-md"
                    >
                      {layoutDef.panels.map((p) => {
                        const img = pg.panels?.[p.id];
                        return (
                          <div
                            key={p.id}
                            className="absolute border border-gray-200 overflow-hidden bg-gray-50"
                            style={{
                              left: `${p.x}%`,
                              top: `${p.y}%`,
                              width: `${p.w}%`,
                              height: `${p.h}%`,
                            }}
                          >
                            {img && (
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        );
                      })}
                      <span className="absolute bottom-1 left-1 px-1 rounded bg-black/70 text-white text-[7px] font-mono">
                        P.{pg.pageNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setStep("preview")}
              disabled={!title.trim()}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-40 text-white py-3 rounded-xl font-semibold text-xs transition-all shadow-lg shadow-pink-500/20"
            >
              Xem trước toàn bộ tập truyện &amp; Xác nhận
            </button>
          </div>
        ) : (
          /* Step Preview */
          <div className="space-y-5">
            <div className="bg-[#120a1f] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-base font-bold">{title}</h3>
                  <p className="text-pink-400 text-xs font-medium">{chapterName}</p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-pink-500/20 text-pink-300 text-[10px] px-2.5 py-1 rounded-lg border border-pink-500/30 font-semibold">
                    {genre}
                  </span>
                  <span className="bg-white/10 text-white/70 text-[10px] px-2.5 py-1 rounded-lg">
                    {pages.length} trang
                  </span>
                </div>
              </div>
              {desc && <p className="text-white/60 text-xs leading-relaxed">{desc}</p>}
            </div>

            {/* Preview toàn bộ trang vẽ */}
            <div className="space-y-3">
              <h4 className="text-white/70 text-xs font-semibold">
                Duyệt các trang truyện trước khi xuất bản:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {pages.map((pg) => {
                  const layoutDef =
                    LAYOUTS.find((l) => l.id === pg.layoutId) || LAYOUTS[0];
                  return (
                    <div
                      key={pg.pageNumber}
                      className="aspect-[3/4] bg-white rounded-2xl border-2 border-gray-300 overflow-hidden relative shadow-xl"
                    >
                      {layoutDef.panels.map((p) => {
                        const img = pg.panels?.[p.id];
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
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[8px] text-gray-400 font-mono">
                                Khung {p.id}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[8px] font-mono">
                        Trang {pg.pageNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep("form")}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-xs font-medium transition-colors"
              >
                Chỉnh sửa thông tin
              </button>
              <button
                onClick={() => {
                  onPublish(project.id);
                  setStep("done");
                }}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white py-3 rounded-xl font-semibold text-xs transition-all shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2"
              >
                <Send size={14} /> Xuất bản tác phẩm ngay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
