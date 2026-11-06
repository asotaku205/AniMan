"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BRIDGE_KIND_LABEL,
  createBridge,
} from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";
import type { AuthenticatedFetch } from "../../../../../lib/auth-api";
import { breakdownScene, type NovelBreakdown } from "../../../../../lib/novel-ai";
import {
  suggestScenesFromText,
  type SceneDraft,
} from "../../animation/lib/sceneSuggest";
import { listAnimProjects } from "../../animation/lib/animStorage";
import type { AnimProject } from "../../animation/lib/animProject";
import { listSeries } from "../../animation/lib/libraryStorage";
import type { Series } from "../../animation/lib/library";
import { LAYOUTS } from "../../manga-ai/data";
import type { PanelPlan } from "../../manga-ai/lib/panelPlans";
import {
  pagesForAnimProject,
  planPagesFromBreakdown,
  changePlanPageLayout,
  estimateScenePlan,
  planDialogueCoverage,
  splitSceneIntoChunks,
  type MangaPageDraft,
  type MangaPlanPage,
} from "../lib/novelBridge";
import { recordNotification } from "../../../notification/lib/notifications";
import {
  createAnimProjectFromDrafts,
  createMangaProjectFromAnim,
  createMangaProjectFromPlan,
  createTranslateEpisodeFromAnim,
} from "../lib/bridgeActions";

type Scope = "scene" | "chapter" | "novel";

const TARGET_LANGS = [
  { id: "en", label: "Tiếng Anh" },
  { id: "ja", label: "Tiếng Nhật" },
  { id: "ko", label: "Tiếng Hàn" },
  { id: "zh", label: "Tiếng Trung" },
];

const inputCls =
  "rounded-lg border border-amber-100/20 bg-white/10 px-2 py-1.5 text-sm text-amber-100";
const btnCls =
  "rounded-full bg-amber-700 px-3 py-1.5 text-sm text-white disabled:opacity-50";
const sectionCls =
  "rounded-xl border border-amber-100/15 bg-white/5 p-4";

function sceneText(sc: { contentLeft: string; contentRight: string }) {
  return [sc.contentLeft, sc.contentRight].filter(Boolean).join("\n\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Nút xoá 2 lần (bấm lần 2 trong 2s mới xoá thật). */
function ArmedDelete({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className="text-xs text-red-300 hover:underline"
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? "Chắc chắn?" : "Xoá ghi nhận"}
    </button>
  );
}

export default function BridgeView({
  s,
  authenticatedFetch,
}: {
  s: NovelStudioState;
  authenticatedFetch: AuthenticatedFetch;
}) {
  const novel = s.selectedNovel;
  const [scope, setScope] = useState<Scope>("scene");
  const [genre, setGenre] = useState("");
  const [animGenre, setAnimGenre] = useState("");
  const [drafts, setDrafts] = useState<SceneDraft[] | null>(null);
  const [planPages, setPlanPages] = useState<MangaPlanPage[] | null>(null);
  const [animProjects, setAnimProjects] = useState<AnimProject[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [animId, setAnimId] = useState("");
  const [animPages, setAnimPages] = useState<MangaPageDraft[] | null>(null);
  const [animIdT, setAnimIdT] = useState("");
  const [seriesChoice, setSeriesChoice] = useState<string>("new");
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [planCoverage, setPlanCoverage] = useState<{
    covered: number;
    total: number;
    missing: string[];
  } | null>(null);
  /**
   * Đoạn đã phân tích xong trong phiên này (key = đúng văn bản đoạn):
   * bấm lại sau lỗi thì chỉ gọi lại các đoạn chưa xong, không đốt
   * lượt AI cho đoạn đã có kết quả.
   */
  const chunkCacheRef = useRef(new Map<string, NovelBreakdown>());
  const [result, setResult] = useState<{ label: string; route: string } | null>(
    null,
  );

  useEffect(() => {
    void listAnimProjects().then(setAnimProjects).catch(() => setAnimProjects([]));
    void listSeries().then(setSeriesList).catch(() => setSeriesList([]));
  }, []);

  if (!novel) return null;

  const scopeLabel =
    scope === "scene"
      ? `Cảnh “${s.selectedScene?.title ?? "?"}”`
      : scope === "chapter"
        ? `Chương “${s.selectedChapter?.title ?? "?"}”`
        : "Cả truyện";
  const scopeText =
    scope === "scene"
      ? s.selectedScene
        ? sceneText(s.selectedScene)
        : ""
      : scope === "chapter"
        ? s.scenes.map(sceneText).join("\n\n")
        : s.novelScenes.map(sceneText).join("\n\n");
  const scopeEmpty = scopeText.trim().length === 0;
  /**
   * Ước tính kế hoạch cho phạm vi đang chọn, tính trước khi gọi AI:
   * chia từng cảnh thành đoạn (mỗi đoạn = đúng 1 trang = 1 lượt AI)
   * rồi cộng dồn. Sơn thấy trước cần bao nhiêu trang và bao nhiêu
   * lượt AI, thay vì gọi xong mới biết chỉ được 1 trang.
   */
  const planEstimate = useMemo(() => {
    const scenes =
      scope === "scene"
        ? s.selectedScene
          ? [s.selectedScene]
          : []
        : scope === "chapter"
          ? s.scenes
          : s.novelScenes;
    const withText = scenes.filter((sc) => sceneText(sc).trim().length > 0);
    let chunks = 0;
    let panels = 0;
    let dialogues = 0;
    for (const sc of withText) {
      const est = estimateScenePlan(sceneText(sc));
      chunks += est.chunks;
      panels += est.panels;
      dialogues += est.dialogues;
    }
    return {
      scenes: withText.length,
      chunks,
      panels,
      pages: chunks,
      dialogues,
    };
  }, [scope, s.selectedScene, s.scenes, s.novelScenes]);
  const sourceNote = `Từ tiểu thuyết ${novel.title} — ${scopeLabel}`;
  const novelDesc = [novel.premise, novel.summary].filter(Boolean).join("\n\n");
  const animProject = animProjects.find((p) => p.id === animId) ?? null;
  const animProjectT = animProjects.find((p) => p.id === animIdT) ?? null;
  /** Truyện nguồn của một dự án Animation (nếu nó từng được tạo từ truyện này). */
  const novelIdForAnim = (projectId: string) =>
    s.bridges.find(
      (b) =>
        b.kind === "novel-anim" &&
        b.targetRoute === `/studio/animation/project/${projectId}`,
    )?.novelId ?? null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy("");
    }
  };

  const createAnim = () =>
    run("Đang tạo dự án Animation…", async () => {
      if (!drafts || drafts.length === 0) return;
      const name =
        scope === "novel" ? novel.title : `${novel.title} — ${scopeLabel}`;
      const project = await createAnimProjectFromDrafts(name, drafts, sourceNote);
      await s.addBridge(
        createBridge(
          novel.id,
          "novel-anim",
          sourceNote,
          project.name,
          `/studio/animation/project/${project.id}`,
        ),
      );
      setAnimProjects((prev) => [project, ...prev]);
      await recordNotification(
        "bridge",
        `Đã tạo dự án Animation “${project.name}”`,
        sourceNote,
        `/studio/animation/project/${project.id}`,
      );
      setResult({
        label: `Dự án Animation “${project.name}” (${project.scenes.length} cảnh)`,
        route: `/studio/animation/project/${project.id}`,
      });
    });

  const createMangaFromPlan = () =>
    run("Đang tạo dự án Manga…", async () => {
      if (!planPages || planPages.length === 0) return;
      const panelCount = planPages.reduce((n, pg) => n + pg.plans.length, 0);
      const created = await createMangaProjectFromPlan(
        novel.title,
        novelDesc,
        genre,
        planPages,
      );
      await s.addBridge(
        createBridge(
          novel.id,
          "novel-manga",
          sourceNote,
          `${novel.title} (${created.pageCount} trang)`,
          "/studio/manga-ai",
        ),
      );
      await recordNotification(
        "bridge",
        `Đã tạo dự án Manga “${novel.title}”`,
        `${created.pageCount} trang, ${panelCount} khung từ ${scopeLabel}. Mở khung trong Manga Studio là thấy prompt đã điền sẵn.`,
        "/studio/manga-ai",
      );
      setResult({
        label: `Dự án Manga “${novel.title}” (${created.pageCount} trang, ${panelCount} khung)  -  mở Manga Studio là thấy dự án mới đã được chọn sẵn`,
        route: "/studio/manga-ai",
      });
    });

  /**
   * AI phân tích phạm vi thành trang/khung manga.
   * Trước đây mỗi cảnh gọi AI 1 lần và prompt để model tự chọn 1-3
   * trang, nên cảnh dài cũng chỉ về 1 trang, nội dung rớt hết. Giờ
   * mỗi cảnh được chia thành đoạn trước (mỗi đoạn = đúng 1 trang,
   * tính từ số câu thoại + đoạn kể), rồi gọi AI từng đoạn với ép đúng
   * 1 trang. 1 đoạn = 1 lượt AI (giới hạn chung 5/phút, 30/ngày),
   * nên giữa các lần gọi đợi 13 giây để không chạm trần phút; hết
   * lượt thì đợi 65 giây rồi thử lại đúng đoạn đó 1 lần. Đoạn lỗi thì
   * giữ lại các trang đã xong, bấm lại chỉ gọi các đoạn còn lại.
   */
  const analyzePlan = () =>
    run("Đang phân tích bằng AI…", async () => {
      const scenes =
        scope === "scene"
          ? s.selectedScene
            ? [s.selectedScene]
            : []
          : scope === "chapter"
            ? s.scenes
            : s.novelScenes;
      const withText = scenes.filter((sc) => sceneText(sc).trim().length > 0);
      if (withText.length === 0) {
        setError("Phạm vi đang chọn không có nội dung để phân tích.");
        return;
      }
      const context = [novel.premise, novel.summary]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 2000);
      const jobs: { sceneTitle: string; sceneSynopsis: string; chunkText: string }[] = [];
      for (const sc of withText) {
        for (const chunk of splitSceneIntoChunks(sceneText(sc))) {
          jobs.push({
            sceneTitle: sc.title,
            sceneSynopsis: sc.synopsis ?? "",
            chunkText: chunk.text,
          });
        }
      }
      setPlanCoverage(null);
      const all: MangaPlanPage[] = [];
      let madeCalls = 0;
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        setBusy(
          `Đang phân tích đoạn ${i + 1}/${jobs.length} (cảnh “${job.sceneTitle}”)…`,
        );
        let breakdown = chunkCacheRef.current.get(job.chunkText);
        if (!breakdown) {
          if (madeCalls > 0) {
            setBusy(
              `Đang phân tích đoạn ${i + 1}/${jobs.length} (đang đợi lượt AI)…`,
            );
            await sleep(13_000);
          }
          const sceneContext = [context, job.sceneSynopsis]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 2000);
          const failChunk = (e: unknown): Error =>
            new Error(
              `Đã phân tích được ${all.length} trang, dừng ở đoạn ${i + 1}/${jobs.length}: ${
                e instanceof Error ? e.message : "Có lỗi xảy ra."
              } Bấm lại để thử tiếp các đoạn còn lại (đoạn đã xong không tốn lượt nữa).`,
            );
          try {
            breakdown = await breakdownScene(
              authenticatedFetch,
              job.chunkText,
              sceneContext || undefined,
              { pages: 1 },
            );
          } catch (e) {
            if (e instanceof Error && e.message.includes("Đã hết lượt AI")) {
              setBusy(
                `Đã hết lượt AI, đợi 65 giây rồi thử lại đoạn ${i + 1}/${jobs.length}…`,
              );
              await sleep(65_000);
              try {
                breakdown = await breakdownScene(
                  authenticatedFetch,
                  job.chunkText,
                  sceneContext || undefined,
                  { pages: 1 },
                );
              } catch (e2) {
                throw failChunk(e2);
              }
            } else {
              throw failChunk(e);
            }
          }
          chunkCacheRef.current.set(job.chunkText, breakdown);
          madeCalls += 1;
        }
        all.push(...planPagesFromBreakdown(breakdown, job.sceneTitle));
        setPlanPages([...all]);
      }
      setPlanCoverage(
        planDialogueCoverage(
          all,
          withText.map((sc) => sceneText(sc)),
        ),
      );
    });

  const updatePlanPanel = (
    pageIdx: number,
    panelIdx: number,
    patch: Partial<PanelPlan>,
  ) => {
    setPlanPages((prev) =>
      prev
        ? prev.map((pg, i) =>
            i === pageIdx
              ? {
                  ...pg,
                  plans: pg.plans.map((pl, j) =>
                    j === panelIdx ? { ...pl, ...patch } : pl,
                  ),
                }
              : pg,
          )
        : prev,
    );
  };

  const deletePlanPanel = (pageIdx: number, panelIdx: number) => {
    setPlanPages((prev) => {
      if (!prev) return prev;
      const next = prev
        .map((pg, i) =>
          i === pageIdx
            ? { ...pg, plans: pg.plans.filter((_, j) => j !== panelIdx) }
            : pg,
        )
        .filter((pg) => pg.plans.length > 0);
      return next.length > 0 ? next : null;
    });
  };

  const updatePlanLayout = (pageIdx: number, layoutId: string) => {
    setPlanPages((prev) =>
      prev ? changePlanPageLayout(prev, pageIdx, layoutId) : prev,
    );
  };

  const createAnimManga = () =>
    run("Đang tạo dự án Manga…", async () => {
      if (!animProject || !animPages || animPages.length === 0) return;
      const created = await createMangaProjectFromAnim(animProject, animGenre);
      await s.addBridge(
        createBridge(
          novelIdForAnim(animProject.id),
          "anim-manga",
          `Dự án Animation “${animProject.name}”`,
          `${animProject.name} (${created.pageCount} trang)`,
          "/studio/manga-ai",
        ),
      );
      await recordNotification(
        "bridge",
        `Đã tạo dự án Manga “${animProject.name}”`,
        `${created.pageCount} trang từ dự án Animation.`,
        "/studio/manga-ai",
      );
      setResult({
        label: `Dự án Manga “${animProject.name}” (${created.pageCount} trang) — mở Manga Studio là thấy dự án mới đã được chọn sẵn`,
        route: "/studio/manga-ai",
      });
    });

  const createTranslate = () =>
    run("Đang tạo tập dịch…", async () => {
      if (!animProjectT) return;
      const target =
        seriesChoice === "new"
          ? await createTranslateEpisodeFromAnim(animProjectT, {
              newSeriesTitle: newSeriesTitle.trim() || animProjectT.name,
              targetLang,
            })
          : await createTranslateEpisodeFromAnim(animProjectT, {
              seriesId: seriesChoice,
            });
      if (seriesChoice === "new") {
        setSeriesList((prev) => [target.series, ...prev]);
        setSeriesChoice(target.series.id);
      }
      await s.addBridge(
        createBridge(
          novelIdForAnim(animProjectT.id),
          "anim-translate",
          `Dự án Animation “${animProjectT.name}”`,
          `${target.series.title} — Tập ${target.episode.number} (${target.cueCount} cue)`,
          `/studio/animation/translate-edit/episode/${target.episode.id}`,
        ),
      );
      await recordNotification(
        "bridge",
        `Đã tạo ${target.series.title} — Tập ${target.episode.number}`,
        `${target.cueCount} cue thoại từ dự án Animation “${animProjectT.name}”.`,
        `/studio/animation/translate-edit/episode/${target.episode.id}`,
      );
      setResult({
        label: `${target.series.title} — Tập ${target.episode.number} (${target.cueCount} cue thoại)`,
        route: `/studio/animation/translate-edit/episode/${target.episode.id}`,
      });
    });

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-300">{error}</p>}
      {busy && <p className="text-sm text-amber-100/70">{busy}</p>}
      {result && (
        <p className="rounded-lg border border-amber-100/20 bg-white/5 p-3 text-sm text-amber-100">
          Đã tạo: {result.label} —{" "}
          <Link href={result.route} className="font-semibold underline">
            Mở ngay
          </Link>
        </p>
      )}

      {/* 1. Novel → Animation */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          1. Tiểu thuyết → Animation
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-amber-100/80">
            Phạm vi{" "}
            <select
              className={inputCls}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                setDrafts(null);
                setPlanPages(null);
                setPlanCoverage(null);
              }}
            >
              <option value="scene" disabled={!s.selectedScene}>
                Cảnh đang chọn
              </option>
              <option value="chapter" disabled={!s.selectedChapter}>
                Chương đang chọn
              </option>
              <option value="novel">Cả truyện</option>
            </select>
          </label>
          <button
            type="button"
            className={btnCls}
            disabled={scopeEmpty || !!busy}
            onClick={() => setDrafts(suggestScenesFromText(scopeText))}
          >
            Xem trước phân cảnh
          </button>
        </div>
        {scopeEmpty && (
          <p className="mt-2 text-xs text-amber-100/70">
            Phạm vi này chưa có nội dung.
          </p>
        )}
        {drafts && (
          <div className="mt-3 space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={d.name}
                  onChange={(e) =>
                    setDrafts((prev) => {
                      if (!prev) return prev;
                      const next = [...prev];
                      next[i] = { ...next[i], name: e.target.value };
                      return next;
                    })
                  }
                />
                <label className="text-xs text-amber-100/70">
                  <input
                    type="number"
                    min={1}
                    className={`${inputCls} w-16`}
                    value={d.durationSec}
                    onChange={(e) =>
                      setDrafts((prev) => {
                        if (!prev) return prev;
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          durationSec: Number(e.target.value) || 3,
                        };
                        return next;
                      })
                    }
                  />{" "}
                  giây
                </label>
                <span className="text-xs text-amber-100/70">
                  {d.dialogueTexts.length} thoại
                </span>
                <button
                  type="button"
                  className="text-xs text-red-300 hover:underline"
                  onClick={() =>
                    setDrafts((prev) => prev?.filter((_, j) => j !== i) ?? null)
                  }
                >
                  Xoá
                </button>
              </div>
            ))}
            {drafts.length === 0 && (
              <p className="text-sm text-amber-100/70">
                Không còn cảnh nháp nào.
              </p>
            )}
            <button
              type="button"
              className={btnCls}
              disabled={drafts.length === 0 || !!busy}
              onClick={() => void createAnim()}
            >
              Tạo dự án Animation ({drafts.length} cảnh)
            </button>
          </div>
        )}
      </section>

      {/* 2. Novel → Manga */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          2. Tiểu thuyết sang Manga (AI phân tích)
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-amber-100/80">
            Phạm vi{" "}
            <select
              className={inputCls}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                setDrafts(null);
                setPlanPages(null);
                setPlanCoverage(null);
              }}
            >
              <option value="scene" disabled={!s.selectedScene}>
                Cảnh đang chọn
              </option>
              <option value="chapter" disabled={!s.selectedChapter}>
                Chương đang chọn
              </option>
              <option value="novel">Cả truyện</option>
            </select>
          </label>
          <label className="text-sm text-amber-100/80">
            Thể loại{" "}
            <input
              className={inputCls}
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="Để trống = Action"
            />
          </label>
          <button
            type="button"
            className={btnCls}
            disabled={scopeEmpty || !!busy}
            onClick={() => void analyzePlan()}
          >
            Phân tích bằng AI
          </button>
        </div>
        {scopeEmpty && (
          <p className="mt-2 text-xs text-amber-100/70">
            Phạm vi này chưa có nội dung.
          </p>
        )}
        {!scopeEmpty && (
          <p className="mt-2 text-xs text-amber-100/70">
            Ước tính: {planEstimate.scenes} cảnh, {planEstimate.chunks} đoạn
            = {planEstimate.pages} trang, {planEstimate.panels} khung,{" "}
            {planEstimate.dialogues} câu thoại, cần {planEstimate.chunks}{" "}
            lượt AI (giới hạn 30/ngày).
            {planEstimate.chunks > 30 &&
              " Vượt giới hạn ngày, nên chia nhỏ phạm vi (từng chương) rồi làm nhiều lần."}
          </p>
        )}
        {planPages && (
          <div className="mt-3 space-y-3">
            {planPages.map((pg, pi) => (
              <div
                key={pi}
                className="rounded-lg border border-amber-100/15 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-amber-100/80">
                    Trang {pi + 1} ({pg.plans.length} khung)  -  từ cảnh “
                    {pg.sourceSceneTitle}”
                  </p>
                  <label className="text-xs text-amber-100/70">
                    Layout{" "}
                    <select
                      className={inputCls}
                      value={pg.layoutId}
                      onChange={(e) => updatePlanLayout(pi, e.target.value)}
                    >
                      {LAYOUTS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label} ({l.panels.length} khung)
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {pg.plans.map((plan, pj) => (
                  <div key={pj} className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-100/70">
                        Khung {pj + 1}
                      </span>
                      <select
                        className={inputCls}
                        value={plan.sceneType}
                        onChange={(e) =>
                          updatePlanPanel(pi, pj, {
                            sceneType: e.target.value as PanelPlan["sceneType"],
                          })
                        }
                      >
                        <option value="action">Hành động</option>
                        <option value="dialogue">Thoại</option>
                        <option value="landscape">Phong cảnh</option>
                        <option value="closeup">Cận cảnh</option>
                        <option value="wide">Toàn cảnh</option>
                      </select>
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:underline"
                        onClick={() => deletePlanPanel(pi, pj)}
                      >
                        Xoá khung
                      </button>
                    </div>
                    <textarea
                      className={`${inputCls} w-full`}
                      rows={2}
                      value={plan.prompt}
                      placeholder="Prompt sinh ảnh mẫu cho khung này"
                      onChange={(e) =>
                        updatePlanPanel(pi, pj, { prompt: e.target.value })
                      }
                    />
                    {plan.dialogue.length > 0 && (
                      <p className="text-xs text-amber-100/60">
                        Thoại tham khảo: {plan.dialogue.join(" / ")}
                      </p>
                    )}
                    {plan.note && (
                      <p className="text-xs text-amber-100/60">
                        Ghi chú bố cục: {plan.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {planPages.length === 0 && (
              <p className="text-sm text-amber-100/70">
                Không còn khung nào.
              </p>
            )}
            {planCoverage && planCoverage.total > 0 && (
              <div className="text-xs text-amber-100/70">
                <p>
                  Thoại đã vào kế hoạch: {planCoverage.covered}/
                  {planCoverage.total} câu.
                </p>
                {planCoverage.missing.length > 0 && (
                  <div className="mt-1">
                    <p>Câu chưa vào kế hoạch (thêm khung tay nếu cần):</p>
                    <ul className="list-disc pl-4">
                      {planCoverage.missing.slice(0, 5).map((line) => (
                        <li key={line}>“{line}”</li>
                      ))}
                    </ul>
                    {planCoverage.missing.length > 5 && (
                      <p>
                        Và {planCoverage.missing.length - 5} câu khác.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className={btnCls}
              disabled={planPages.length === 0 || !!busy}
              onClick={() => void createMangaFromPlan()}
            >
              Tạo dự án Manga (
              {planPages.reduce((n, pg) => n + pg.plans.length, 0)} khung)
            </button>
          </div>
        )}
      </section>

      {/* 3. Animation → Manga */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          3. Animation → Manga
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={inputCls}
            value={animId}
            onChange={(e) => {
              setAnimId(e.target.value);
              setAnimPages(null);
            }}
          >
            <option value="">Chọn dự án Animation…</option>
            {animProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.scenes.length} cảnh)
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            value={animGenre}
            onChange={(e) => setAnimGenre(e.target.value)}
            placeholder="Thể loại (trống = Action)"
          />
          <button
            type="button"
            className={btnCls}
            disabled={!animProject || !!busy}
            onClick={() =>
              animProject && setAnimPages(pagesForAnimProject(animProject))
            }
          >
            Xem trước
          </button>
        </div>
        {animProjects.length === 0 && (
          <p className="mt-2 text-xs text-amber-100/70">
            Chưa có dự án Animation nào — tạo một dự án ở cầu nối 1 trước.
          </p>
        )}
        {animPages && (
          <div className="mt-3">
            <p className="text-sm text-amber-100/80">
              {animPages.length} trang,{" "}
              {animPages.reduce((n, pg) => n + pg.panels.length, 0)} panel từ{" "}
              {animProject?.scenes.length} cảnh.
            </p>
            <button
              type="button"
              className={`${btnCls} mt-2`}
              disabled={animPages.length === 0 || !!busy}
              onClick={() => void createAnimManga()}
            >
              Tạo dự án Manga
            </button>
          </div>
        )}
      </section>

      {/* 4. Animation → Dịch */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          4. Animation → Dịch/lồng tiếng
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={inputCls}
            value={animIdT}
            onChange={(e) => setAnimIdT(e.target.value)}
          >
            <option value="">Chọn dự án Animation…</option>
            {animProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.scenes.length} cảnh)
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={seriesChoice}
            onChange={(e) => setSeriesChoice(e.target.value)}
          >
            <option value="new">Series mới…</option>
            {seriesList.map((sr) => (
              <option key={sr.id} value={sr.id}>
                {sr.title}
              </option>
            ))}
          </select>
          {seriesChoice === "new" && (
            <>
              <input
                className={inputCls}
                value={newSeriesTitle}
                onChange={(e) => setNewSeriesTitle(e.target.value)}
                placeholder={`Tên series (mặc định: ${animProjectT?.name ?? "…"})`}
              />
              <select
                className={inputCls}
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
              >
                {TARGET_LANGS.map((l) => (
                  <option key={l.id} value={l.id}>
                    Dịch sang {l.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className={btnCls}
            disabled={!animProjectT || !!busy}
            onClick={() => void createTranslate()}
          >
            Tạo tập mới
          </button>
        </div>
        {seriesChoice !== "new" && (
          <p className="mt-2 text-xs text-amber-100/70">
            Tập mới sẽ vào mùa đầu của series đã chọn, số tập nối tiếp tập
            cuối.
          </p>
        )}
      </section>

      {/* Danh sách cầu nối */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          Cầu nối đã tạo từ truyện này
        </h3>
        {s.bridges.length === 0 ? (
          <p className="mt-2 text-sm text-amber-100/70">
            Chưa có cầu nối nào. Tạo ở 4 mục trên, ghi nhận sẽ hiện ở đây để
            mở nhanh dự án đích.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {s.bridges.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 text-sm text-amber-100/90"
              >
                <span className="text-xs text-amber-100/70">
                  {BRIDGE_KIND_LABEL[b.kind]}
                </span>
                <span>
                  {b.sourceLabel} → {b.targetLabel}
                </span>
                <span className="text-xs text-amber-100/60">
                  {new Date(b.createdAt).toLocaleString("vi-VN")}
                </span>
                <Link href={b.targetRoute} className="text-xs underline">
                  Mở
                </Link>
                <ArmedDelete onDelete={() => void s.deleteBridge(b.id)} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-amber-100/60">
          Xoá ghi nhận chỉ xoá dòng này, không xoá dự án đích.
        </p>
      </section>
    </div>
  );
}
