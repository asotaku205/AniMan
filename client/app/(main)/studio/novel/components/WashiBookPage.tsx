"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { StickyNotesMargin } from "./StickyNotesMargin";
import { BIBLE_KIND_LABEL } from "../lib/novel";
import type { NovelStudioState } from "../hooks/useNovelStudio";

interface MentionState {
  query: string;
  node: Text;
  start: number;
  offset: number;
  top: number;
  left: number;
}

function Page({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div
      className={`relative aspect-[3/4] p-10 ${right ? "rounded-r-[6px]" : "rounded-l-[6px]"} bg-[#f3e6c8]`}
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(120,80,40,0.08), transparent 60%), radial-gradient(circle at 80% 70%, rgba(120,80,40,0.1), transparent 60%), repeating-linear-gradient(0deg, rgba(120,80,40,0.04) 0 1px, transparent 1px 28px)",
      }}
    >
      <div className={`absolute inset-y-0 ${right ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"} from-black/30 to-transparent w-10 pointer-events-none`} />
      {children}
    </div>
  );
}

export function WashiBookPage({ s }: { s: NovelStudioState }) {
  const [mention, setMention] = useState<MentionState | null>(null);

  useEffect(() => {
    setMention(null);
  }, [s.selectedSceneId]);

  const updateMention = (div: HTMLDivElement) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) {
      setMention(null);
      return;
    }
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !div.contains(node)) {
      setMention(null);
      return;
    }
    const textBefore = (node.textContent ?? "").slice(0, sel.anchorOffset);
    const m = /@([\p{L}\p{N} ]*)$/u.exec(textBefore);
    if (!m) {
      setMention(null);
      return;
    }
    const rect = sel.getRangeAt(0).cloneRange().getBoundingClientRect();
    setMention({
      query: m[1],
      node: node as Text,
      start: m.index,
      offset: sel.anchorOffset,
      top: rect.bottom + 4,
      left: rect.left,
    });
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    s.onSceneInput();
    updateMention(e.currentTarget);
  };

  const insertMention = (name: string) => {
    if (!mention) return;
    const range = document.createRange();
    range.setStart(mention.node, mention.start);
    range.setEnd(mention.node, mention.offset);
    range.deleteContents();
    const textNode = document.createTextNode(`@${name} `);
    range.insertNode(textNode);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.setStart(textNode, textNode.length);
      r.collapse(true);
      sel.addRange(r);
    }
    setMention(null);
    s.onSceneInput();
  };

  const suggestions = mention
    ? s.entities.filter((e) => e.name.toLowerCase().includes(mention.query.trim().toLowerCase())).slice(0, 8)
    : [];

  if (s.loading) {
    return (
      <div className="relative mx-auto w-full max-w-4xl rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 p-8 text-amber-100/70 text-sm">
        Đang tải tiểu thuyết…
      </div>
    );
  }
  if (!s.selectedScene) {
    return (
      <div className="relative mx-auto w-full max-w-4xl rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 p-8 space-y-3 shadow-2xl">
        <p className="text-amber-100/90 font-medium" style={{ fontFamily: "Shippori Mincho, serif" }}>
          {s.selectedChapter ? "Chương này chưa có cảnh nào" : "Chưa chọn chương"}
        </p>
        <p className="text-amber-100/60 text-sm leading-relaxed">
          Tạo cảnh ở cây sách bên trái rồi bấm vào cảnh để bắt đầu viết — nội dung được lưu tự động.
        </p>
        {s.selectedChapter && (
          <button
            onClick={() => void s.addScene("Cảnh 1")}
            className="h-9 px-4 rounded-lg bg-amber-400 text-amber-950 text-sm font-semibold"
          >
            Tạo cảnh đầu tiên
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <motion.div
        initial={{ rotateX: 12, opacity: 0 }}
        whileInView={{ rotateX: 4, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="relative [perspective:1500px]"
      >
        <div
          className="relative grid grid-cols-2 rounded-[8px] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.8)] [transform-style:preserve-3d]"
          style={{ transform: "rotateX(6deg)" }}
        >
          <div className="absolute -inset-4 rounded-[14px] bg-gradient-to-br from-[#5a2a13] via-[#3a1908] to-[#2a1206] -z-10 shadow-inner" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-[#3a1908] via-[#1a0a04] to-[#3a1908] z-10" />

          {/* Left page */}
          <Page>
            <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-[#3a2412]/90 text-sm tracking-widest mb-6 text-center font-medium">
              {s.selectedChapter?.title ?? ""} — {s.selectedScene.title}
            </div>
            <div
              ref={s.leftRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={(e) => { if (e.key === "Escape") setMention(null); }}
              style={{ fontFamily: s.font }}
              className="text-[#2a1a0a] text-2xl leading-[1.7] outline-none min-h-[280px] focus:bg-amber-50/20 rounded px-1"
            />
          </Page>

          {/* Right page */}
          <Page right>
            <div
              ref={s.rightRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={(e) => { if (e.key === "Escape") setMention(null); }}
              style={{ fontFamily: s.font }}
              className="text-[#2a1a0a] text-2xl leading-[1.7] outline-none min-h-[280px] focus:bg-amber-50/20 rounded px-1"
            />
            <div className="mt-10 text-right" style={{ fontFamily: "Shippori Mincho, serif" }}>
              <span className="text-[#3a2412]/60 text-xs">— SakuraStream · trang 128</span>
            </div>
          </Page>
        </div>

        {/* Sticky notes margin */}
        <StickyNotesMargin notes={s.notes} setNotes={s.setNotes} />

        {/* Word count badge */}
        <div className="absolute -bottom-4 right-4 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold shadow-lg">
          {s.wordCount} từ
        </div>

        <div className="absolute -bottom-6 left-10 w-56 h-3 rounded-full bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-900 shadow-[0_10px_20px_rgba(0,0,0,0.6)] rotate-[-8deg]" />
      </motion.div>

      {mention && suggestions.length > 0 && (
        <div
          className="fixed z-50 max-h-64 w-64 overflow-auto rounded-xl border border-amber-200 bg-white p-1 shadow-2xl"
          style={{ top: mention.top, left: mention.left }}
        >
          {suggestions.map((e) => (
            <button
              key={e.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-stone-800 hover:bg-amber-50"
              onMouseDown={(ev) => {
                ev.preventDefault();
                insertMention(e.name);
              }}
            >
              <span>@{e.name}</span>
              <span className="text-xs text-stone-400">{BIBLE_KIND_LABEL[e.kind]}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={s.addNote}
        className="mt-10 inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Ghi chú lề mới
      </button>
    </div>
  );
}
