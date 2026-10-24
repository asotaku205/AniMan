"use client";

import { useState } from "react";
import { useAuth } from "@/app/auth/AuthProvider";
import { SectionEyebrow }  from "./components/SectionEyebrow";
import { WashiBookPage }   from "./components/WashiBookPage";
import { TabbedSidePanel } from "./components/TabbedSidePanel";
import { NovelBinder }     from "./components/NovelBinder";
import OutlineView         from "./components/OutlineView";
import { useNovelStudio }  from "./hooks/useNovelStudio";

export function NovelStudio() {
  const s = useNovelStudio();
  const { authenticatedFetch } = useAuth();
  const [view, setView] = useState<"write" | "outline">("write");

  return (
    <section className="relative py-24 overflow-hidden bg-[#1a0f06]">
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,#3a2412_0%,#1a0f06_70%)]" />
      <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(90deg,transparent_0_60px,rgba(0,0,0,0.4)_60px_61px)]" />

      <div className="relative max-w-[1400px] mx-auto px-6">
        <SectionEyebrow
          eyebrow="Novel Studio"
          title="Viết tiểu thuyết trên giấy washi"
          desc="Click trực tiếp vào trang để viết. Tuỳ chỉnh font, mixer 5 lớp âm thanh, hẹn giờ Pomodoro và dán ghi chú lên lề trang."
        />

        <div className="mt-8 flex gap-2">
          <button
            type="button"
            onClick={() => setView("write")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${view === "write" ? "bg-amber-600 text-white" : "bg-white/10 text-amber-100 border border-white/20"}`}
          >
            Viết
          </button>
          <button
            type="button"
            onClick={() => setView("outline")}
            className={`rounded-full px-4 py-2 text-sm font-medium ${view === "outline" ? "bg-amber-600 text-white" : "bg-white/10 text-amber-100 border border-white/20"}`}
          >
            Dàn ý
          </button>
        </div>

        {s.saveError && (
          <div className="mt-8 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-rose-100 text-sm flex flex-wrap items-center gap-3">
            <span className="flex-1">{s.saveError}</span>
            <button onClick={() => void s.retrySave()} className="h-8 px-3 rounded-lg bg-white/10 border border-white/20 text-xs font-medium">
              Thử lưu lại
            </button>
            <button onClick={() => void s.reload()} className="h-8 px-3 rounded-lg bg-white/10 border border-white/20 text-xs font-medium">
              Tải lại
            </button>
          </div>
        )}

        {view === "outline" ? (
          <div className="mt-12">
            <OutlineView s={s} onOpenScene={(id) => { s.selectScene(id); setView("write"); }} authenticatedFetch={authenticatedFetch} />
          </div>
        ) : (
        <div className="mt-12 grid gap-8 items-start xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          {/* Cây sách */}
          <NovelBinder s={s} />

          {/* Book + Sticky notes */}
          <WashiBookPage s={s} />

          {/* Side panel */}
          <TabbedSidePanel
            fontId={s.fontId}
            setFontId={s.setFontId}
            tracks={s.tracks}
            setTracks={s.setTracks}
            phase={s.phase}
            progress={s.progress}
            mm={s.mm}
            ss={s.ss}
            running={s.running}
            toggleRun={s.toggleRun}
            resetTimer={s.resetTimer}
            sceneWords={s.sceneWordCount}
            chapterWords={s.chapterWordCount}
            novelWords={s.novelWordCount}
            todayWords={s.todayWords}
            goalWordsPerDay={s.selectedNovel?.goalWordsPerDay ?? 500}
            setGoal={(n) => void s.setGoal(n)}
          />
        </div>
        )}
      </div>
    </section>
  );
}
