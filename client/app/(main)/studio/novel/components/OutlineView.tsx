"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arcGapWarnings,
  BEAT_KIND_LABEL,
  BIBLE_KIND_LABEL,
  mentionSceneIds,
  SCENE_STATUS_LABEL,
  sceneWords,
  sortBeatsByScene,
  unknownMentions,
  type BeatKind,
  type BibleEntityKind,
  type SceneStatus,
} from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";
import { listWorlds, type WorldRecord } from "../../world-builder/lib/dioramaStorage";
import {
  buildHtml,
  buildMarkdown,
  EXPORT_FORMAT_LABEL,
  exportFileName,
  type ExportFormat,
} from "../lib/novelExport";
import { buildDocxBlob } from "../lib/novelDocx";
import type { NovelExportData } from "../lib/novel";
import { checkSceneConsistency, summarizeScene } from "../../../../../lib/novel-ai";
import type { AuthenticatedFetch } from "../../../../../lib/auth-api";
import BridgeView from "./BridgeView";

type OutlineTab = "cards" | "plotlines" | "arcs" | "bible" | "versions" | "bridges";

const KIND_BG: Record<BeatKind, string> = {
  goal: "bg-sky-100 text-sky-800",
  conflict: "bg-rose-100 text-rose-800",
  turn: "bg-amber-100 text-amber-800",
  result: "bg-emerald-100 text-emerald-800",
};

/** Nút xoá bấm 2 lần (lần 2 xác nhận), tự huỷ trạng thái sau 2s. */
function DeleteButton({ onDelete, label = "Xoá" }: { onDelete: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button
        type="button"
        className="text-xs text-rose-600 hover:underline"
        onClick={() => {
          setArmed(true);
          window.setTimeout(() => setArmed(false), 2000);
        }}
      >
        {label}
      </button>
    );
  }
  return (
    <button type="button" className="text-xs font-semibold text-rose-700" onClick={onDelete}>
      Chắc chắn?
    </button>
  );
}

function SnowflakeStrip({ s }: { s: NovelStudioState }) {
  const novel = s.selectedNovel;
  const [premise, setPremise] = useState(novel?.premise ?? "");
  const [summary, setSummary] = useState(novel?.summary ?? "");
  const [outline, setOutline] = useState(novel?.outline ?? "");
  if (!novel) return null;
  const box = "w-full rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-stone-800 outline-none focus:border-amber-400";
  return (
    <section className="rounded-xl border border-amber-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-amber-900">Snowflake — từ 1 câu tới dàn ý</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-stone-500">1 câu tiền đề</span>
          <textarea className={box} rows={3} value={premise} onChange={(e) => setPremise(e.target.value)} onBlur={() => void s.updateNovelText("premise", premise)} placeholder="Câu chuyện này nói về…" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">1 đoạn tóm tắt</span>
          <textarea className={box} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => void s.updateNovelText("summary", summary)} placeholder="Mở đầu, xung đột, kết…" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Dàn ý dài</span>
          <textarea className={box} rows={3} value={outline} onChange={(e) => setOutline(e.target.value)} onBlur={() => void s.updateNovelText("outline", outline)} placeholder="Dàn ý theo chương, theo tuyến…" />
        </label>
      </div>
      <p className="mt-2 text-xs text-stone-400">Nội dung lưu khi rời khỏi ô nhập.</p>
    </section>
  );
}

export default function OutlineView({ s, onOpenScene, authenticatedFetch }: { s: NovelStudioState; onOpenScene: (sceneId: string) => void; authenticatedFetch: AuthenticatedFetch }) {
  const [tab, setTab] = useState<OutlineTab>("cards");
  const [dragId, setDragId] = useState<string | null>(null);
  // N3: sổ tay + AI
  const [bibleKindFilter, setBibleKindFilter] = useState<"all" | BibleEntityKind>("all");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityKind, setNewEntityKind] = useState<BibleEntityKind>("character");
  const [worlds, setWorlds] = useState<WorldRecord[] | null>(null);
  const [pickWorldId, setPickWorldId] = useState("");
  const [pickEntityId, setPickEntityId] = useState("");
  const [aiBusy, setAiBusy] = useState<Record<string, "summary" | "check" | null>>({});
  // N4: xuất bản + snapshot
  const [exportFormat, setExportFormat] = useState<ExportFormat>("md");
  const [includeOutline, setIncludeOutline] = useState(true);
  const [includeBible, setIncludeBible] = useState(false);
  const [snapName, setSnapName] = useState("");
  const [snapNote, setSnapNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [aiIssues, setAiIssues] = useState<Record<string, string[]>>({});
  const [newPlotTitle, setNewPlotTitle] = useState("");
  const [newArcName, setNewArcName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newBeat, setNewBeat] = useState<Record<string, { title: string; kind: BeatKind; sceneId: string }>>({});
  const [newMilestone, setNewMilestone] = useState<Record<string, { sceneId: string; note: string }>>({});

  const positionByScene = useMemo(() => new Map(s.novelScenes.map((sc, i) => [sc.id, i])), [s.novelScenes]);
  const mentionMap = useMemo(() => mentionSceneIds(s.entities, s.novelScenes), [s.entities, s.novelScenes]);
  const unknownList = useMemo(() => unknownMentions(s.novelScenes, s.entities), [s.entities, s.novelScenes]);
  const bibleText = useMemo(
    () =>
      s.entities
        .map((e) => `${e.name} (${BIBLE_KIND_LABEL[e.kind]}): ${[e.role, e.description, e.traits, e.notes].filter(Boolean).join(" ")}`)
        .join("\n"),
    [s.entities],
  );

  useEffect(() => {
    if (tab !== "bible" || worlds !== null) return;
    void listWorlds().then(setWorlds).catch(() => setWorlds([]));
  }, [tab, worlds]);

  const sceneLabel = useMemo(() => {
    const chapterTitle = new Map(s.chapters.map((c) => [c.id, c.title]));
    return new Map(s.novelScenes.map((sc) => [sc.id, `${chapterTitle.get(sc.chapterId) ?? "?"} · ${sc.title}`]));
  }, [s.chapters, s.novelScenes]);

  const currentData: NovelExportData | null = useMemo(() => {
    if (!s.selectedNovel) return null;
    const plIds = new Set(s.plotlines.map((pl) => pl.id));
    return {
      novel: s.selectedNovel,
      chapters: s.chapters,
      scenes: s.novelScenes,
      plotlines: s.plotlines,
      beats: s.beats.filter((b) => plIds.has(b.plotlineId)),
      arcs: s.arcs,
      questions: s.questions,
      entities: s.entities,
    };
  }, [s.selectedNovel, s.chapters, s.novelScenes, s.plotlines, s.beats, s.arcs, s.questions, s.entities]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runExport = async (data: NovelExportData | null, format: ExportFormat) => {
    if (!data) return;
    const options = { includeOutline, includeBible };
    setExporting(true);
    setExportError("");
    try {
      if (format === "md") {
        downloadBlob(new Blob([buildMarkdown(data, options)], { type: "text/markdown;charset=utf-8" }), exportFileName(data.novel.title, "md"));
      } else if (format === "html") {
        downloadBlob(new Blob([buildHtml(data, options)], { type: "text/html;charset=utf-8" }), exportFileName(data.novel.title, "html"));
      } else {
        downloadBlob(await buildDocxBlob(data, options), exportFileName(data.novel.title, "docx"));
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Xuất thất bại.");
    } finally {
      setExporting(false);
    }
  };

  const selectedEntity = s.entities.find((e) => e.id === selectedEntityId) ?? null;

  useEffect(() => {
    setPickWorldId(selectedEntity?.worldRef?.worldId ?? "");
    setPickEntityId(selectedEntity?.worldRef?.entityId ?? "");
  }, [selectedEntityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSummary = async (sc: { id: string; contentLeft: string; contentRight: string }) => {
    const text = `${sc.contentLeft}\n${sc.contentRight}`.trim();
    if (!text) {
      setAiError((prev) => ({ ...prev, [sc.id]: "Cảnh chưa có nội dung." }));
      return;
    }
    setAiBusy((prev) => ({ ...prev, [sc.id]: "summary" }));
    setAiError((prev) => ({ ...prev, [sc.id]: "" }));
    try {
      const summary = await summarizeScene(authenticatedFetch, text);
      await s.updateSceneMeta(sc.id, { aiSummary: summary });
    } catch (e) {
      setAiError((prev) => ({ ...prev, [sc.id]: e instanceof Error ? e.message : "AI thất bại." }));
    } finally {
      setAiBusy((prev) => ({ ...prev, [sc.id]: null }));
    }
  };

  const runCheck = async (sc: { id: string; contentLeft: string; contentRight: string }) => {
    const text = `${sc.contentLeft}\n${sc.contentRight}`.trim();
    if (!text) {
      setAiError((prev) => ({ ...prev, [sc.id]: "Cảnh chưa có nội dung." }));
      return;
    }
    setAiBusy((prev) => ({ ...prev, [sc.id]: "check" }));
    setAiError((prev) => ({ ...prev, [sc.id]: "" }));
    try {
      const issues = await checkSceneConsistency(authenticatedFetch, text, bibleText);
      setAiIssues((prev) => ({ ...prev, [sc.id]: issues }));
    } catch (e) {
      setAiError((prev) => ({ ...prev, [sc.id]: e instanceof Error ? e.message : "AI thất bại." }));
    } finally {
      setAiBusy((prev) => ({ ...prev, [sc.id]: null }));
    }
  };

  if (!s.selectedNovel) {
    return <p className="text-sm text-amber-100/70">Chưa có tiểu thuyết nào. Tạo tiểu thuyết ở view Viết trước.</p>;
  }

  const tabBtn = (key: OutlineTab, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? "bg-amber-700 text-white" : "bg-white/10 text-amber-100/80 hover:bg-white/20"}`}
    >
      {label}
    </button>
  );

  const sceneSelect = (value: string | null, onChange: (v: string | null) => void) => (
    <select
      className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— chưa gắn cảnh —</option>
      {s.novelScenes.map((sc) => (
        <option key={sc.id} value={sc.id}>
          {sceneLabel.get(sc.id)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      <SnowflakeStrip key={s.selectedNovel.id} s={s} />
      <div className="flex flex-wrap gap-2">
        {tabBtn("cards", "Thẻ cảnh")}
        {tabBtn("plotlines", "Tuyến truyện")}
        {tabBtn("arcs", "Cung & Câu hỏi")}
        {tabBtn("bible", "Sổ tay")}
        {tabBtn("versions", "Phiên bản")}
        {tabBtn("bridges", "Cầu nối")}
      </div>

      {tab === "cards" && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {s.chapters.map((chapter) => {
            const cards = s.novelScenes.filter((sc) => sc.chapterId === chapter.id);
            return (
              <section
                key={chapter.id}
                className="w-72 shrink-0 rounded-xl border border-amber-200/70 bg-amber-50 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) void s.moveSceneTo(dragId, chapter.id, null);
                  setDragId(null);
                }}
              >
                <h4 className="text-sm font-semibold text-stone-800">{chapter.title}</h4>
                <p className="text-xs text-stone-400">{cards.length} cảnh</p>
                <div className="mt-3 space-y-3">
                  {cards.map((sc) => (
                    <article
                      key={sc.id}
                      draggable
                      onDragStart={(e) => {
                        setDragId(sc.id);
                        e.dataTransfer.setData("text/plain", sc.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragId && dragId !== sc.id) void s.moveSceneTo(dragId, chapter.id, sc.id);
                        setDragId(null);
                      }}
                      className="cursor-grab rounded-lg border border-amber-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-stone-800">{sc.title}</p>
                        <span className="shrink-0 text-xs text-stone-400">{sceneWords(sc)} từ</span>
                      </div>
                      <textarea
                        className="mt-2 w-full rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700 outline-none focus:border-amber-400"
                        rows={2}
                        defaultValue={sc.synopsis}
                        placeholder="Tóm tắt 1-2 câu…"
                        onBlur={(e) => void s.updateSceneMeta(sc.id, { synopsis: e.target.value })}
                      />
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <select
                          className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs"
                          value={sc.status}
                          onChange={(e) => void s.updateSceneMeta(sc.id, { status: e.target.value as SceneStatus })}
                        >
                          {(Object.keys(SCENE_STATUS_LABEL) as SceneStatus[]).map((st) => (
                            <option key={st} value={st}>
                              {SCENE_STATUS_LABEL[st]}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="text-xs text-amber-700 hover:underline" onClick={() => onOpenScene(sc.id)}>
                          Mở để viết →
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={aiBusy[sc.id] != null}
                          className="rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-800 disabled:opacity-50"
                          onClick={() => void runSummary(sc)}
                        >
                          {aiBusy[sc.id] === "summary" ? "Đang tóm tắt…" : "Tóm tắt AI"}
                        </button>
                        <button
                          type="button"
                          disabled={aiBusy[sc.id] != null || s.entities.length === 0}
                          title={s.entities.length === 0 ? "Cần có sổ tay trước" : undefined}
                          className="rounded-md bg-violet-100 px-2 py-1 text-xs text-violet-800 disabled:opacity-50"
                          onClick={() => void runCheck(sc)}
                        >
                          {aiBusy[sc.id] === "check" ? "Đang kiểm tra…" : "Kiểm tra nhất quán"}
                        </button>
                      </div>
                      {aiError[sc.id] && <p className="mt-1 text-xs text-rose-600">{aiError[sc.id]}</p>}
                      {sc.aiSummary && (
                        <div className="mt-2 rounded-md border border-violet-200 bg-violet-50 p-2">
                          <p className="text-xs font-medium text-violet-800">Nháp AI</p>
                          <p className="mt-0.5 text-xs text-stone-700">{sc.aiSummary}</p>
                          <div className="mt-1 flex gap-2">
                            <button type="button" className="text-xs text-violet-700 hover:underline" onClick={() => void s.updateSceneMeta(sc.id, { synopsis: sc.aiSummary })}>
                              Dùng làm tóm tắt
                            </button>
                            <button type="button" className="text-xs text-stone-500 hover:underline" onClick={() => void s.updateSceneMeta(sc.id, { aiSummary: "" })}>
                              Xoá nháp
                            </button>
                          </div>
                        </div>
                      )}
                      {aiIssues[sc.id] !== undefined && (
                        <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 p-2">
                          {aiIssues[sc.id].length === 0 ? (
                            <p className="text-xs text-emerald-700">✓ Không phát hiện mâu thuẫn với sổ tay.</p>
                          ) : (
                            <ul className="space-y-1">
                              {aiIssues[sc.id].map((issue, i) => (
                                <li key={i} className="flex items-start justify-between gap-2 text-xs text-stone-700">
                                  <span>⚠ {issue}</span>
                                  <button type="button" className="shrink-0 text-stone-400 hover:underline" onClick={() => setAiIssues((prev) => ({ ...prev, [sc.id]: (prev[sc.id] ?? []).filter((_, j) => j !== i) }))}>
                                    Bỏ qua
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {cards.length === 0 && <p className="text-xs text-stone-400">Chưa có cảnh. Kéo cảnh từ chương khác vào đây.</p>}
                </div>
              </section>
            );
          })}
          {s.chapters.length === 0 && <p className="text-sm text-amber-100/70">Chưa có chương nào.</p>}
        </div>
      )}

      {tab === "plotlines" && (
        <div className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newPlotTitle.trim()) return;
              void s.addPlotline(newPlotTitle);
              setNewPlotTitle("");
            }}
          >
            <input className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" value={newPlotTitle} onChange={(e) => setNewPlotTitle(e.target.value)} placeholder="Tên tuyến truyện mới…" />
            <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">＋ Thêm tuyến</button>
          </form>
          {s.plotlines.map((plot) => {
            const plotBeats = sortBeatsByScene(
              s.beats.filter((b) => b.plotlineId === plot.id),
              positionByScene,
            );
            const unlinked = plotBeats.filter((b) => !b.sceneId).length;
            const draft = newBeat[plot.id] ?? { title: "", kind: "goal" as BeatKind, sceneId: "" };
            return (
              <section key={plot.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="color" value={plot.color} onChange={(e) => void s.renamePlotline(plot.id, { color: e.target.value })} title="Màu tuyến" />
                  <input
                    className="rounded-md border border-stone-200 px-2 py-1 text-sm font-semibold outline-none focus:border-amber-400"
                    defaultValue={plot.title}
                    onBlur={(e) => void s.renamePlotline(plot.id, { title: e.target.value })}
                  />
                  {unlinked > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">⚠ {unlinked} beat đứt mạch</span>}
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="rounded bg-stone-100 px-2 py-1 text-xs" onClick={() => void s.movePlotline(plot.id, -1)}>↑</button>
                    <button type="button" className="rounded bg-stone-100 px-2 py-1 text-xs" onClick={() => void s.movePlotline(plot.id, 1)}>↓</button>
                    <DeleteButton onDelete={() => void s.deletePlotline(plot.id)} />
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plotBeats.map((b) => (
                    <span key={b.id} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${b.sceneId ? KIND_BG[b.kind] : "border border-dashed border-rose-300 bg-rose-50 text-rose-700"}`}>
                      {BEAT_KIND_LABEL[b.kind]}: {b.title}
                      <span className="opacity-70">{b.sceneId ? `(${sceneLabel.get(b.sceneId)})` : "(chưa gắn cảnh)"}</span>
                    </span>
                  ))}
                  {plotBeats.length === 0 && <span className="text-xs text-stone-400">Chưa có beat.</span>}
                </div>
                <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                  {plotBeats.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center gap-2">
                      <select className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs" value={b.kind} onChange={(e) => void s.updateBeat(b.id, { kind: e.target.value as BeatKind })}>
                        {(Object.keys(BEAT_KIND_LABEL) as BeatKind[]).map((k) => (
                          <option key={k} value={k}>
                            {BEAT_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                      <input className="min-w-40 flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs outline-none focus:border-amber-400" defaultValue={b.title} onBlur={(e) => void s.updateBeat(b.id, { title: e.target.value })} />
                      {sceneSelect(b.sceneId, (v) => void s.updateBeat(b.id, { sceneId: v }))}
                      <DeleteButton onDelete={() => void s.deleteBeat(b.id)} />
                    </div>
                  ))}
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!draft.title.trim()) return;
                      void s.addBeat(plot.id, draft.title, draft.kind, draft.sceneId || null);
                      setNewBeat((prev) => ({ ...prev, [plot.id]: { title: "", kind: "goal", sceneId: "" } }));
                    }}
                  >
                    <input className="min-w-40 flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs" value={draft.title} onChange={(e) => setNewBeat((prev) => ({ ...prev, [plot.id]: { ...draft, title: e.target.value } }))} placeholder="Beat mới…" />
                    <select className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs" value={draft.kind} onChange={(e) => setNewBeat((prev) => ({ ...prev, [plot.id]: { ...draft, kind: e.target.value as BeatKind } }))}>
                      {(Object.keys(BEAT_KIND_LABEL) as BeatKind[]).map((k) => (
                        <option key={k} value={k}>
                          {BEAT_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    {sceneSelect(draft.sceneId || null, (v) => setNewBeat((prev) => ({ ...prev, [plot.id]: { ...draft, sceneId: v ?? "" } })))}
                    <button type="submit" className="rounded-md bg-amber-700 px-2 py-1 text-xs text-white">＋ Beat</button>
                  </form>
                </div>
              </section>
            );
          })}
          {s.plotlines.length === 0 && <p className="text-sm text-amber-100/70">Chưa có tuyến truyện nào. Thêm tuyến đầu tiên ở trên.</p>}
        </div>
      )}

      {tab === "arcs" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-amber-100">Cung nhân vật</h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newArcName.trim()) return;
                void s.addArc(newArcName);
                setNewArcName("");
              }}
            >
              <input className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm" value={newArcName} onChange={(e) => setNewArcName(e.target.value)} placeholder="Tên nhân vật…" />
              <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">＋ Thêm cung</button>
            </form>
            {s.arcs.map((arc) => {
              const warnings = arcGapWarnings(arc, positionByScene);
              const msDraft = newMilestone[arc.id] ?? { sceneId: "", note: "" };
              return (
                <article key={arc.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="rounded-md border border-stone-200 px-2 py-1 text-sm font-semibold outline-none focus:border-amber-400" defaultValue={arc.characterName} onBlur={(e) => void s.updateArc(arc.id, { characterName: e.target.value })} />
                    <select
                      className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs"
                      value={arc.entityId ?? ""}
                      onChange={(e) => void s.updateArc(arc.id, { entityId: e.target.value || null })}
                      title="Gắn cung này vào thực thể sổ tay"
                    >
                      <option value="">— chưa gắn sổ tay —</option>
                      {s.entities.filter((e) => e.kind === "character").map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <DeleteButton onDelete={() => void s.deleteArc(arc.id)} />
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label className="block text-xs text-stone-500">
                      Trạng thái đầu
                      <input className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" defaultValue={arc.startState} onBlur={(e) => void s.updateArc(arc.id, { startState: e.target.value })} placeholder="Nhân vật lúc đầu ra sao?" />
                    </label>
                    <label className="block text-xs text-stone-500">
                      Trạng thái cuối
                      <input className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" defaultValue={arc.endState} onBlur={(e) => void s.updateArc(arc.id, { endState: e.target.value })} placeholder="Nhân vật cuối truyện ra sao?" />
                    </label>
                  </div>
                  {warnings.map((w, i) => (
                    <p key={i} className="mt-2 text-xs text-rose-600">
                      ⚠ Vắng mặt {w.gap} cảnh giữa {sceneLabel.get(w.fromSceneId)} và {sceneLabel.get(w.toSceneId)} — độc giả có thể quên nhân vật này.
                    </p>
                  ))}
                  <ul className="mt-3 space-y-2">
                    {arc.milestones.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-800">{sceneLabel.get(m.sceneId) ?? "Cảnh đã xoá"}</span>
                        <input className="min-w-40 flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs outline-none focus:border-amber-400" defaultValue={m.note} placeholder="Thay đổi gì ở đây?" onBlur={(e) => void s.updateMilestoneNote(arc.id, m.id, e.target.value)} />
                        <DeleteButton onDelete={() => void s.deleteMilestone(arc.id, m.id)} />
                      </li>
                    ))}
                  </ul>
                  <form
                    className="mt-3 flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!msDraft.sceneId) return;
                      void s.addMilestone(arc.id, msDraft.sceneId, msDraft.note);
                      setNewMilestone((prev) => ({ ...prev, [arc.id]: { sceneId: "", note: "" } }));
                    }}
                  >
                    {sceneSelect(msDraft.sceneId || null, (v) => setNewMilestone((prev) => ({ ...prev, [arc.id]: { ...msDraft, sceneId: v ?? "" } })))}
                    <input className="min-w-40 flex-1 rounded-md border border-stone-300 px-2 py-1 text-xs" value={msDraft.note} onChange={(e) => setNewMilestone((prev) => ({ ...prev, [arc.id]: { ...msDraft, note: e.target.value } }))} placeholder="Ghi chú mốc…" />
                    <button type="submit" className="rounded-md bg-amber-700 px-2 py-1 text-xs text-white">＋ Mốc</button>
                  </form>
                </article>
              );
            })}
            {s.arcs.length === 0 && <p className="text-sm text-amber-100/70">Chưa có cung nhân vật nào.</p>}
          </section>

          <section className="space-y-4 border-t border-amber-100/15 pt-4">
            <h3 className="text-sm font-semibold text-amber-100">Câu hỏi mở</h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newQuestion.trim()) return;
                void s.addQuestion(newQuestion);
                setNewQuestion("");
              }}
            >
              <input className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Câu hỏi cài cắm cho độc giả…" />
              <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">＋ Thêm</button>
            </form>
            <ul className="space-y-3">
              {s.questions.map((q) => {
                const status = q.answeredSceneId ? "Đã trả lời" : q.plantedSceneId ? "Đang mở" : "Chưa cài cắm";
                return (
                  <li key={q.id} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="min-w-52 flex-1 rounded-md border border-stone-200 px-2 py-1 text-sm outline-none focus:border-amber-400" defaultValue={q.question} onBlur={(e) => void s.updateQuestion(q.id, { question: e.target.value })} />
                      <span className={`rounded-full px-2 py-0.5 text-xs ${q.answeredSceneId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status}</span>
                      <DeleteButton onDelete={() => void s.deleteQuestion(q.id)} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                      <label className="flex items-center gap-1.5">
                        Cài cắm ở {sceneSelect(q.plantedSceneId, (v) => void s.updateQuestion(q.id, { plantedSceneId: v }))}
                      </label>
                      <label className="flex items-center gap-1.5">
                        Trả lời ở {sceneSelect(q.answeredSceneId, (v) => void s.updateQuestion(q.id, { answeredSceneId: v }))}
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
            {s.questions.length === 0 && <p className="text-sm text-amber-100/70">Chưa có câu hỏi mở nào.</p>}
          </section>
        </div>
      )}

      {tab === "bible" && (
        <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="space-y-4">
            <div className="flex flex-wrap gap-1">
              {(["all", "character", "place", "item"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setBibleKindFilter(k)}
                  className={`rounded-full px-2.5 py-1 text-xs ${bibleKindFilter === k ? "bg-amber-700 text-white" : "bg-white/10 text-amber-100/80 hover:bg-white/20"}`}
                >
                  {k === "all" ? "Tất cả" : BIBLE_KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {s.entities.filter((e) => bibleKindFilter === "all" || e.kind === bibleKindFilter).map((e) => {
                const count = (mentionMap.get(e.id) ?? []).length;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEntityId(e.id)}
                      className={`w-full rounded-lg border p-3 text-left ${selectedEntityId === e.id ? "border-amber-400 bg-amber-50" : "border-stone-200 bg-white"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-stone-800">{e.name}</span>
                        <span className="shrink-0 text-xs text-stone-400">{BIBLE_KIND_LABEL[e.kind]}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        Nhắc ở {count} cảnh{e.worldRef ? ` · Sa bàn: ${e.worldRef.worldName}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {s.entities.filter((e) => bibleKindFilter === "all" || e.kind === bibleKindFilter).length === 0 && (
              <p className="text-sm text-amber-100/70">Chưa có thực thể nào.</p>
            )}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newEntityName.trim()) return;
                const created = await s.addEntity(newEntityKind, newEntityName);
                setNewEntityName("");
                if (created) setSelectedEntityId(created.id);
              }}
            >
              <input className="min-w-32 flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm" value={newEntityName} onChange={(e) => setNewEntityName(e.target.value)} placeholder="Tên thực thể mới…" />
              <select className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" value={newEntityKind} onChange={(e) => setNewEntityKind(e.target.value as BibleEntityKind)}>
                {(Object.keys(BIBLE_KIND_LABEL) as BibleEntityKind[]).map((k) => (
                  <option key={k} value={k}>
                    {BIBLE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">＋ Thêm</button>
            </form>
            {unknownList.length > 0 && (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
                <h4 className="text-sm font-semibold text-amber-900">Nhắc tới chưa có trong sổ tay</h4>
                <ul className="mt-2 space-y-1.5">
                  {unknownList.map((u) => (
                    <li key={u.token} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-stone-700">
                        @{u.token} <span className="text-xs text-stone-400">({u.sceneIds.length} cảnh)</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-md bg-amber-700 px-2 py-0.5 text-xs text-white"
                        onClick={async () => {
                          const created = await s.addEntity("character", u.token);
                          if (created) setSelectedEntityId(created.id);
                        }}
                      >
                        ＋ Thêm
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4">
            {!selectedEntity ? (
              <p className="text-sm text-stone-500">Chọn một thực thể bên trái để xem/sửa hồ sơ, hoặc thêm thực thể mới.</p>
            ) : (
              <div key={selectedEntity.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input className="rounded-md border border-stone-200 px-2 py-1 text-sm font-semibold outline-none focus:border-amber-400" defaultValue={selectedEntity.name} onBlur={(e) => void s.updateEntity(selectedEntity.id, { name: e.target.value })} />
                  <select className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs" defaultValue={selectedEntity.kind} onChange={(e) => void s.updateEntity(selectedEntity.id, { kind: e.target.value as BibleEntityKind })}>
                    {(Object.keys(BIBLE_KIND_LABEL) as BibleEntityKind[]).map((k) => (
                      <option key={k} value={k}>
                        {BIBLE_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <DeleteButton onDelete={() => { void s.deleteEntity(selectedEntity.id); setSelectedEntityId(null); }} />
                </div>
                <label className="block text-xs text-stone-500">
                  Vai trò
                  <input className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" defaultValue={selectedEntity.role} placeholder="VD: nhân vật chính, quán trọ ven đường…" onBlur={(e) => void s.updateEntity(selectedEntity.id, { role: e.target.value })} />
                </label>
                <label className="block text-xs text-stone-500">
                  Mô tả
                  <textarea className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" rows={3} defaultValue={selectedEntity.description} onBlur={(e) => void s.updateEntity(selectedEntity.id, { description: e.target.value })} />
                </label>
                <label className="block text-xs text-stone-500">
                  Tính cách / đặc điểm
                  <input className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" defaultValue={selectedEntity.traits} onBlur={(e) => void s.updateEntity(selectedEntity.id, { traits: e.target.value })} />
                </label>
                <label className="block text-xs text-stone-500">
                  Ghi chú
                  <textarea className="mt-1 w-full rounded-md border border-stone-200 px-2 py-1 text-sm text-stone-800 outline-none focus:border-amber-400" rows={2} defaultValue={selectedEntity.notes} onBlur={(e) => void s.updateEntity(selectedEntity.id, { notes: e.target.value })} />
                </label>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-medium text-stone-600">Liên kết tới vật trên sa bàn</p>
                  {selectedEntity.worldRef ? (
                    <p className="mt-1 text-sm text-stone-700">
                      {selectedEntity.worldRef.worldName} · {selectedEntity.worldRef.entityName}
                      <button type="button" className="ml-3 text-xs text-rose-600 hover:underline" onClick={() => void s.updateEntity(selectedEntity.id, { worldRef: null })}>
                        Gỡ liên kết
                      </button>
                    </p>
                  ) : worlds === null ? (
                    <p className="mt-1 text-xs text-stone-400">Đang tải sa bàn…</p>
                  ) : worlds.length === 0 ? (
                    <p className="mt-1 text-xs text-stone-400">Chưa có world nào — tạo world ở World Builder trước.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <select className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs" value={pickWorldId} onChange={(e) => { setPickWorldId(e.target.value); setPickEntityId(""); }}>
                        <option value="">— chọn world —</option>
                        {worlds.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <select className="rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs" value={pickEntityId} onChange={(e) => setPickEntityId(e.target.value)}>
                        <option value="">— chọn thực thể —</option>
                        {(worlds.find((w) => w.id === pickWorldId)?.state.entities ?? []).map((we) => (
                          <option key={we.id} value={we.id}>
                            {we.name} ({we.kind === "character" ? "Nhân vật" : we.kind === "place" ? "Địa điểm" : we.kind === "event" ? "Sự kiện" : we.kind})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!pickWorldId || !pickEntityId}
                        className="rounded-md bg-amber-700 px-2 py-1 text-xs text-white disabled:opacity-50"
                        onClick={() => {
                          const w = worlds.find((x) => x.id === pickWorldId);
                          const we = w?.state.entities.find((x) => x.id === pickEntityId);
                          if (!w || !we) return;
                          void s.updateEntity(selectedEntity.id, { worldRef: { worldId: w.id, worldName: w.name, entityId: we.id, entityName: we.name } });
                        }}
                      >
                        Gắn
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-600">Được nhắc tới ở</p>
                  {(mentionMap.get(selectedEntity.id) ?? []).length === 0 ? (
                    <p className="mt-1 text-xs text-stone-400">Chưa có cảnh nào nhắc tới thực thể này.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {(mentionMap.get(selectedEntity.id) ?? []).map((sceneId) => (
                        <li key={sceneId}>
                          <button type="button" className="text-xs text-amber-700 hover:underline" onClick={() => onOpenScene(sceneId)}>
                            {sceneLabel.get(sceneId) ?? "Cảnh"} →
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "versions" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-amber-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-stone-800">Xuất bản</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                {(Object.keys(EXPORT_FORMAT_LABEL) as ExportFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {EXPORT_FORMAT_LABEL[f]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-stone-700">
                <input type="checkbox" checked={includeOutline} onChange={(e) => setIncludeOutline(e.target.checked)} />
                Kèm dàn ý
              </label>
              <label className="flex items-center gap-1.5 text-sm text-stone-700">
                <input type="checkbox" checked={includeBible} onChange={(e) => setIncludeBible(e.target.checked)} />
                Kèm phụ lục sổ tay
              </label>
              <button type="button" disabled={exporting || !currentData} className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white disabled:opacity-50" onClick={() => void runExport(currentData, exportFormat)}>
                {exporting ? "Đang tạo file…" : "Tải xuống bản hiện tại"}
              </button>
            </div>
            {exportError && <p className="mt-2 text-xs text-rose-600">{exportError}</p>}
            <p className="mt-2 text-xs text-stone-400">File được tạo trực tiếp trên máy của bạn, không qua server.</p>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-amber-100">Phiên bản đã chụp</h3>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await s.takeSnapshot(snapName, snapNote);
                setSnapName("");
                setSnapNote("");
              }}
            >
              <input className="min-w-40 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-amber-50 placeholder:text-amber-100/50" value={snapName} onChange={(e) => setSnapName(e.target.value)} placeholder="Tên phiên bản (để trống = tự đặt theo ngày giờ)" />
              <input className="min-w-40 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-amber-50 placeholder:text-amber-100/50" value={snapNote} onChange={(e) => setSnapNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn)" />
              <button type="submit" className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm text-white">Chụp phiên bản</button>
            </form>
            <ul className="space-y-3">
              {s.snapshots.map((snap) => (
                <li key={snap.id} className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-stone-800">{snap.name}</p>
                    <span className="text-xs text-stone-400">
                      {new Date(snap.createdAt).toLocaleString("vi-VN")} · {snap.wordCount} từ
                    </span>
                  </div>
                  {snap.note && <p className="mt-1 text-xs text-stone-500">{snap.note}</p>}
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button type="button" disabled={exporting} className="text-xs text-amber-700 hover:underline disabled:opacity-50" onClick={() => void runExport(snap.data, exportFormat)}>
                      Xuất bản này
                    </button>
                    <DeleteButton label="Khôi phục" onDelete={async () => { setRestoringId(snap.id); await s.restoreSnapshot(snap.id); setRestoringId(null); }} />
                    {restoringId === snap.id && <span className="text-xs text-stone-400">Đang khôi phục…</span>}
                    <DeleteButton onDelete={() => void s.deleteSnapshot(snap.id)} />
                  </div>
                </li>
              ))}
            </ul>
            {s.snapshots.length === 0 && <p className="text-sm text-amber-100/70">Chưa có phiên bản nào. Chụp một bản trước khi sửa lớn để luôn có đường lui.</p>}
          </section>
        </div>
      )}
      {tab === "bridges" && <BridgeView s={s} authenticatedFetch={authenticatedFetch} />}
    </div>
  );
}
