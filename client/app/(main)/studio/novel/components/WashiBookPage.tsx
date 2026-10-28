"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { StickyNotesMargin } from "./StickyNotesMargin";
import { BIBLE_KIND_LABEL } from "../lib/novel";
import { joinSceneText, paginateTextToFit } from "../lib/pagination";
import type { NovelStudioState } from "../hooks/useNovelStudio";

interface MentionState {
  query: string;
  node: Text;
  start: number;
  offset: number;
  top: number;
  left: number;
}

type DisplayTheme = "paper" | "sepia" | "dark" | "night";

export const PAGE_THEME: Record<DisplayTheme, { bg: string; text: string; label: string; light: boolean }> = {
  paper: { bg: "#f5eedb", text: "#1f130a", label: "Giấy", light: true },
  sepia: { bg: "#ede0c8", text: "#2a1a08", label: "Sepia", light: true },
  dark: { bg: "#1e1b2e", text: "#ddd6ee", label: "Tối", light: false },
  night: { bg: "#141414", text: "#c9c2b4", label: "Đêm", light: false },
};

const EDITOR_SIZE: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
};

const LINE_HEIGHT: Record<"normal" | "relaxed" | "loose", number> = {
  normal: 1.6,
  relaxed: 1.8,
  loose: 2.1,
};

function paginateToRenderedPage(text: string, pageContent: HTMLElement): string[] {
  const computed = window.getComputedStyle(pageContent);
  const probe = document.createElement("div");
  Object.assign(probe.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: "border-box",
    width: `${pageContent.clientWidth}px`,
    height: `${pageContent.clientHeight}px`,
    margin: "0",
    padding: "0",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "normal",
    fontFamily: computed.fontFamily,
    fontSize: computed.fontSize,
    fontWeight: computed.fontWeight,
    fontStyle: computed.fontStyle,
    lineHeight: computed.lineHeight,
    letterSpacing: computed.letterSpacing,
    wordSpacing: computed.wordSpacing,
    textIndent: computed.textIndent,
  });
  document.body.appendChild(probe);
  try {
    return paginateTextToFit(text, (candidate) => {
      probe.textContent = candidate;
      return probe.scrollHeight <= probe.clientHeight + 1;
    });
  } finally {
    probe.remove();
  }
}

function Page({ children, right, theme }: { children: React.ReactNode; right?: boolean; theme: DisplayTheme }) {
  const t = PAGE_THEME[theme];
  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden px-7 py-8 pb-14 sm:px-10 sm:py-10 sm:pb-14 ${right ? "rounded-r-[6px]" : "rounded-l-[6px]"}`}
      style={{
        backgroundColor: t.bg,
        color: t.text,
        backgroundImage: t.light
          ? "radial-gradient(circle at 20% 30%, rgba(120,80,40,0.08), transparent 60%), radial-gradient(circle at 80% 70%, rgba(120,80,40,0.1), transparent 60%), repeating-linear-gradient(0deg, rgba(120,80,40,0.04) 0 1px, transparent 1px 28px)"
          : undefined,
      }}
    >
      <div className={`absolute inset-y-0 ${right ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l"} from-black/20 to-transparent w-10 pointer-events-none`} />
      {children}
    </div>
  );
}

export function WashiBookPage({ s }: { s: NovelStudioState }) {
  const [mention, setMention] = useState<MentionState | null>(null);
  const studioPageRef = useRef<HTMLDivElement>(null);
  const bookTextRef = useRef<HTMLDivElement>(null);
  const [bookPages, setBookPages] = useState([""]);

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

  // Cảnh kề nhau trong toàn truyện (theo thứ tự đọc) — nút lật trang.
  const sceneOrder = s.novelScenes;
  const currentIdx = sceneOrder.findIndex(
    (sc) => sc.id === s.selectedScene?.id,
  );
  const prevScene = currentIdx > 0 ? sceneOrder[currentIdx - 1] : null;
  const nextScene =
    currentIdx >= 0 && currentIdx < sceneOrder.length - 1
      ? sceneOrder[currentIdx + 1]
      : null;
  const pageTheme = PAGE_THEME[s.displayTheme];
  // Chế độ mặc định nhìn như một dòng chảy liền mạch kiểu Wattpad nên
  // phím mũi tên qua điểm nối 2 trang cũng phải nhảy sang trang kia.
  const focusEditableEdge = (el: HTMLElement | null, atStart: boolean) => {
    if (!el) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(atStart);
    sel.removeAllRanges();
    sel.addRange(range);
    el.focus();
  };
  const handleDefaultKeyDown = (
    e: React.KeyboardEvent,
    side: "left" | "right",
  ) => {
    if (e.key === "Escape") {
      setMention(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rects = sel.getRangeAt(0).getClientRects();
    if (rects.length === 0) return;
    if (side === "left" && e.key === "ArrowDown") {
      const el = s.leftRef.current;
      if (!el) return;
      const last = rects[rects.length - 1];
      if (last.bottom >= el.getBoundingClientRect().bottom - 4) {
        e.preventDefault();
        focusEditableEdge(s.rightRef.current, true);
      }
    }
    if (side === "right" && e.key === "ArrowUp") {
      const el = s.rightRef.current;
      if (!el) return;
      const first = rects[0];
      if (first.top <= el.getBoundingClientRect().top + 4) {
        e.preventDefault();
        focusEditableEdge(s.leftRef.current, false);
      }
    }
  };
  // Lật giấy thật: khi đổi cảnh ở chế độ quyển, trang cũ (nội dung thật
  // của cảnh vừa rời) xoay quanh gáy để lộ trải mới bên dưới — trải mới
  // đã được nạp đủ nội dung trước khi lật, nên không còn đường mất nội
  // dung như kiểu AnimatePresence mode="wait" trước đây (trang mới mount
  // trễ, effect nạp nhầm vào trang cũ đang thoát).
  const flipDirRef = useRef<1 | -1>(1);
  const prevSceneIdRef = useRef<string | null>(null);
  const scenesRef = useRef(s.novelScenes);
  scenesRef.current = s.novelScenes;
  const [flip, setFlip] = useState<{
    content: string;
    dir: 1 | -1;
    key: number;
  } | null>(null);
  useEffect(() => {
    const prevId = prevSceneIdRef.current;
    prevSceneIdRef.current = s.selectedScene?.id ?? null;
    if (!prevId || prevId === s.selectedScene?.id || s.writeMode !== "book") {
      return;
    }
    const outgoing = scenesRef.current.find((sc) => sc.id === prevId);
    if (!outgoing) return;
    const dir = flipDirRef.current;
    setFlip({
      content: dir === 1 ? outgoing.contentRight : outgoing.contentLeft,
      dir,
      key: Date.now(),
    });
    const t = setTimeout(() => setFlip(null), 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.selectedScene?.id, s.writeMode]);
  // Khi đổi chế độ hiển thị, khung soạn thảo mount lại nên nạp lại nội
  // dung từ state (effect theo [selectedSceneId] của hook không chạy
  // khi chỉ đổi chế độ mà không đổi cảnh).
  useEffect(() => {
    if (s.leftRef.current && s.selectedScene) {
      s.leftRef.current.innerText = s.selectedScene.contentLeft;
    }
    if (s.rightRef.current && s.selectedScene) {
      s.rightRef.current.innerText = s.selectedScene.contentRight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.writeMode]);

  // Chế độ quyển sách là bản xem trước; nội dung được phân trang theo vùng
  // chữ thật trên giấy. Việc soạn thảo vẫn dùng hai ô nội dung bên dưới.
  const [spreadIdx, setSpreadIdx] = useState(0);
  const wantLastSpreadRef = useRef(false);
  const flipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneText = s.selectedScene
    ? joinSceneText(s.selectedScene.contentLeft, s.selectedScene.contentRight)
    : "";
  useLayoutEffect(() => {
    if (s.writeMode !== "book") return;
    const pageContent = bookTextRef.current;
    if (!pageContent) return;

    let active = true;
    const paginate = () => {
      if (!active || !pageContent.clientWidth || !pageContent.clientHeight) return;
      const nextPages = paginateToRenderedPage(sceneText, pageContent);
      setBookPages((current) => {
        const unchanged =
          current.length === nextPages.length &&
          current.every((page, i) => page === nextPages[i]);
        return unchanged ? current : nextPages;
      });
    };

    paginate();
    const observer = new ResizeObserver(paginate);
    observer.observe(pageContent);
    const fontSet = document.fonts;
    fontSet?.ready.then(paginate);
    fontSet?.addEventListener("loadingdone", paginate);
    return () => {
      active = false;
      observer.disconnect();
      fontSet?.removeEventListener("loadingdone", paginate);
    };
  }, [sceneText, s.writeMode, s.font, s.displayFontSize, s.displayLineHeight]);
  const maxSpread = Math.max(0, Math.ceil(bookPages.length / 2) - 1);
  const safeSpread = Math.min(spreadIdx, maxSpread);
  const leftPageNo = safeSpread * 2 + 1;
  const rightPageNo = Math.min(safeSpread * 2 + 2, bookPages.length);
  const pageLabel =
    rightPageNo > leftPageNo
      ? `Trang ${leftPageNo}-${rightPageNo} / ${bookPages.length}`
      : `Trang ${leftPageNo} / ${bookPages.length}`;
  useEffect(() => {
    const sc = s.selectedScene;
    if (!sc) {
      setSpreadIdx(0);
      return;
    }
    if (wantLastSpreadRef.current) {
      wantLastSpreadRef.current = false;
      const pg = bookTextRef.current
        ? paginateToRenderedPage(joinSceneText(sc.contentLeft, sc.contentRight), bookTextRef.current)
        : bookPages;
      setSpreadIdx(Math.max(0, Math.ceil(pg.length / 2) - 1));
    } else {
      setSpreadIdx(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.selectedScene?.id]);
  const showSpreadFlip = (content: string, dir: 1 | -1) => {
    if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    setFlip({ content, dir, key: Date.now() });
    flipTimeoutRef.current = setTimeout(() => setFlip(null), 750);
  };
  const goNextSpread = () => {
    studioPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (safeSpread < maxSpread) {
      showSpreadFlip(bookPages[safeSpread * 2 + 1] ?? "", 1);
      setSpreadIdx(safeSpread + 1);
    } else if (nextScene) {
      flipDirRef.current = 1;
      s.selectScene(nextScene.id);
    }
  };
  const goPrevSpread = () => {
    studioPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (safeSpread > 0) {
      showSpreadFlip(bookPages[safeSpread * 2] ?? "", -1);
      setSpreadIdx(safeSpread - 1);
    } else if (prevScene) {
      wantLastSpreadRef.current = true;
      flipDirRef.current = -1;
      s.selectScene(prevScene.id);
    }
  };

  if (s.loading) {
    return (
      <div className="relative mx-auto w-full max-w-7xl rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 p-8 text-amber-100/70 text-sm">
        Đang tải tiểu thuyết…
      </div>
    );
  }
  if (!s.selectedScene) {
    return (
      <div className="relative mx-auto w-full max-w-6xl rounded-2xl border border-amber-200/15 bg-[#1c1208]/90 p-8 space-y-3 shadow-2xl">
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
    <div ref={studioPageRef} className="relative mx-auto w-full max-w-6xl scroll-mt-20">
      {/* Chế độ hiển thị — giống bên đọc tiểu thuyết */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur">
        <span className="text-xs text-amber-100/70">Cỡ chữ</span>
        {(["sm", "md", "lg", "xl"] as const).map((sz) => (
          <button
            key={sz}
            type="button"
            onClick={() => s.setDisplayFontSize(sz)}
            className={`h-7 w-7 rounded-lg border text-xs transition ${s.displayFontSize === sz ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-transparent text-amber-100/60 hover:text-amber-100"}`}
          >
            {sz.toUpperCase()}
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <span className="text-xs text-amber-100/70">Giao diện</span>
        {(Object.keys(PAGE_THEME) as DisplayTheme[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => s.setDisplayTheme(t)}
            title={PAGE_THEME[t].label}
            className="h-5 w-5 rounded-full border-2 transition"
            style={{ borderColor: s.displayTheme === t ? "#fbbf24" : "transparent" }}
          >
            <div className="h-full w-full rounded-full" style={{ background: PAGE_THEME[t].bg }} />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-white/10" />
        <span className="text-xs text-amber-100/70">Giãn dòng</span>
        {(["normal", "relaxed", "loose"] as const).map((lh) => (
          <button
            key={lh}
            type="button"
            onClick={() => s.setDisplayLineHeight(lh)}
            className={`rounded-lg border px-2 py-1 text-xs transition ${s.displayLineHeight === lh ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-transparent text-amber-100/60 hover:text-amber-100"}`}
          >
            {lh === "normal" ? "Chật" : lh === "relaxed" ? "Vừa" : "Rộng"}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => s.setWriteMode("book")}
            className={`rounded-lg border px-2 py-1 text-xs transition ${s.writeMode === "book" ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-transparent text-amber-100/60 hover:text-amber-100"}`}
          >
            Quyển sách
          </button>
          <button
            type="button"
            onClick={() => s.setWriteMode("default")}
            className={`rounded-lg border px-2 py-1 text-xs transition ${s.writeMode === "default" ? "border-amber-400/70 bg-amber-400/20 text-amber-200" : "border-transparent text-amber-100/60 hover:text-amber-100"}`}
          >
            Mặc định
          </button>
        </div>
      </div>
      {s.writeMode === "book" ? (
      <motion.div
        initial={{ rotateX: 12, opacity: 0 }}
        whileInView={{ rotateX: 4, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="relative [perspective:1500px]"
      >
        <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-sm tracking-widest mb-6 text-center font-medium opacity-80 text-amber-100">
          {s.selectedChapter?.title ?? ""} - {s.selectedScene.title}
        </div>
        <div
          className="relative grid grid-cols-2 rounded-[8px] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.8)] [transform-style:preserve-3d]"
          style={{ transform: "rotateX(6deg)" }}
        >
          <div className="absolute -inset-4 rounded-[14px] bg-gradient-to-br from-[#5a2a13] via-[#3a1908] to-[#2a1206] -z-10 shadow-inner" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-[#3a1908] via-[#1a0a04] to-[#3a1908] z-10" />

          {/* Left page */}
          <Page theme={s.displayTheme}>
            <div
              ref={bookTextRef}
              style={{ fontFamily: s.font, lineHeight: LINE_HEIGHT[s.displayLineHeight] }}
              className={`${EDITOR_SIZE[s.displayFontSize]} h-full w-full overflow-hidden whitespace-pre-wrap break-words`}
            >
              {bookPages[safeSpread * 2] ?? ""}
            </div>
          </Page>

          {/* Right page */}
          <Page right theme={s.displayTheme}>
            <div
              style={{ fontFamily: s.font, lineHeight: LINE_HEIGHT[s.displayLineHeight] }}
              className={`${EDITOR_SIZE[s.displayFontSize]} h-full w-full overflow-hidden whitespace-pre-wrap break-words`}
            >
              {bookPages[safeSpread * 2 + 1] ?? ""}
            </div>
          </Page>
          {flip && (
            <motion.div
              key={flip.key}
              className="absolute inset-y-0 z-20 w-1/2 pointer-events-none [transform-style:preserve-3d]"
              style={{
                ...(flip.dir === 1 ? { right: 0 } : { left: 0 }),
                transformOrigin:
                  flip.dir === 1 ? "left center" : "right center",
              }}
              initial={{ rotateY: 0, opacity: 1 }}
              animate={{
                rotateY: flip.dir === 1 ? -180 : 180,
                opacity: 0,
              }}
              transition={{
                rotateY: { duration: 0.7, ease: "easeInOut" },
                opacity: { duration: 0.15, delay: 0.55 },
              }}
              onAnimationComplete={() => setFlip(null)}
            >
              <div
                className="absolute inset-0 overflow-hidden px-7 py-8 pb-14 sm:px-10 sm:py-10 sm:pb-14"
                style={{
                  backfaceVisibility: "hidden",
                  backgroundColor: pageTheme.bg,
                  color: pageTheme.text,
                }}
              >
                <p
                  style={{
                    fontFamily: s.font,
                    lineHeight: LINE_HEIGHT[s.displayLineHeight],
                  }}
                  className={`${EDITOR_SIZE[s.displayFontSize]} whitespace-pre-wrap`}
                >
                  {flip.content}
                </p>
              </div>
              <div
                className="absolute inset-0"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  backgroundColor: pageTheme.bg,
                  filter: "brightness(0.92)",
                }}
              />
            </motion.div>
          )}
        </div>

        {/* Sticky notes margin */}
        <StickyNotesMargin notes={s.notes} setNotes={s.setNotes} />

        {/* Word count badge */}
        <div className="absolute -bottom-4 right-4 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold shadow-lg">
          {s.wordCount} từ
        </div>

        <div className="absolute -bottom-6 left-10 w-56 h-3 rounded-full bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-900 shadow-[0_10px_20px_rgba(0,0,0,0.6)] rotate-[-8deg]" />
      </motion.div>
      ) : (
      <div className="relative">
        <div className="relative mx-auto max-w-[720px]">
        <div
          className="relative rounded-[8px] p-8 shadow-[0_60px_120px_-30px_rgba(0,0,0,0.8)] sm:p-10"
          style={{
            backgroundColor: pageTheme.bg,
            color: pageTheme.text,
            backgroundImage: pageTheme.light
              ? "radial-gradient(circle at 20% 30%, rgba(120,80,40,0.08), transparent 60%), radial-gradient(circle at 80% 70%, rgba(120,80,40,0.1), transparent 60%), repeating-linear-gradient(0deg, rgba(120,80,40,0.04) 0 1px, transparent 1px 28px)"
              : undefined,
          }}
        >
          <div style={{ fontFamily: "Shippori Mincho, serif" }} className="text-lg mb-8 text-center font-semibold opacity-90">
            {s.selectedChapter?.title ?? ""} — {s.selectedScene.title}
          </div>
          <div
            ref={s.leftRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={(e) => handleDefaultKeyDown(e, "left")}
            style={{ fontFamily: s.font, lineHeight: LINE_HEIGHT[s.displayLineHeight] }}
            className={`${EDITOR_SIZE[s.displayFontSize]} outline-none min-h-[160px] focus:bg-black/5 rounded px-1`}
          />
          <div
            ref={s.rightRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={(e) => handleDefaultKeyDown(e, "right")}
            style={{ fontFamily: s.font, lineHeight: LINE_HEIGHT[s.displayLineHeight] }}
            className={`${EDITOR_SIZE[s.displayFontSize]} outline-none min-h-[160px] focus:bg-black/5 rounded px-1`}
          />
          <div className="mt-10 text-right" style={{ fontFamily: "Shippori Mincho, serif" }}>
            <span className="text-xs opacity-60">— SakuraStream · Cảnh {currentIdx + 1}/{sceneOrder.length}</span>
          </div>
        </div>

        {/* Sticky notes margin */}
        <StickyNotesMargin notes={s.notes} setNotes={s.setNotes} />

        {/* Word count badge */}
        <div className="absolute -bottom-4 right-4 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold shadow-lg">
          {s.wordCount} từ
        </div>
        </div>
      </div>
      )}

      {s.writeMode === "book" ? (
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex justify-center gap-3">
            <button
              type="button"
              disabled={safeSpread === 0 && !prevScene}
              onClick={goPrevSpread}
              className="h-9 px-4 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition disabled:opacity-40"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={safeSpread === maxSpread && !nextScene}
              onClick={goNextSpread}
              className="h-9 px-4 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition disabled:opacity-40"
            >
              Trang sau
            </button>
          </div>
          <span className="text-xs text-amber-100/60">
            Cảnh {currentIdx + 1}/{sceneOrder.length} | {pageLabel}
          </span>
        </div>
      ) : (
        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            disabled={!prevScene}
            onClick={() => {
              studioPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              flipDirRef.current = -1;
              if (prevScene) s.selectScene(prevScene.id);
            }}
            className="h-9 px-4 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition disabled:opacity-40"
          >
            ← Cảnh trước
          </button>
          <button
            type="button"
            disabled={!nextScene}
            onClick={() => {
              studioPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              flipDirRef.current = 1;
              if (nextScene) s.selectScene(nextScene.id);
            }}
            className="h-9 px-4 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition disabled:opacity-40"
          >
            Cảnh sau →
          </button>
        </div>
      )}

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
