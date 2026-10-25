"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Paintbrush,
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
  sceneSpeed,
  sceneWallDurationSec,
  updateScene,
  type AnimProject,
  type AnimScene,
} from "../lib/animProject";
import { getAnimProject, saveAnimProject } from "../lib/animStorage";
import { AnimaticPlayer } from "./AnimaticPlayer";
import DrawStudioModal from "./DrawStudioModal";
import {
  SCENE_STATUSES,
  SHOT_TYPES,
  captureSceneThumbnail,
  projectProgress,
  sceneStatusMeta,
  sceneStatusOf,
  type SceneStatus,
} from "../lib/storyboard";
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
import {
  parseScreenplay,
  screenplayToAnimScenes,
} from "../lib/screenplay";
import { createSceneLayer } from "../lib/timeline";
import { CAMERA_PRESETS } from "../lib/motionPresets";
import { exportPresetOf, resolveExportSize } from "../lib/exportPresets";

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
  const [showScreenplay, setShowScreenplay] = useState(false);
  const [screenplayText, setScreenplayText] = useState("");
  const [novelDrafts, setNovelDrafts] = useState<SceneDraft[] | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<"scenes" | "assets">("scenes");
  const [boardDrawSceneId, setBoardDrawSceneId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  /** Pipeline gợi ý Manga → Animation: panel đã vẽ → cảnh + thoại. */
  /** Chụp khung đầu cảnh 2D làm hình phác phân cảnh (R5). */
  const captureBoard = async (target: AnimScene) => {
    if (!project) return;
    const url = await captureSceneThumbnail(target);
    if (url) {
      await apply(updateScene(project, target.id, { boardDataUrl: url }));
    }
  };

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
          <div className="rounded-2xl border border-white/10 bg-[#0a0614] overflow-hidden flex h-[calc(100dvh-76px)] min-h-[620px]">
            {!railOpen && (
              <div className="w-[42px] flex-none border-r border-white/10 flex flex-col items-center py-2 gap-3">
                <button
                  onClick={() => setRailOpen(true)}
                  title="Mở thanh công cụ (Cảnh · Tài sản)"
                  aria-label="Mở thanh công cụ"
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-[10px] tracking-wide text-white/40 [writing-mode:vertical-rl]">
                  Cảnh · Tài sản
                </span>
              </div>
            )}
            {railOpen && (
            <aside className="w-[264px] flex-none border-r border-white/10 flex flex-col min-h-0">
              <div className="flex gap-1 p-2 pb-0 items-center">
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
              <div className="px-2 pt-1.5 flex justify-end">
                <button
                  onClick={() => setRailOpen(false)}
                  title="Thu gọn thanh công cụ để khung hình rộng hơn"
                  aria-label="Thu gọn thanh công cụ"
                  className="flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[10.5px] text-white/50 hover:bg-white/10 hover:text-white transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Thu gọn
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 p-2.5 pt-1 space-y-2">
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
                        <span
                          className="w-2 h-2 flex-none rounded-full"
                          style={{
                            backgroundColor: sceneStatusMeta(
                              sceneStatusOf(scene),
                            ).color,
                          }}
                          title={`Trạng thái: ${sceneStatusMeta(sceneStatusOf(scene)).label}`}
                        />
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
                    <button
                      onClick={() => setShowScreenplay(true)}
                      className="w-full h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 text-[13px] hover:bg-sky-500/25 transition"
                    >
                      Tách kịch bản thành cảnh
                    </button>
                    {showScreenplay && (
                      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-[#120a1f] border border-white/10 p-6 space-y-4">
                          <h2 className="text-lg font-semibold">
                            Tách kịch bản thành cảnh
                          </h2>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            Dán kịch bản dạng: đầu cảnh INT./EXT., tên nhân
                            vật VIẾT HOA rồi thoại bên dưới, mô tả viết
                            thường. Dòng nào không nhận ra sẽ giữ trong ghi
                            chú của cảnh, không mất.
                          </p>
                          <textarea
                            value={screenplayText}
                            onChange={(e) => setScreenplayText(e.currentTarget.value)}
                            rows={12}
                            placeholder={"INT. LỚP HỌC - NGÀY\n\nThầy giáo bước vào lớp.\n\nLINH\nChào buổi sáng ạ!"}
                            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-sm outline-none focus:border-sky-400/60 resize-y"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowScreenplay(false)}
                              className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition"
                            >
                              Huỷ
                            </button>
                            <button
                              onClick={async () => {
                                const parsed = parseScreenplay(screenplayText);
                                const newScenes = screenplayToAnimScenes(parsed);
                                if (newScenes.length === 0) {
                                  setImportNote(
                                    "Chưa tách được cảnh nào — kiểm tra lại kịch bản.",
                                  );
                                  return;
                                }
                                await apply({
                                  ...project,
                                  scenes: [...project.scenes, ...newScenes],
                                  updatedAt: Date.now(),
                                });
                                const noteCount = parsed.reduce(
                                  (n, s) => n + s.notes.length,
                                  0,
                                );
                                setImportNote(
                                  `Đã tạo ${newScenes.length} cảnh từ kịch bản${
                                    noteCount > 0
                                      ? ` (${noteCount} dòng giữ trong ghi chú)`
                                      : ""
                                  } — mở từng cảnh sửa tiếp rồi dựng như bình thường.`,
                                );
                                setShowScreenplay(false);
                                setScreenplayText("");
                              }}
                              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 text-sm font-medium hover:opacity-90 transition"
                            >
                              Tạo cảnh
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
            )}
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
                    onAudioChange={(audioClips) =>
                      void apply(updateScene(project, sc.id, { audioClips }))
                    }
                    onParticlesChange={(particles) =>
                      void apply(updateScene(project, sc.id, { particles }))
                    }
                    onStrokesChange={(strokes) =>
                      void apply(updateScene(project, sc.id, { strokes }))
                    }
                  />
                ) : (
                  <PrevizEditor
                    key={sc.id}
                    scene={sc}
                    exportAspect={
                      resolveExportSize(exportPresetOf(project)).width /
                      resolveExportSize(exportPresetOf(project)).height
                    }
                    onChange={(previz) =>
                      void apply(updateScene(project, sc.id, { previz }))
                    }
                    onDialogueChange={(dialogue) =>
                      void apply(updateScene(project, sc.id, { dialogue }))
                    }
                    onWeatherChange={(weather) =>
                      void apply(updateScene(project, sc.id, { weather }))
                    }
                    onAudioChange={(audioClips) =>
                      void apply(updateScene(project, sc.id, { audioClips }))
                    }
                    onParticlesChange={(particles) =>
                      void apply(updateScene(project, sc.id, { particles }))
                    }
                    onEnvironmentChange={(environment) =>
                      void apply(updateScene(project, sc.id, { environment }))
                    }
                    onScenePostChange={(scenePost) =>
                      void apply(updateScene(project, sc.id, { scenePost }))
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
        {project.scenes.length > 0 &&
          (() => {
            const prog = projectProgress(project.scenes);
            return (
              <div className="mb-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/50">
                  <span className="font-medium text-white/75">
                    Tiến độ sản xuất: {prog.done}/{prog.total} cảnh hoàn
                    thành ({prog.percent}%)
                  </span>
                  {SCENE_STATUSES.map((st) => (
                    <span key={st.id} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: st.color }}
                      />
                      {st.label}: {prog.counts[st.id]}
                    </span>
                  ))}
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
                  {SCENE_STATUSES.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        width: `${(prog.counts[st.id] / Math.max(1, prog.total)) * 100}%`,
                        backgroundColor: st.color,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        <div className="space-y-2">
          {project.scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
            >
              <span className="w-8 h-8 rounded-lg bg-pink-500/15 text-pink-300 grid place-items-center text-[13px] font-bold">
                {idx + 1}
              </span>
              <div className="w-36 flex-none">
                <div className="aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/50 grid place-items-center">
                  {scene.boardDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={scene.boardDataUrl}
                      alt={`Hình phác cảnh ${scene.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-white/30 px-2 text-center leading-snug">
                      Chưa có hình phác
                    </span>
                  )}
                </div>
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={() => setBoardDrawSceneId(scene.id)}
                    className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-sky-500/20 border border-sky-300/30 text-[11px] text-sky-100 hover:bg-sky-500/30 transition"
                  >
                    <Paintbrush className="w-3 h-3" /> Vẽ phác
                  </button>
                  {project.kind === "2d" && (
                    <button
                      onClick={() => void captureBoard(scene)}
                      title="Chụp khung đầu cảnh làm hình phác"
                      className="flex-1 flex items-center justify-center gap-1 h-7 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/70 hover:bg-white/10 transition"
                    >
                      <Camera className="w-3 h-3" /> Chụp khung
                    </button>
                  )}
                </div>
              </div>
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
              <label className="flex items-center gap-1.5 text-[12px] text-white/45">
                Tốc độ
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.25}
                  value={sceneSpeed(scene)}
                  onChange={(e) =>
                    void apply(
                      updateScene(project, scene.id, {
                        speed: Number(e.currentTarget.value),
                      }),
                    )
                  }
                  className="w-20 accent-pink-400"
                />
                <span className="tabular-nums text-white/70">
                  {sceneSpeed(scene)}x
                  {sceneSpeed(scene) !== 1 &&
                    ` · chiếu ${sceneWallDurationSec(scene).toFixed(1)}s`}
                </span>
              </label>
              {sceneSpeed(scene) !== 1 && (
                <span className="text-[11px] text-white/35">
                  Thoại và tiếng cảnh chậm/nhanh theo cảnh; nhạc nền giữ tốc độ gốc.
                </span>
              )}
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
              <details className="basis-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                <summary className="text-[12px] text-white/60 cursor-pointer">
                  Chữ chạy dưới (tên + chức danh)
                  {scene.lowerThird
                    ? ` — ${scene.lowerThird.name}`
                    : " — chưa đặt"}
                </summary>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[12px] text-white/55">
                  <input
                    value={scene.lowerThird?.name ?? ""}
                    onChange={(e) =>
                      void apply(
                        updateScene(project, scene.id, {
                          lowerThird: {
                            name: e.currentTarget.value,
                            role: scene.lowerThird?.role ?? "",
                            position: scene.lowerThird?.position ?? "bottom-left",
                            startSec: scene.lowerThird?.startSec ?? 0,
                            durationSec: scene.lowerThird?.durationSec ?? 3,
                          },
                        }),
                      )
                    }
                    placeholder="Tên người hiện chữ"
                    className="h-8 w-36 rounded-lg bg-black/50 border border-white/10 px-2 text-white outline-none"
                  />
                  <input
                    value={scene.lowerThird?.role ?? ""}
                    onChange={(e) =>
                      void apply(
                        updateScene(project, scene.id, {
                          lowerThird: {
                            name: scene.lowerThird?.name ?? "",
                            role: e.currentTarget.value,
                            position: scene.lowerThird?.position ?? "bottom-left",
                            startSec: scene.lowerThird?.startSec ?? 0,
                            durationSec: scene.lowerThird?.durationSec ?? 3,
                          },
                        }),
                      )
                    }
                    placeholder="Chức danh"
                    className="h-8 w-32 rounded-lg bg-black/50 border border-white/10 px-2 text-white outline-none"
                  />
                  <select
                    value={scene.lowerThird?.position ?? "bottom-left"}
                    onChange={(e) =>
                      void apply(
                        updateScene(project, scene.id, {
                          lowerThird: {
                            name: scene.lowerThird?.name ?? "",
                            role: scene.lowerThird?.role ?? "",
                            position: e.currentTarget.value as
                              | "bottom-left"
                              | "bottom-right"
                              | "top-left"
                              | "top-right",
                            startSec: scene.lowerThird?.startSec ?? 0,
                            durationSec: scene.lowerThird?.durationSec ?? 3,
                          },
                        }),
                      )
                    }
                    className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-white outline-none"
                  >
                    <option value="bottom-left">Dưới trái</option>
                    <option value="bottom-right">Dưới phải</option>
                    <option value="top-left">Trên trái</option>
                    <option value="top-right">Trên phải</option>
                  </select>
                  <label className="flex items-center gap-1.5">
                    Bắt đầu
                    <input
                      type="number"
                      min={0}
                      max={scene.durationSec}
                      step={0.5}
                      value={scene.lowerThird?.startSec ?? 0}
                      onChange={(e) =>
                        void apply(
                          updateScene(project, scene.id, {
                            lowerThird: {
                              name: scene.lowerThird?.name ?? "",
                              role: scene.lowerThird?.role ?? "",
                              position: scene.lowerThird?.position ?? "bottom-left",
                              startSec: Number(e.currentTarget.value),
                              durationSec: scene.lowerThird?.durationSec ?? 3,
                            },
                          }),
                        )
                      }
                      className="w-16 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-white outline-none"
                    />
                    giây
                  </label>
                  <label className="flex items-center gap-1.5">
                    Hiện
                    <input
                      type="number"
                      min={0.5}
                      max={30}
                      step={0.5}
                      value={scene.lowerThird?.durationSec ?? 3}
                      onChange={(e) =>
                        void apply(
                          updateScene(project, scene.id, {
                            lowerThird: {
                              name: scene.lowerThird?.name ?? "",
                              role: scene.lowerThird?.role ?? "",
                              position: scene.lowerThird?.position ?? "bottom-left",
                              startSec: scene.lowerThird?.startSec ?? 0,
                              durationSec: Number(e.currentTarget.value),
                            },
                          }),
                        )
                      }
                      className="w-16 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-white outline-none"
                    />
                    giây
                  </label>
                  {scene.lowerThird && (
                    <button
                      onClick={() =>
                        void apply(
                          updateScene(project, scene.id, { lowerThird: undefined }),
                        )
                      }
                      className="text-white/40 hover:text-rose-400"
                    >
                      Xoá chữ chạy dưới
                    </button>
                  )}
                  <span className="text-[11px] text-white/35">
                    Mốc theo thời gian nội dung của cảnh (không đổi khi đổi tốc độ).
                  </span>
                </div>
              </details>
              <div className="basis-full flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                <label className="flex items-center gap-1.5 text-[12px] text-white/45">
                  <span
                    className="w-2 h-2 rounded-full flex-none"
                    style={{
                      backgroundColor: sceneStatusMeta(sceneStatusOf(scene))
                        .color,
                    }}
                  />
                  Trạng thái
                  <select
                    value={sceneStatusOf(scene)}
                    onChange={(e) =>
                      void apply(
                        updateScene(project, scene.id, {
                          status: e.currentTarget.value as SceneStatus,
                        }),
                      )
                    }
                    aria-label="Trạng thái sản xuất của cảnh"
                    className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                  >
                    {SCENE_STATUSES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[12px] text-white/45">
                  Cú máy
                  <select
                    value={scene.shotType ?? ""}
                    onChange={(e) =>
                      void apply(
                        updateScene(project, scene.id, {
                          shotType: e.currentTarget.value || undefined,
                        }),
                      )
                    }
                    aria-label="Loại cú máy của cảnh"
                    className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                  >
                    <option value="">Chưa chọn</option>
                    {SHOT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  value={scene.cameraNote ?? ""}
                  onChange={(e) =>
                    void apply(
                      updateScene(project, scene.id, {
                        cameraNote: e.currentTarget.value,
                      }),
                    )
                  }
                  placeholder="Ghi chú camera (VD: lia máy chậm từ trái sang, giữ 2 giây ở mặt nhân vật…)"
                  aria-label="Ghi chú camera"
                  className="flex-1 min-w-[200px] bg-transparent text-[12px] text-white/60 outline-none border-b border-transparent focus:border-white/30 placeholder:text-white/25"
                />
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

      {boardDrawSceneId &&
        (() => {
          const target = project.scenes.find((x) => x.id === boardDrawSceneId);
          if (!target) return null;
          return (
            <DrawStudioModal
              title={`Vẽ phác phân cảnh — ${target.name}`}
              initialDataUrl={target.boardDataUrl ?? null}
              canvasWidth={960}
              canvasHeight={540}
              onClose={() => setBoardDrawSceneId(null)}
              onSave={(dataUrl) => {
                void apply(
                  updateScene(project, target.id, { boardDataUrl: dataUrl }),
                );
                setBoardDrawSceneId(null);
              }}
            />
          );
        })()}

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
