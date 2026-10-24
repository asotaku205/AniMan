/**
 * Cây sách Novel Studio (N1): tiểu thuyết → chương → cảnh.
 * Chọn để viết, thêm/đổi tên/xoá (xoá bấm 2 lần), lên/xuống đổi thứ tự.
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { sceneWords } from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";

type Editing = { kind: "novel" | "chapter" | "scene"; id: string } | null;

function RowActions({
  onUp,
  onDown,
  onRename,
  onDelete,
  confirm,
  onConfirmDelete,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onRename: () => void;
  onDelete: () => void;
  confirm: boolean;
  onConfirmDelete: () => void;
}) {
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {onUp && (
        <button onClick={onUp} aria-label="Lên" className="text-amber-100/40 hover:text-amber-100 p-0.5">
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      )}
      {onDown && (
        <button onClick={onDown} aria-label="Xuống" className="text-amber-100/40 hover:text-amber-100 p-0.5">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
      <button onClick={onRename} aria-label="Đổi tên" className="text-amber-100/40 hover:text-amber-100 p-0.5">
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={confirm ? onConfirmDelete : onDelete}
        aria-label="Xoá"
        className={confirm ? "text-rose-300 font-medium text-[11px] px-1" : "text-amber-100/40 hover:text-rose-300 p-0.5"}
      >
        {confirm ? "Chắc chắn?" : <Trash2 className="w-3 h-3" />}
      </button>
    </span>
  );
}

export function NovelBinder({ s }: { s: NovelStudioState }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [newNovel, setNewNovel] = useState("");
  const [newChapter, setNewChapter] = useState("");
  const [newScene, setNewScene] = useState("");

  const startEdit = (kind: "novel" | "chapter" | "scene", id: string, title: string) => {
    setEditing({ kind, id });
    setDraftTitle(title);
  };

  const commitEdit = () => {
    if (!editing || !draftTitle.trim()) {
      setEditing(null);
      return;
    }
    if (editing.kind === "novel") void s.renameNovel(editing.id, draftTitle);
    if (editing.kind === "chapter") void s.renameChapter(editing.id, draftTitle);
    if (editing.kind === "scene") void s.renameScene(editing.id, draftTitle);
    setEditing(null);
  };

  const askDelete = (id: string) => setConfirmId(id);

  const titleInput = (
    <input
      autoFocus
      value={draftTitle}
      onChange={(e) => setDraftTitle(e.currentTarget.value)}
      onBlur={commitEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitEdit();
        if (e.key === "Escape") setEditing(null);
      }}
      className="flex-1 min-w-0 h-7 rounded bg-black/40 border border-amber-200/30 px-2 text-[13px] text-amber-50 outline-none"
    />
  );

  return (
    <div className="sticky top-6 rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 backdrop-blur p-4 space-y-5 shadow-2xl">
      <div>
        <h3 className="text-amber-100/90 font-medium mb-2" style={{ fontFamily: "Shippori Mincho, serif" }}>
          Tiểu thuyết
        </h3>
        <div className="space-y-1">
          {s.novels.map((n) => (
            <div
              key={n.id}
              className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer ${n.id === s.selectedNovelId ? "bg-amber-100/15 text-amber-50 font-medium" : "text-amber-50/70 hover:bg-white/5"}`}
              onClick={() => s.selectNovel(n.id)}
            >
              {editing?.kind === "novel" && editing.id === n.id ? (
                titleInput
              ) : (
                <span className="flex-1 min-w-0 truncate text-[13px]">{n.title}</span>
              )}
              <RowActions
                onRename={() => startEdit("novel", n.id, n.title)}
                onDelete={() => askDelete(n.id)}
                confirm={confirmId === n.id}
                onConfirmDelete={() => {
                  void s.deleteNovel(n.id);
                  setConfirmId(null);
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2">
          <input
            value={newNovel}
            onChange={(e) => setNewNovel(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newNovel.trim()) {
                void s.addNovel(newNovel);
                setNewNovel("");
              }
            }}
            placeholder="Tên tiểu thuyết mới…"
            className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[13px] text-amber-50 outline-none placeholder:text-amber-50/30"
          />
          <button
            onClick={() => {
              if (newNovel.trim()) {
                void s.addNovel(newNovel);
                setNewNovel("");
              }
            }}
            className="h-8 px-2.5 rounded-lg bg-amber-400 text-amber-950 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Tạo
          </button>
        </div>
      </div>

      {s.selectedNovel && (
        <div>
          <h3 className="text-amber-100/90 font-medium mb-2" style={{ fontFamily: "Shippori Mincho, serif" }}>
            Chương · {s.selectedNovel.title}
          </h3>
          <div className="space-y-1">
            {s.chapters.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer ${c.id === s.selectedChapterId ? "bg-amber-100/15 text-amber-50 font-medium" : "text-amber-50/70 hover:bg-white/5"}`}
                onClick={() => s.selectChapter(c.id)}
              >
                {editing?.kind === "chapter" && editing.id === c.id ? (
                  titleInput
                ) : (
                  <span className="flex-1 min-w-0 truncate text-[13px]">{c.title}</span>
                )}
                <RowActions
                  onUp={() => void s.moveChapter(c.id, -1)}
                  onDown={() => void s.moveChapter(c.id, 1)}
                  onRename={() => startEdit("chapter", c.id, c.title)}
                  onDelete={() => askDelete(c.id)}
                  confirm={confirmId === c.id}
                  onConfirmDelete={() => {
                    void s.deleteChapter(c.id);
                    setConfirmId(null);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input
              value={newChapter}
              onChange={(e) => setNewChapter(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChapter.trim()) {
                  void s.addChapter(newChapter);
                  setNewChapter("");
                }
              }}
              placeholder="Tên chương mới…"
              className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[13px] text-amber-50 outline-none placeholder:text-amber-50/30"
            />
            <button
              onClick={() => {
                if (newChapter.trim()) {
                  void s.addChapter(newChapter);
                  setNewChapter("");
                }
              }}
              className="h-8 px-2.5 rounded-lg bg-amber-400 text-amber-950 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </div>
      )}

      {s.selectedChapter && (
        <div>
          <h3 className="text-amber-100/90 font-medium mb-2" style={{ fontFamily: "Shippori Mincho, serif" }}>
            Cảnh · {s.selectedChapter.title}
          </h3>
          <div className="space-y-1">
            {s.scenes.map((sc) => (
              <div
                key={sc.id}
                className={`flex items-center gap-1 pl-4 pr-2 py-1.5 rounded cursor-pointer ${sc.id === s.selectedSceneId ? "bg-amber-100/15 text-amber-50 font-medium" : "text-amber-50/70 hover:bg-white/5"}`}
                onClick={() => s.selectScene(sc.id)}
              >
                {editing?.kind === "scene" && editing.id === sc.id ? (
                  titleInput
                ) : (
                  <span className="flex-1 min-w-0 truncate text-[13px]">
                    {sc.title} <span className="text-amber-50/40 text-[11px]">· {sceneWords(sc)} từ</span>
                  </span>
                )}
                <RowActions
                  onUp={() => void s.moveScene(sc.id, -1)}
                  onDown={() => void s.moveScene(sc.id, 1)}
                  onRename={() => startEdit("scene", sc.id, sc.title)}
                  onDelete={() => askDelete(sc.id)}
                  confirm={confirmId === sc.id}
                  onConfirmDelete={() => {
                    void s.deleteScene(sc.id);
                    setConfirmId(null);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input
              value={newScene}
              onChange={(e) => setNewScene(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newScene.trim()) {
                  void s.addScene(newScene);
                  setNewScene("");
                }
              }}
              placeholder="Tên cảnh mới…"
              className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[13px] text-amber-50 outline-none placeholder:text-amber-50/30"
            />
            <button
              onClick={() => {
                if (newScene.trim()) {
                  void s.addScene(newScene);
                  setNewScene("");
                }
              }}
              className="h-8 px-2.5 rounded-lg bg-amber-400 text-amber-950 text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
