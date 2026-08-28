"use client";

import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { StickyNotesMargin } from "./StickyNotesMargin";
import type { NovelStudioState } from "../hooks/useNovelStudio";

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
              Chương 1 — Mưa Xuân
            </div>
            <div
              ref={s.leftRef}
              contentEditable
              suppressContentEditableWarning
              onInput={s.recountWords}
              style={{ fontFamily: s.font }}
              className="text-[#2a1a0a] text-2xl leading-[1.7] outline-none min-h-[280px] focus:bg-amber-50/20 rounded px-1"
            >
              Tôi nhớ buổi chiều ấy, mưa rơi rất khẽ trên mái ngói cong của ngôi đền cũ.
              Em đứng đó, ô giấy nghiêng nghiêng, ánh mắt lạc giữa những cánh hoa anh đào
              cuối cùng còn sót lại của mùa xuân.
            </div>
          </Page>

          {/* Right page */}
          <Page right>
            <div
              ref={s.rightRef}
              contentEditable
              suppressContentEditableWarning
              onInput={s.recountWords}
              style={{ fontFamily: s.font }}
              className="text-[#2a1a0a] text-2xl leading-[1.7] outline-none min-h-[280px] focus:bg-amber-50/20 rounded px-1"
            >
              "Cậu có tin vào kiếp sau không?" — em hỏi, không nhìn tôi.
              Tôi chưa kịp đáp. Một cánh hoa rơi xuống bàn tay em, rồi tan
              thành giọt mực loang trên trang giấy của ký ức.
            </div>
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

      <button
        onClick={s.addNote}
        className="mt-10 inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-amber-200/10 border border-amber-200/30 text-amber-100 text-xs hover:bg-amber-200/20 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Ghi chú lề mới
      </button>
    </div>
  );
}
