"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Brush,
  LayoutGrid,
  Send,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  AlertTriangle,
  FolderOpen,
  Flame,
  X,
} from "lucide-react";
import type { MangaProject } from "../hooks/useMangaProjects";
import {
  parseMangaSample,
  type MangaSample,
} from "../lib/sampleLoader";

interface ProjectsViewProps {
  projects: MangaProject[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onOpenDraw: (id: string) => void;
  onOpenStoryBoard: (id: string) => void;
  onOpenPublish: (id: string) => void;
  onCreateProject: (title: string, genre: string, description: string) => MangaProject;
  onImportSampleProject: (sample: MangaSample) => Promise<MangaProject>;
  onDeleteProject: (id: string) => void;
}

const GENRES = [
  "Tất cả",
  "Action",
  "Romance",
  "Fantasy",
  "Sci-Fi",
  "Comedy",
  "Horror",
  "Drama",
  "Slice of Life",
];

export function ProjectsView({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenDraw,
  onOpenStoryBoard,
  onOpenPublish,
  onCreateProject,
  onImportSampleProject,
  onDeleteProject,
}: ProjectsViewProps) {
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [sortBy, setSortBy] = useState<"updated" | "pages" | "title">("updated");

  // Modal tạo dự án mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newGenre, setNewGenre] = useState("Action");
  const [newDesc, setNewDesc] = useState("");

  // Modal xác nhận xóa
  const [projectToDelete, setProjectToDelete] = useState<MangaProject | null>(null);

  // Hộp thoại mở dự án mẫu (tải file mẫu khi mở để hiện số liệu thật)
  const [sampleOpen, setSampleOpen] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<MangaSample | null>(null);
  const sampleStats = useMemo(() => {
    if (!sampleData) return null;
    let pages = 0;
    let lines = 0;
    let unattributed = 0;
    for (const ch of sampleData.chapters) {
      pages += ch.pages.length;
      for (const pg of ch.pages) {
        for (const pn of pg.panels) {
          for (const ln of pn.lines) {
            lines += 1;
            if ((ln.kind === "spoken" || ln.kind === "inner") && !ln.speaker) {
              unattributed += 1;
            }
          }
        }
      }
    }
    return { pages, lines, unattributed };
  }, [sampleData]);

  const openSampleDialog = async () => {
    setSampleOpen(true);
    setSampleBusy(true);
    setSampleError(null);
    setSampleData(null);
    try {
      const res = await fetch("/samples/thu-gui-thanh-pho-tren-may-manga.json");
      if (!res.ok) throw new Error("Không tải được file dự án mẫu.");
      setSampleData(parseMangaSample(await res.json()));
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : "Không mở được dự án mẫu.",
      );
    } finally {
      setSampleBusy(false);
    }
  };

  const confirmSample = async () => {
    if (!sampleData) return;
    setSampleBusy(true);
    setSampleError(null);
    try {
      const created = await onImportSampleProject(sampleData);
      setSampleOpen(false);
      onOpenDraw(created.id);
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : "Không mở được dự án mẫu.",
      );
    } finally {
      setSampleBusy(false);
    }
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = projects.length;
    const drafts = projects.filter((p) => p.status === "draft").length;
    const published = projects.filter((p) => p.status === "published").length;
    const totalPages = projects.reduce((acc, p) => acc + (p.pages?.length || 0), 0);
    return { total, drafts, published, totalPages };
  }, [projects]);

  // Lọc và sắp xếp
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchSearch =
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()) ||
          p.genre.toLowerCase().includes(search.toLowerCase());
        const matchGenre = selectedGenre === "Tất cả" || p.genre.toLowerCase() === selectedGenre.toLowerCase();
        const matchStatus = statusFilter === "all" || p.status === statusFilter;
        return matchSearch && matchGenre && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === "updated") return (b.updatedAt || 0) - (a.updatedAt || 0);
        if (sortBy === "pages") return (b.pages?.length || 0) - (a.pages?.length || 0);
        if (sortBy === "title") return a.title.localeCompare(b.title);
        return 0;
      });
  }, [projects, search, selectedGenre, statusFilter, sortBy]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created = onCreateProject(newTitle, newGenre, newDesc);
    setIsCreateOpen(false);
    setNewTitle("");
    setNewDesc("");
    // Mở vào studio vẽ ngay
    onOpenDraw(created.id);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Mới tạo";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Vừa cập nhật";
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0612] text-white">
      {/* Banner Tiêu đề & Thống kê */}
      <div className="relative border-b border-white/10 bg-gradient-to-b from-purple-950/30 via-[#120a1f] to-[#0b0612] px-6 lg:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-xs font-semibold">
                <FolderOpen size={13} />
                Quản lý Tác phẩm
              </span>
              <span className="text-white/40 text-xs">Manga Creative Studio</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Quản lý Dự án Manga
            </h1>
            <p className="text-white/60 text-xs lg:text-sm mt-1 max-w-2xl leading-relaxed">
              Không gian sáng tác tập trung. Chọn dự án để tiếp tục vẽ, tinh chỉnh kịch bản
              Story Board hoặc tiến hành xuất bản bản thảo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus size={16} />
              Tạo Dự án Mới
            </button>
            <button
              onClick={() => void openSampleDialog()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm transition-all"
            >
              <BookOpen size={16} />
              Mở dự án mẫu
            </button>
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 mt-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider">Tổng số dự án</p>
              <p className="text-xl font-bold text-white mt-0.5">{stats.total}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <Brush size={18} />
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider">Bản thảo đang vẽ</p>
              <p className="text-xl font-bold text-amber-300 mt-0.5">{stats.drafts}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider">Đã xuất bản</p>
              <p className="text-xl font-bold text-emerald-300 mt-0.5">{stats.published}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-300 flex items-center justify-center">
              <Layers size={18} />
            </div>
            <div>
              <p className="text-white/40 text-[11px] font-medium uppercase tracking-wider">Tổng số trang vẽ</p>
              <p className="text-xl font-bold text-pink-300 mt-0.5">{stats.totalPages}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bộ lọc, Tìm kiếm và Sắp xếp */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên truyện, thể loại, từ khóa..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-500/60 focus:bg-white/10 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Bộ lọc trạng thái & Sắp xếp */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lọc trạng thái */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "all"
                    ? "bg-purple-500/40 text-white font-semibold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Tất cả ({projects.length})
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "draft"
                    ? "bg-amber-500/40 text-amber-200 font-semibold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Bản thảo ({stats.drafts})
              </button>
              <button
                onClick={() => setStatusFilter("published")}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === "published"
                    ? "bg-emerald-500/40 text-emerald-200 font-semibold"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Đã xuất bản ({stats.published})
              </button>
            </div>

            {/* Sắp xếp */}
            <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white/60">
              <Filter size={13} className="text-white/40" />
              <span>Xếp theo:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="updated" className="bg-[#1a0e2e]">Mới cập nhật</option>
                <option value="pages" className="bg-[#1a0e2e]">Số lượng trang</option>
                <option value="title" className="bg-[#1a0e2e]">Tên A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Thanh chọn Thể loại */}
        <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-none">
          <span className="text-[11px] text-white/40 font-medium whitespace-nowrap mr-1">
            Thể loại:
          </span>
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                selectedGenre === g
                  ? "bg-pink-500 text-white font-semibold shadow-md shadow-pink-500/20"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Danh sách Dự án (Grid Cards) */}
        {filteredProjects.length === 0 ? (
          <div className="mt-12 text-center py-16 px-4 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
            <div className="w-16 h-16 rounded-3xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={30} />
            </div>
            <h3 className="text-white font-bold text-base">Không tìm thấy dự án nào</h3>
            <p className="text-white/50 text-xs mt-1 max-w-sm mx-auto">
              Không có dự án phù hợp với bộ lọc hiện tại. Thử thay đổi từ khóa hoặc khởi tạo dự án mới!
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold shadow-lg shadow-pink-500/20 transition-all"
            >
              <Plus size={14} />
              Khởi tạo Dự án Đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
            {filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isPublished = project.status === "published";

              // Lấy panel đầu tiên có ảnh để làm thumbnail xem trước
              let sampleThumbnail: string | null = null;
              if (project.pages && project.pages.length > 0) {
                for (const pg of project.pages) {
                  const keys = Object.keys(pg.panels || {});
                  if (keys.length > 0 && pg.panels[keys[0]]) {
                    sampleThumbnail = pg.panels[keys[0]];
                    break;
                  }
                }
              }

              return (
                <div
                  key={project.id}
                  className={`group relative flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden bg-gradient-to-b from-[#140b24] to-[#0e071a] ${
                    isActive
                      ? "border-pink-500/60 shadow-xl shadow-pink-500/10 ring-1 ring-pink-500/30"
                      : "border-white/10 hover:border-pink-500/30 hover:shadow-xl hover:shadow-purple-900/20"
                  }`}
                >
                  {/* Top Cover / Thumbnail Header */}
                  <div className="relative h-40 bg-gradient-to-br from-purple-900/40 via-pink-900/20 to-black overflow-hidden flex items-center justify-center border-b border-white/5">
                    {sampleThumbnail ? (
                      <img
                        src={sampleThumbnail}
                        alt={project.title}
                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-white/30 gap-2">
                        <BookOpen size={36} className="text-purple-400/40 group-hover:text-pink-400/60 transition-colors" />
                        <span className="text-[11px] font-mono text-white/40">Bản phác thảo manga</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140b24] via-transparent to-black/40 pointer-events-none" />

                    {/* Badges trên Cover */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md border border-white/10 text-white/80">
                        {project.genre}
                      </span>
                      {isActive && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white shadow-md shadow-pink-500/40 flex items-center gap-1">
                          <Flame size={10} />
                          Đang vẽ
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      {isPublished ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 backdrop-blur-md">
                          <CheckCircle2 size={10} />
                          Đã xuất bản
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 backdrop-blur-md">
                          <Clock size={10} />
                          Bản thảo
                        </span>
                      )}
                    </div>

                    {/* Thông tin số trang đè lên góc dưới cover */}
                    <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-white/70 text-[11px]">
                      <Layers size={12} className="text-pink-400" />
                      <span>{project.pages?.length || 0} trang vẽ</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-white text-base group-hover:text-pink-300 transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project);
                          }}
                          title="Xóa dự án này"
                          className="text-white/30 hover:text-red-400 p-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <p className="text-white/50 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                        {project.description || "Chưa có mô tả kịch bản..."}
                      </p>
                    </div>

                    {/* Footer Metadata & Time */}
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Cập nhật: {formatDate(project.updatedAt)}
                      </span>
                    </div>

                    {/* Action Pipeline Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2">
                      {/* Nút Vẽ trang */}
                      <button
                        onClick={() => {
                          onSelectProject(project.id);
                          onOpenDraw(project.id);
                        }}
                        title="Mở bảng vẽ manga"
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-200 hover:text-white border border-pink-500/30 text-xs font-semibold transition-all group/btn shadow-sm"
                      >
                        <Brush size={12} className="group-hover/btn:scale-110 transition-transform" />
                        <span>Vào vẽ</span>
                      </button>

                      {/* Nút Story Board */}
                      <button
                        onClick={() => {
                          onSelectProject(project.id);
                          onOpenStoryBoard(project.id);
                        }}
                        title="Xem toàn bộ mạch truyện Story Board"
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/30 text-purple-200 border border-purple-500/25 text-xs font-semibold transition-all"
                      >
                        <LayoutGrid size={12} />
                        <span>Storyboard</span>
                      </button>

                      {/* Nút Xuất bản */}
                      <button
                        onClick={() => {
                          onSelectProject(project.id);
                          onOpenPublish(project.id);
                        }}
                        title="Xuất bản hoặc xuất bản thảo"
                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition-all"
                      >
                        <Send size={12} />
                        <span>Xuất bản</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Khởi tạo Dự án Mới */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#140b24] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-5 right-5 text-white/40 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Khởi tạo Dự án Manga Mới</h3>
                <p className="text-white/50 text-xs">Điền thông tin ban đầu để bắt đầu bản vẽ đầu tiên</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Tên Tác Phẩm / Dự Án <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Chiến Binh Ánh Sáng, Cyber Ghost, Học Viện..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-500/70 focus:bg-white/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Thể Loại Manga
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.filter((g) => g !== "Tất cả").map((genre) => (
                    <button
                      type="button"
                      key={genre}
                      onClick={() => setNewGenre(genre)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        newGenre === genre
                          ? "bg-pink-500 text-white shadow-sm"
                          : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  Mô Tả / Ý Tưởng Cốt Truyện
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Tóm tắt ý tưởng, chủ đề hoặc thông điệp chính của bộ truyện tranh..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pink-500/70 focus:bg-white/10 transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-pink-500/25 transition-all"
                >
                  <Brush size={13} />
                  Tạo & Bắt Đầu Vẽ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa Dự án */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#180d2b] border border-red-500/30 rounded-3xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-white font-bold text-sm">Xác nhận xóa dự án?</h3>
            <p className="text-white/60 text-xs mt-1.5 leading-relaxed">
              Bạn có chắc chắn muốn xóa tác phẩm{" "}
              <strong className="text-white">"{projectToDelete.title}"</strong> không? Tất cả các trang vẽ và bản thảo sẽ bị xóa khỏi bộ nhớ máy.
            </p>

            <div className="flex items-center justify-center gap-2.5 mt-5">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-colors"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hộp thoại Mở dự án mẫu */}
      {sampleOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#180d2b] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-white font-bold text-sm">Mở dự án mẫu</h3>
            <p className="text-white/70 text-xs mt-2 leading-relaxed">
              <strong className="text-white">
                Thư Gửi Thành Phố Trên Mây
              </strong>
              <br />
              Bản manga mẫu đã có kịch bản: lời thoại đặt sẵn theo khung,
              tranh vẽ để trống để bạn vẽ trong panel. Mở ra một bản riêng
              để vẽ tiếp. Các dự án bạn đã có vẫn giữ nguyên.
            </p>
            {sampleStats && (
              <p className="text-white/60 text-xs mt-2 leading-relaxed">
                {sampleData?.chapters.length} chương, {sampleStats.pages}{" "}
                trang, {sampleStats.lines} dòng thoại, trong đó{" "}
                {sampleStats.unattributed} dòng chưa rõ người nói.
              </p>
            )}
            {sampleStats && sampleStats.unattributed > 0 && (
              <p className="text-white/50 text-xs mt-1 leading-relaxed">
                Dòng chưa rõ người nói sẽ hiện không kèm tên, bạn gắn tên
                khi sửa trong panel.
              </p>
            )}
            {sampleError && (
              <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {sampleError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2.5 mt-5">
              <button
                type="button"
                disabled={sampleBusy}
                onClick={() => setSampleOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Để sau
              </button>
              <button
                type="button"
                disabled={sampleBusy || !sampleData}
                onClick={() => void confirmSample()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-pink-500/25 transition-all disabled:opacity-50"
              >
                {sampleBusy && !sampleData
                  ? "Đang tải mẫu..."
                  : sampleBusy
                    ? "Đang mở..."
                    : "Mở bản mẫu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
