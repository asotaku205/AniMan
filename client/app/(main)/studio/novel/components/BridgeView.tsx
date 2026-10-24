"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BRIDGE_KIND_LABEL,
  createBridge,
} from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";
import {
  suggestScenesFromText,
  type SceneDraft,
} from "../../animation/lib/sceneSuggest";
import { listAnimProjects } from "../../animation/lib/animStorage";
import type { AnimProject } from "../../animation/lib/animProject";
import { listSeries } from "../../animation/lib/libraryStorage";
import type { Series } from "../../animation/lib/library";
import {
  pagesForAnimProject,
  pagesForPanels,
  panelDraftsForText,
  type MangaPageDraft,
} from "../lib/novelBridge";
import {
  createAnimProjectFromDrafts,
  createMangaProjectFromAnim,
  createMangaProjectFromPages,
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

export default function BridgeView({ s }: { s: NovelStudioState }) {
  const novel = s.selectedNovel;
  const [scope, setScope] = useState<Scope>("scene");
  const [genre, setGenre] = useState("");
  const [animGenre, setAnimGenre] = useState("");
  const [drafts, setDrafts] = useState<SceneDraft[] | null>(null);
  const [pages, setPages] = useState<MangaPageDraft[] | null>(null);
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
      setResult({
        label: `Dự án Animation “${project.name}” (${project.scenes.length} cảnh)`,
        route: `/studio/animation/project/${project.id}`,
      });
    });

  const createManga = () =>
    run("Đang tạo dự án Manga…", async () => {
      if (!pages || pages.length === 0) return;
      const created = await createMangaProjectFromPages(
        novel.title,
        novelDesc,
        genre,
        pages,
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
      setResult({
        label: `Dự án Manga “${novel.title}” (${created.pageCount} trang) — mở Manga Studio là thấy dự án mới đã được chọn sẵn`,
        route: "/studio/manga-ai",
      });
    });

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
      setResult({
        label: `${target.series.title} — Tập ${target.episode.number} (${target.cueCount} cue thoại)`,
        route: `/studio/animation/translate-edit/episode/${target.episode.id}`,
      });
    });

  const updatePanel = (
    pageIdx: number,
    panelIdx: number,
    patch: Partial<{ narration: string; dialogues: string[] }>,
  ) => {
    setPages((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const pg = { ...next[pageIdx], panels: [...next[pageIdx].panels] };
      pg.panels[panelIdx] = { ...pg.panels[panelIdx], ...patch };
      next[pageIdx] = pg;
      return next;
    });
  };

  const deletePanel = (pageIdx: number, panelIdx: number) => {
    setPages((prev) => {
      if (!prev) return prev;
      const next = prev
        .map((pg, i) =>
          i === pageIdx
            ? { panels: pg.panels.filter((_, j) => j !== panelIdx) }
            : pg,
        )
        .filter((pg) => pg.panels.length > 0);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-amber-100/70">
        Cầu nối chuyển một lần từ nguồn sang dự án đích — sau đó mỗi bên tự
        phát triển, sửa bên này không tự đổi bên kia. Tranh manga vẫn do Sơn
        vẽ, thoại dịch vẫn do Sơn dịch; cầu nối chỉ dựng khung sẵn.
      </p>

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
        <p className="mt-1 text-xs text-amber-100/70">
          Tách văn bản thành cảnh nháp (đoạn văn = cảnh, thoại trong ngoặc
          kép thành track thoại), Sơn duyệt rồi tạo dự án 2D.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-amber-100/80">
            Phạm vi{" "}
            <select
              className={inputCls}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                setDrafts(null);
                setPages(null);
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
          2. Tiểu thuyết → Manga (trực tiếp)
        </h3>
        <p className="mt-1 text-xs text-amber-100/70">
          Mỗi đoạn văn thành một panel, phần kể thành caption, thoại thành
          khối chữ — tranh trống để Sơn vẽ. Tối đa 5 panel/trang (layout
          Classic 5).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-amber-100/80">
            Phạm vi{" "}
            <select
              className={inputCls}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                setDrafts(null);
                setPages(null);
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
            onClick={() => setPages(pagesForPanels(panelDraftsForText(scopeText)))}
          >
            Xem trước phân trang
          </button>
        </div>
        {pages && (
          <div className="mt-3 space-y-3">
            {pages.map((pg, pi) => (
              <div
                key={pi}
                className="rounded-lg border border-amber-100/15 p-3"
              >
                <p className="text-xs font-semibold text-amber-100/80">
                  Trang {pi + 1} ({pg.panels.length} panel)
                </p>
                {pg.panels.map((panel, pj) => (
                  <div key={pj} className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-100/70">
                        Panel {pj + 1}
                      </span>
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:underline"
                        onClick={() => deletePanel(pi, pj)}
                      >
                        Xoá panel
                      </button>
                    </div>
                    <input
                      className={`${inputCls} w-full`}
                      value={panel.narration}
                      placeholder="Phần kể (caption)"
                      onChange={(e) =>
                        updatePanel(pi, pj, { narration: e.target.value })
                      }
                    />
                    {panel.dialogues.map((dl, di) => (
                      <input
                        key={di}
                        className={`${inputCls} w-full`}
                        value={dl}
                        placeholder="Thoại"
                        onChange={(e) =>
                          updatePanel(pi, pj, {
                            dialogues: panel.dialogues.map((x, j) =>
                              j === di ? e.target.value : x,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
            {pages.length === 0 && (
              <p className="text-sm text-amber-100/70">
                Không còn panel nào.
              </p>
            )}
            <button
              type="button"
              className={btnCls}
              disabled={pages.length === 0 || !!busy}
              onClick={() => void createManga()}
            >
              Tạo dự án Manga ({pages.reduce((n, pg) => n + pg.panels.length, 0)}{" "}
              panel)
            </button>
          </div>
        )}
      </section>

      {/* 3. Animation → Manga */}
      <section className={sectionCls}>
        <h3 className="text-sm font-semibold text-amber-100">
          3. Animation → Manga
        </h3>
        <p className="mt-1 text-xs text-amber-100/70">
          Mỗi cảnh Animation thành một panel (ghi chú cảnh làm phần kể, track
          thoại làm khối chữ). Chiều ngược lại — Manga → Animation — đã có
          sẵn từ trước.
        </p>
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
        <p className="mt-1 text-xs text-amber-100/70">
          Toàn bộ thoại thành tập mới với script card 2 ngôn ngữ (bản dịch
          khởi đầu = lời gốc, Sơn sửa lại khi dịch thật).
        </p>
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
