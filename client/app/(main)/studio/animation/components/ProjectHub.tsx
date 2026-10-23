"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Box,
  Clapperboard,
  Clock,
  Film,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  ANIM_KIND_LABEL,
  createAnimProject,
  formatDuration,
  projectDurationSec,
  type AnimProject,
  type AnimProjectKind,
} from "../lib/animProject";
import {
  deleteAnimProject,
  listAnimProjects,
  listMangaProjectOptions,
  saveAnimProject,
} from "../lib/animStorage";

/**
 * Hub Animation Studio — danh sách DỰ ÁN PHIM THẬT của người dùng
 * (IndexedDB). Tạo dự án phải chọn trước 2D hoặc 3D (chốt 23/10/2026);
 * pipeline Novel → Manga → Animation chỉ là gợi ý nên dự án độc lập
 * (không nguồn manga) vẫn tạo và làm bình thường.
 */
export function ProjectHub() {
  const router = useRouter();
  const [projects, setProjects] = useState<AnimProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [mangaOptions, setMangaOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);

  const refresh = useCallback(async () => {
    setProjects(await listAnimProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    void listMangaProjectOptions().then(setMangaOptions);
  }, [refresh]);

  const handleDelete = async (p: AnimProject) => {
    if (!window.confirm(`Xoá dự án phim "${p.name}"? Hành động này không hoàn tác được.`)) {
      return;
    }
    await deleteAnimProject(p.id);
    await refresh();
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-pink-300/70">
            ANIMATION STUDIO
          </div>
          <h1 className="text-2xl font-semibold mt-1">Dự án phim của bạn</h1>
          <p className="text-sm text-white/50 mt-1 max-w-xl leading-relaxed">
            Quy trình gợi ý: Novel → Manga → Animation. Bạn có thể bắt đầu từ
            một dự án manga đã vẽ, hoặc tạo phim độc lập — không bắt buộc đi
            đủ các bước.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 h-11 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-sm font-medium hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Tạo dự án phim
        </button>
      </div>

      <Link
        href="/studio/animation/translate-edit"
        className="flex flex-wrap items-center gap-4 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/[0.06] p-5 hover:border-fuchsia-400/50 transition"
      >
        <span className="w-11 h-11 rounded-xl bg-fuchsia-500/20 grid place-items-center shrink-0">
          <Clapperboard className="w-5 h-5 text-fuchsia-300" />
        </span>
        <span className="flex-1 min-w-[220px]">
          <span className="block font-medium">Biên tập video có sẵn — dịch · phụ đề · lồng tiếng</span>
          <span className="block text-[13px] text-white/45 leading-relaxed mt-0.5">
            Có sẵn một tập phim? Tải video lên để dịch phụ đề có ngữ cảnh, sửa
            cue theo mốc thời gian, thu lồng tiếng bằng giọng của bạn và xuất
            WebM phụ đề cứng hoặc file .srt.
          </span>
        </span>
        <span className="px-4 h-10 leading-10 rounded-xl bg-fuchsia-500/25 border border-fuchsia-400/40 text-sm font-medium">
          Mở phòng biên tập
        </span>
      </Link>

      {loading ? (
        <p className="text-sm text-white/40">Đang tải dự án…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
          <Clapperboard className="w-10 h-10 mx-auto text-white/25" />
          <p className="mt-3 text-white/70 font-medium">Chưa có dự án phim nào</p>
          <p className="mt-1 text-sm text-white/40 max-w-md mx-auto leading-relaxed">
            Tạo dự án đầu tiên và chọn hình thức 2D hoặc 3D — giao diện và
            công cụ hỗ trợ sẽ đi theo lựa chọn đó.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-5 px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition"
          >
            Tạo dự án phim
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group rounded-2xl border border-white/10 bg-[#0d0817] p-4 hover:border-pink-400/40 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${
                    p.kind === "2d"
                      ? "bg-pink-500/20 text-pink-300"
                      : "bg-sky-500/20 text-sky-300"
                  }`}
                >
                  {ANIM_KIND_LABEL[p.kind]}
                </span>
                <button
                  onClick={() => void handleDelete(p)}
                  aria-label={`Xoá dự án ${p.name}`}
                  className="text-white/30 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-base font-medium truncate">{p.name}</div>
              <div className="mt-1 text-[12px] text-white/40 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" /> {p.scenes.length} cảnh
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDuration(projectDurationSec(p))}
                </span>
                <span>{p.fps} fps</span>
              </div>
              {p.sourceMangaProjectId && (
                <div className="mt-1 text-[11px] text-white/35 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Từ dự án manga của bạn
                </div>
              )}
              <button
                onClick={() => router.push(`/studio/animation/project/${p.id}`)}
                className="mt-4 w-full h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-pink-500/20 hover:border-pink-400/40 transition"
              >
                Mở workspace
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          mangaOptions={mangaOptions}
          onClose={() => setShowCreate(false)}
          onCreated={async (project) => {
            await saveAnimProject(project);
            setShowCreate(false);
            router.push(`/studio/animation/project/${project.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateProjectDialog({
  mangaOptions,
  onClose,
  onCreated,
}: {
  mangaOptions: Array<{ id: string; title: string }>;
  onClose: () => void;
  onCreated: (p: AnimProject) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AnimProjectKind>("2d");
  const [fps, setFps] = useState<12 | 24>(24);
  const [sourceId, setSourceId] = useState<string>("");

  const kindCard = (
    value: AnimProjectKind,
    icon: React.ReactNode,
    title: string,
    desc: string,
  ) => (
    <button
      onClick={() => setKind(value)}
      className={`flex-1 text-left rounded-2xl border p-4 transition ${
        kind === value
          ? "border-pink-400/60 bg-pink-500/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/25"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon} {title}
      </div>
      <p className="mt-1 text-[12px] text-white/45 leading-relaxed">{desc}</p>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#120a1f] border border-white/10 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-300" /> Tạo dự án phim
          </h2>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="text-white/40 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="block">
          <span className="text-xs text-white/50">Tên dự án</span>
          <input
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="VD: Chuyến tàu cuối — bản hoạt hình"
            className="mt-1 w-full h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm outline-none focus:border-pink-400/60"
          />
        </label>

        <div>
          <div className="text-xs text-white/50 mb-2">
            Chọn hình thức ngay từ đầu — giao diện và công cụ sẽ theo lựa chọn này
          </div>
          <div className="flex gap-3">
            {kindCard(
              "2d",
              <Film className="w-4 h-4 text-pink-300" />,
              "Phim 2D",
              "Timeline keyframe, camera 2D, thư viện chuyển động, nạp panel từ Manga Studio.",
            )}
            {kindCard(
              "3d",
              <Box className="w-4 h-4 text-sky-300" />,
              "Phim 3D",
              "Dựng cảnh 3D xem trước, đặt nhân vật và đạo cụ, di chuyển camera theo mốc thời gian, xuất đoạn phim.",
            )}
          </div>
        </div>

        {kind === "2d" && mangaOptions.length > 0 && (
          <label className="block">
            <span className="text-xs text-white/50">
              Nguồn manga (tuỳ chọn — quy trình gợi ý, bỏ trống vẫn làm được)
            </span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.currentTarget.value)}
              className="mt-1 w-full h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm outline-none"
            >
              <option value="">Không gắn nguồn — dự án độc lập</option>
              {mangaOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-xs text-white/50">Tốc độ khung hình</span>
          <select
            value={fps}
            onChange={(e) => setFps(Number(e.currentTarget.value) as 12 | 24)}
            className="mt-1 w-full h-11 rounded-xl bg-black/40 border border-white/10 px-3 text-sm outline-none"
          >
            <option value={24}>24 fps — chuẩn điện ảnh</option>
            <option value={12}>12 fps — kiểu anime (on 2s)</option>
          </select>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition"
          >
            Huỷ
          </button>
          <button
            onClick={() =>
              onCreated(
                createAnimProject(name, kind, {
                  fps,
                  sourceMangaProjectId:
                    kind === "2d" && sourceId ? sourceId : null,
                }),
              )
            }
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-sm font-medium hover:opacity-90 transition"
          >
            Tạo và mở dự án
          </button>
        </div>
      </div>
    </div>
  );
}
