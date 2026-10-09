"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Check,
  Calendar,
  Layers,
  Sparkles,
  X,
  Search,
} from "lucide-react";
import type { MangaProject } from "../hooks/useMangaProjects";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projects: MangaProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onCreateProject: (title: string, genre: string, description: string) => void;
  onDeleteProject: (id: string) => void;
}

const GENRES = [
  "Action",
  "Romance",
  "Fantasy",
  "Sci-Fi",
  "Comedy",
  "Horror",
  "Drama",
  "Slice of Life",
];

export function ProjectManagerModal({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
}: Props) {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [search, setSearch] = useState("");
  // Form tạo mới
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Action");
  const [desc, setDesc] = useState("");

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreateProject(title, genre, desc);
    setTitle("");
    setDesc("");
    setTab("list");
    onClose();
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.genre.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#120a1f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header modal */}
        <div className="p-4 px-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <BookOpen size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Quản lý Dự án Manga</h3>
              <p className="text-white/40 text-[10px]">
                Chọn dự án đã có để tiếp tục vẽ hoặc khởi tạo tác phẩm mới
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/5 px-6 gap-4 bg-[#0d0716]">
          <button
            onClick={() => setTab("list")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === "list"
                ? "text-pink-400 border-pink-500"
                : "text-white/40 border-transparent hover:text-white/70"
            }`}
          >
            <Layers size={13} />
            <span>Tất cả dự án ({projects.length})</span>
          </button>
          <button
            onClick={() => setTab("create")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              tab === "create"
                ? "text-pink-400 border-pink-500"
                : "text-white/40 border-transparent hover:text-white/70"
            }`}
          >
            <Plus size={13} />
            <span>Tạo dự án mới</span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === "list" ? (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm dự án theo tên truyện hoặc thể loại..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pink-500/50 transition-colors"
                />
              </div>

              {/* Projects Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProjects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onSelectProject(p.id);
                        onClose();
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                        isActive
                          ? "bg-purple-500/15 border-purple-500/50 shadow-lg ring-1 ring-purple-500/40"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            {p.genre}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full ${
                              p.status === "published"
                                ? "bg-green-500/20 text-green-300"
                                : "bg-white/10 text-white/50"
                            }`}
                          >
                            {p.status === "published" ? "Đã xuất bản" : "Bản thảo"}
                          </span>
                        </div>
                        <h4 className="text-white font-bold text-sm mb-1 group-hover:text-pink-300 transition-colors">
                          {p.title}
                        </h4>
                        <p className="text-white/40 text-[10px] line-clamp-2 leading-relaxed mb-3">
                          {p.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40">
                        <span className="flex items-center gap-1">
                          <Layers size={11} className="text-purple-400" />
                          {p.pages.length} trang
                        </span>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="flex items-center gap-0.5 text-purple-300 font-semibold">
                              <Check size={11} /> Đang mở
                            </span>
                          )}
                          {projects.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (
                                  confirm(
                                    `Bạn có chắc muốn xóa dự án "${p.title}"?`,
                                  )
                                ) {
                                  onDeleteProject(p.id);
                                }
                              }}
                              title="Xóa dự án"
                              className="text-white/20 hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredProjects.length === 0 && (
                <div className="text-center py-10 text-white/30 text-xs">
                  Không tìm thấy dự án nào phù hợp.
                </div>
              )}
            </div>
          ) : (
            /* Tab Tạo mới dự án */
            <form onSubmit={handleCreate} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="text-white/70 text-xs font-semibold mb-1 block">
                  Tên tác phẩm Manga <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đại Chiến Kiếm Sĩ, Lạc Vào Thế Giới Khác..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-white/70 text-xs font-semibold mb-1 block">
                  Thể loại chính
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`py-1.5 rounded-xl text-[10px] font-medium transition-all ${
                        genre === g
                          ? "bg-pink-500/20 text-pink-300 border border-pink-500/40"
                          : "bg-white/5 text-white/40 hover:text-white"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-white/70 text-xs font-semibold mb-1 block">
                  Mô tả nội dung / Cốt truyện ngắn
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  rows={3}
                  placeholder="Tóm tắt bối cảnh, nhân vật chính và nội dung tập truyện..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-pink-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTab("list")}
                  className="px-4 py-2 rounded-xl text-xs text-white/50 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-xs shadow-lg transition-all disabled:opacity-40"
                >
                  Khởi tạo & Bắt đầu vẽ
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
