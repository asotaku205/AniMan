"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { TimelineEditor } from "./TimelineEditor";
import { PrevizEditor } from "./PrevizEditor";
import { ExportPanel } from "./ExportPanel";
import { AssetLibrary } from "./AssetLibrary";
import {
  sceneDraftToAnimScene,
  suggestScenesFromText,
  type SceneDraft,
} from "../lib/sceneSuggest";
import { loadMangaPanels } from "../lib/mangaImport";
import { buildDialogueTrack } from "../lib/dialogue";
import { createSceneLayer } from "../lib/timeline";
import { CAMERA_PRESETS } from "../lib/motionPresets";

/**
 * Workspace dự án phim — Slice 1: khung workspace + **bảng phân cảnh**
 * (thêm/đổi tên/thời lượng/ghi chú/sắp xếp/nhân đôi/xoá cảnh), lưu thật
 * vào IndexedDB. Các slice sau gắn tiếp: animatic phát thử, timeline
 * keyframe (2D), previz (3D) và xuất bản — đều trên cùng dữ liệu cảnh này.
 */
export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<AnimProject | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

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

  const [saveError, setSaveError] = useState<string | null>(null);
  const apply = useCallback(async (next: AnimProject) => {
    setProject(next);
    try {
      await saveAnimProject(next);
      setSaveError(null);
    } catch (err) {
      // Lỗi lưu phải HIỂN THỊ — không nuốt âm thầm (bài học F5 mất dữ liệu).
      setSaveError(
        err instanceof Error ? err.message : "Không lưu được dự án.",
      );
    }
  }, []);

  const [importing, setImporting] = useState(false);
  const [showNovelSuggest, setShowNovelSuggest] = useState(false);
  const [novelText, setNovelText] = useState("");
  const [novelDrafts, setNovelDrafts] = useState<SceneDraft[] | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<"scenes" | "assets">("scenes");
  const previewRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  /** Pipeline gợi ý Manga → Animation: panel đã vẽ → cảnh + thoại. */
  const importFromManga = async () => {
    if (!project?.sourceMangaProjectId) return;
    setImporting(true);
    setImportNote(null);
    const panels = await loadMangaPanels(project.sourceMangaProjectId);
    setImporting(false);
    if (panels.length === 0) {
      setImportNote(
        "Chưa nạp được panel nào — hãy chắc chắn dự án manga nguồn đã có trang vẽ trong Manga Studio.",
      );
      return;
    }
    const kenBurns = CAMERA_PRESETS.find((p) => p.id === "ken-burns-in")!;
    const newScenes = panels.map((panel, i) => {
      const { lines, suggestedSceneDurationSec } = buildDialogueTrack(panel.texts);
      const layer = createSceneLayer(`Panel ${panel.page}.${i + 1}`, "#241a3f");
      layer.imageDataUrl = panel.imageDataUrl;
      return {
        id: `scene-${Date.now().toString(36)}-${i}`,
        name: `Trang ${panel.page} · Khung ${i + 1}`,
        durationSec: suggestedSceneDurationSec,
        source: {
          mangaProjectId: project.sourceMangaProjectId!,
          page: panel.page,
          panelId: panel.panelId,
        },
        note: "",
        timeline: {
          layers: [layer],
          cameraKeys: kenBurns.build(suggestedSceneDurationSec),
        },
        dialogue: lines,
      };
    });
    await apply({
      ...project,
      scenes: [...project.scenes, ...newScenes],
      updatedAt: Date.now(),
    });
    setImportNote(
      `Đã nạp ${newScenes.length} cảnh từ manga (mỗi khung tranh một cảnh, camera phóng thu mặc định, thoại trích từ chữ trong khung).`,
    );
  };

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
    <div className="space-y-4">
      {/* Thanh công cụ cố định (bố cục R1) */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0d0817] px-4 py-3">
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
          className="flex-1 min-w-[160px] bg-transparent text-lg font-semibold outline-none border-b border-transparent focus:border-pink-400/50"
        />
        <span className="text-[12px] text-white/40">
          {project.scenes.length} cảnh · {formatDuration(projectDurationSec(project))} ·{" "}
          {project.fps} fps · {project.width}×{project.height}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              previewRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition"
          >
            Phát thử toàn phim
          </button>
          <button
            onClick={() =>
              exportRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-3 h-9 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 text-[13px] font-medium hover:opacity-90 transition"
          >
            Xuất bản
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          ⚠ Lỗi lưu dữ liệu: {saveError} Thay đổi mới nhất có thể chưa được
          lưu — hãy tải lại trang và thử lại.
        </div>
      )}

      {/* Khung làm việc R1: cột trái Cảnh/Tài sản + editor — mọi thao tác
          dựng phim nằm gọn trong một màn hình, không cuộn trang */}
      {(() => {
        const sc =
          project.scenes.find((x) => x.id === selectedSceneId) ??
          project.scenes[0] ??
          null;
        return (
          <div className="rounded-2xl border border-white/10 bg-[#0a0614] overflow-hidden flex h-[calc(100dvh-130px)] min-h-[620px]">
            <aside className="w-[248px] flex-none border-r border-white/10 flex flex-col min-h-0">
              <div className="flex gap-1 p-2 pb-0">
                {(
                  [
                    { id: "scenes", label: `Cảnh (${project.scenes.length})` },
                    { id: "assets", label: "Tài sản" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setRailTab(t.id)}
                    className={`flex-1 h-8 rounded-lg text-[12px] transition ${
                      railTab === t.id
                        ? "bg-white/10 text-white font-medium"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2">
                {railTab === "assets" ? (
                  sc ? (
                    <AssetLibrary
                      project={project}
                      scene={sc}
                      onUpdateScene={(patch) =>
                        void apply(updateScene(project, sc.id, patch))
                      }
                    />
                  ) : (
                    <p className="text-[12px] text-white/40 leading-relaxed">
                      Thêm một cảnh trước — thư viện tài sản gắn với cảnh đang
                      chọn.
                    </p>
                  )
                ) : (
                  <>
                    {project.scenes.map((scene, idx) => (
                      <button
                        key={scene.id}
                        onClick={() => setSelectedSceneId(scene.id)}
                        className={`w-full flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${
                          sc?.id === scene.id
                            ? "border-pink-400/50 bg-pink-500/10"
                            : "border-white/10 bg-black/30 hover:bg-white/5"
                        }`}
                      >
                        <span className="w-7 h-7 flex-none rounded-lg bg-pink-500/15 text-pink-300 grid place-items-center text-[12px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] truncate">
                            {scene.name}
                          </span>
                          <span className="block text-[11px] text-white/40">
                            {scene.durationSec.toFixed(1)}s
                            {project.kind === "2d"
                              ? ` · ${(scene.timeline?.layers ?? []).length} layer`
                              : ` · ${(scene.previz?.objects ?? []).length} vật thể`}
                            {` · ${(scene.dialogue ?? []).length} thoại`}
                          </span>
                        </span>
                      </button>
                    ))}
                    {project.scenes.length === 0 && (
                      <p className="text-[12px] text-white/40 leading-relaxed">
                        Chưa có cảnh nào.
                      </p>
                    )}
                    <button
                      onClick={() => void apply(addScene(project))}
                      className="w-full h-9 rounded-xl bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm cảnh
                    </button>
                    <button
                      onClick={() => setShowNovelSuggest(true)}
                      className="w-full h-9 rounded-xl bg-violet-500/15 border border-violet-400/30 text-[13px] hover:bg-violet-500/25 transition"
                    >
                      Gợi ý phân cảnh từ novel
                    </button>
                    {project.kind === "2d" && project.sourceMangaProjectId && (
                      <button
                        onClick={() => void importFromManga()}
                        disabled={importing}
                        className="w-full h-9 rounded-xl bg-pink-500/15 border border-pink-400/30 text-[13px] hover:bg-pink-500/25 transition disabled:opacity-50"
                      >
                        {importing
                          ? "Đang nạp…"
                          : "Nạp panel + thoại từ manga"}
                      </button>
                    )}
                    {importNote && (
                      <p className="text-[11px] text-pink-200/80 leading-relaxed">
                        {importNote}
                      </p>
                    )}
                    <p className="text-[11px] text-white/30 leading-relaxed pt-1">
                      Đổi tên, thời lượng, ghi chú và thứ tự cảnh ở Bảng phân
                      cảnh đầy đủ phía dưới.
                    </p>
                  </>
                )}
              </div>
            </aside>
            <div className="flex-1 min-w-0 min-h-0">
              {sc ? (
                project.kind === "2d" ? (
                  <TimelineEditor
                    key={sc.id}
                    scene={sc}
                    onChange={(timeline) =>
                      void apply(updateScene(project, sc.id, { timeline }))
                    }
                    onDialogueChange={(dialogue) =>
                      void apply(updateScene(project, sc.id, { dialogue }))
                    }
                    onWeatherChange={(weather) =>
                      void apply(updateScene(project, sc.id, { weather }))
                    }
                  />
                ) : (
                  <PrevizEditor
                    key={sc.id}
                    scene={sc}
                    onChange={(previz) =>
                      void apply(updateScene(project, sc.id, { previz }))
                    }
                    onDialogueChange={(dialogue) =>
                      void apply(updateScene(project, sc.id, { dialogue }))
                    }
                    onWeatherChange={(weather) =>
                      void apply(updateScene(project, sc.id, { weather }))
                    }
                  />
                )
              ) : (
                <div className="h-full grid place-items-center p-8">
                  <p className="text-sm text-white/40 text-center leading-relaxed">
                    Chưa có cảnh nào — bấm "Thêm cảnh" ở cột trái để bắt đầu
                    dựng phim.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Phát thử toàn phim — xem lại nhịp + tiếng + phụ đề đồng bộ */}
      <div ref={previewRef} className="scroll-mt-4">
        <AnimaticPlayer project={project} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide text-white/80">
            BẢNG PHÂN CẢNH
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNovelSuggest(true)}
              className="px-3 h-9 rounded-lg bg-violet-500/20 border border-violet-400/35 text-[13px] hover:bg-violet-500/30 transition"
            >
              Gợi ý phân cảnh từ novel
            </button>
            <button
              onClick={() => void apply(addScene(project))}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[13px] hover:bg-white/10 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm cảnh
            </button>
          </div>
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
            : "Bước tiếp theo trên chính bảng cảnh này: dựng cảnh 3D xem trước cho từng cảnh (nhân vật, phong cảnh, camera theo mốc thời gian) rồi xuất đoạn phim."}
        </p>
      </div>

      {showNovelSuggest && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#120a1f] border border-white/10 p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold">Gợi ý phân cảnh từ đoạn novel</h3>
              <p className="text-[12px] text-white/45 leading-relaxed mt-1">
                Dán một đoạn truyện — công cụ tách theo đoạn văn, trích thoại
                trong ngoặc kép và ước lượng thời lượng. Đây là bản NHÁP cơ
                học (không tốn lượt AI); bạn sửa lại ở bảng phân cảnh sau.
              </p>
            </div>
            <textarea
              value={novelText}
              onChange={(e) => setNovelText(e.currentTarget.value)}
              rows={8}
              placeholder="Dán đoạn novel vào đây…"
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-400/50 placeholder:text-white/25"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNovelDrafts(suggestScenesFromText(novelText))}
                disabled={!novelText.trim()}
                className="px-4 h-10 rounded-xl bg-violet-500/30 border border-violet-400/40 text-sm font-medium hover:bg-violet-500/40 disabled:opacity-40"
              >
                Phân tích đoạn văn
              </button>
              <button
                onClick={() => {
                  setShowNovelSuggest(false);
                  setNovelDrafts(null);
                }}
                className="px-4 h-10 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10"
              >
                Đóng
              </button>
            </div>
            {novelDrafts && (
              <div className="space-y-2">
                {novelDrafts.length === 0 ? (
                  <p className="text-sm text-white/40">Chưa tách được cảnh nào từ đoạn văn này.</p>
                ) : (
                  <>
                    {novelDrafts.map((d, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-[13px] font-medium">
                          {d.name}
                          <span className="text-white/35 font-normal">
                            {" "}· {d.durationSec.toFixed(1)}s · {d.dialogueTexts.length} câu thoại
                          </span>
                        </div>
                        <p className="text-[12px] text-white/45 leading-relaxed mt-1 line-clamp-2">
                          {d.note}
                        </p>
                      </div>
                    ))}
                    <button
                      onClick={async () => {
                        const stamp = Date.now().toString(36);
                        const scenes = novelDrafts.map((d, i) =>
                          sceneDraftToAnimScene(d, `${stamp}-${i}`),
                        );
                        await apply({
                          ...project,
                          scenes: [...project.scenes, ...scenes],
                          updatedAt: Date.now(),
                        });
                        setShowNovelSuggest(false);
                        setNovelDrafts(null);
                        setNovelText("");
                      }}
                      className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-400 text-sm font-medium hover:opacity-90"
                    >
                      Thêm {novelDrafts.length} cảnh nháp vào dự án
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={exportRef} className="scroll-mt-4">
        <ExportPanel
          project={project}
          onProjectChange={(p) => void apply(p)}
        />
      </div>
    </div>
  );
}
