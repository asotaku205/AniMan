"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addScene,
  ANIM_KIND_LABEL,
  duplicateScene,
  formatDuration,
  moveScene,
  projectDurationSec,
  removeScene,
  updateScene,
  type AnimProject,
} from "../lib/animProject";
import { getAnimProject, saveAnimProject } from "../lib/animStorage";
import { AnimaticPlayer } from "./AnimaticPlayer";

/**
 * Workspace dự án phim — Slice 1: khung workspace + **bảng phân cảnh**
 * (thêm/đổi tên/thời lượng/ghi chú/sắp xếp/nhân đôi/xoá cảnh), lưu thật
 * vào IndexedDB. Các slice sau gắn tiếp: animatic phát thử, timeline
 * keyframe (2D), previz (3D) và xuất bản — đều trên cùng dữ liệu cảnh này.
 */
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<AnimProject | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAnimProject(projectId).then((p) => {
      if (cancelled) return;
      if (p) setProject(p);
      else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const apply = useCallback(
    async (next: AnimProject) => {
      setProject(next);
      await saveAnimProject(next);
    },
    [],
  );

  if (missing) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-10 text-center">
        <p className="text-white/70 font-medium">Không tìm thấy dự án phim này</p>
        <p className="text-sm text-white/40 mt-1">
          Dự án có thể đã bị xoá, hoặc bạn đang ở một trình duyệt khác.
        </p>
        <Link
          href="/studio/animation"
          className="inline-block mt-5 px-4 h-10 leading-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition"
        >
          Về danh sách dự án
        </Link>
      </div>
    );
  }
  if (!project) {
    return <p className="text-sm text-white/40">Đang tải dự án…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/studio/animation"
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Dự án phim
        </Link>
        <span
          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${
            project.kind === "2d"
              ? "bg-pink-500/20 text-pink-300"
              : "bg-sky-500/20 text-sky-300"
          }`}
        >
          {ANIM_KIND_LABEL[project.kind]}
        </span>
        <span className="text-[12px] text-white/40">
          {project.scenes.length} cảnh · {formatDuration(projectDurationSec(project))} ·{" "}
          {project.fps} fps · {project.width}×{project.height}
        </span>
      </div>

      <input
        value={project.name}
        onChange={(e) =>
          setProject({ ...project, name: e.currentTarget.value })
        }
        onBlur={(e) => {
          const name = e.currentTarget.value.trim();
          if (name && name !== project.name) {
            void apply({ ...project, name, updatedAt: Date.now() });
          }
        }}
        aria-label="Tên dự án"
        className="w-full bg-transparent text-2xl font-semibold outline-none border-b border-transparent focus:border-pink-400/50 pb-1"
      />

      <AnimaticPlayer scenes={project.scenes} />

      <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-white/80">
            BẢNG PHÂN CẢNH
          </h2>
          <button
            onClick={() => void apply(addScene(project))}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm cảnh
          </button>
        </div>
        <div className="space-y-2">
          {project.scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <span className="w-8 h-8 rounded-lg bg-pink-500/15 text-pink-300 grid place-items-center text-[13px] font-bold">
                {idx + 1}
              </span>
              <input
                value={scene.name}
                onChange={(e) =>
                  void apply(
                    updateScene(project, scene.id, {
                      name: e.currentTarget.value,
                    }),
                  )
                }
                aria-label="Tên cảnh"
                className="flex-1 min-w-[140px] bg-transparent text-sm outline-none border-b border-transparent focus:border-white/30"
              />
              <label className="flex items-center gap-1.5 text-[12px] text-white/45">
                Thời lượng
                <input
                  type="number"
                  min={0.5}
                  max={120}
                  step={0.5}
                  value={scene.durationSec}
                  onChange={(e) =>
                    void apply(
                      updateScene(project, scene.id, {
                        durationSec: Number(e.currentTarget.value),
                      }),
                    )
                  }
                  className="w-16 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-sm text-white outline-none"
                />
                giây
              </label>
              <input
                value={scene.note ?? ""}
                onChange={(e) =>
                  void apply(
                    updateScene(project, scene.id, {
                      note: e.currentTarget.value,
                    }),
                  )
                }
                placeholder="Ghi chú cảnh (nội dung, thoại chính…)"
                aria-label="Ghi chú cảnh"
                className="flex-1 min-w-[160px] bg-transparent text-[13px] text-white/60 outline-none border-b border-transparent focus:border-white/30 placeholder:text-white/25"
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => void apply(moveScene(project, scene.id, -1))}
                  disabled={idx === 0}
                  aria-label="Dời cảnh lên"
                  className="p-1.5 text-white/40 hover:text-white disabled:opacity-25 transition"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void apply(moveScene(project, scene.id, 1))}
                  disabled={idx === project.scenes.length - 1}
                  aria-label="Dời cảnh xuống"
                  className="p-1.5 text-white/40 hover:text-white disabled:opacity-25 transition"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void apply(duplicateScene(project, scene.id))}
                  aria-label="Nhân đôi cảnh"
                  className="p-1.5 text-white/40 hover:text-white transition"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => void apply(removeScene(project, scene.id))}
                  aria-label="Xoá cảnh"
                  className="p-1.5 text-white/40 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {project.scenes.length === 0 && (
            <p className="text-sm text-white/35 py-4 text-center">
              Chưa có cảnh nào — bấm "Thêm cảnh" để bắt đầu phân cảnh.
            </p>
          )}
        </div>
        <p className="mt-3 text-[12px] text-white/35 leading-relaxed">
          {project.kind === "2d"
            ? "Bước tiếp theo trên chính bảng cảnh này: phát thử animatic để chốt nhịp, rồi mở timeline keyframe cho từng cảnh."
            : "Bước tiếp theo trên chính bảng cảnh này: dựng previz 3D cho từng cảnh (nhân vật, phong cảnh, camera theo mốc thời gian) rồi xuất đoạn phim."}
        </p>
      </div>
    </div>
  );
}
