"use client";

import { useMemo, useState } from "react";
import {
  arcGapWarnings,
  BEAT_KIND_LABEL,
  SCENE_STATUS_LABEL,
  sceneWords,
  sortBeatsByScene,
  type BeatKind,
  type SceneStatus,
} from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";

type OutlineTab = "cards" | "plotlines" | "arcs";

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

export default function OutlineView({ s, onOpenScene }: { s: NovelStudioState; onOpenScene: (sceneId: string) => void }) {
  const [tab, setTab] = useState<OutlineTab>("cards");
  const [dragId, setDragId] = useState<string | null>(null);
  const [newPlotTitle, setNewPlotTitle] = useState("");
  const [newArcName, setNewArcName] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newBeat, setNewBeat] = useState<Record<string, { title: string; kind: BeatKind; sceneId: string }>>({});
  const [newMilestone, setNewMilestone] = useState<Record<string, { sceneId: string; note: string }>>({});

  const positionByScene = useMemo(() => new Map(s.novelScenes.map((sc, i) => [sc.id, i])), [s.novelScenes]);
  const sceneLabel = useMemo(() => {
    const chapterTitle = new Map(s.chapters.map((c) => [c.id, c.title]));
    return new Map(s.novelScenes.map((sc) => [sc.id, `${chapterTitle.get(sc.chapterId) ?? "?"} · ${sc.title}`]));
  }, [s.chapters, s.novelScenes]);

  if (!s.selectedNovel) {
    return <p className="text-sm text-stone-500">Chưa có tiểu thuyết nào. Tạo tiểu thuyết ở view Viết trước.</p>;
  }

  const tabBtn = (key: OutlineTab, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
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
      </div>

      {tab === "cards" && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {s.chapters.map((chapter) => {
            const cards = s.novelScenes.filter((sc) => sc.chapterId === chapter.id);
            return (
              <section
                key={chapter.id}
                className="w-72 shrink-0 rounded-xl border border-stone-200 bg-stone-50 p-3"
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
                    </article>
                  ))}
                  {cards.length === 0 && <p className="text-xs text-stone-400">Chưa có cảnh. Kéo cảnh từ chương khác vào đây.</p>}
                </div>
              </section>
            );
          })}
          {s.chapters.length === 0 && <p className="text-sm text-stone-500">Chưa có chương nào.</p>}
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
          {s.plotlines.length === 0 && <p className="text-sm text-stone-500">Chưa có tuyến truyện nào. Thêm tuyến đầu tiên ở trên.</p>}
        </div>
      )}

      {tab === "arcs" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-stone-800">Cung nhân vật</h3>
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
            {s.arcs.length === 0 && <p className="text-sm text-stone-500">Chưa có cung nhân vật nào.</p>}
          </section>

          <section className="space-y-4 border-t border-stone-200 pt-4">
            <h3 className="text-sm font-semibold text-stone-800">Câu hỏi mở</h3>
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
            {s.questions.length === 0 && <p className="text-sm text-stone-500">Chưa có câu hỏi mở nào.</p>}
          </section>
        </div>
      )}
    </div>
  );
}
