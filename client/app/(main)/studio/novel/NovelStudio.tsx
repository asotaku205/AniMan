"use client";

import { SectionEyebrow }  from "./components/SectionEyebrow";
import { WashiBookPage }   from "./components/WashiBookPage";
import { TabbedSidePanel } from "./components/TabbedSidePanel";
import { useNovelStudio }  from "./hooks/useNovelStudio";

export function NovelStudio() {
  const s = useNovelStudio();

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

        <div className="mt-12 grid lg:grid-cols-[1fr_320px] gap-8 items-start">
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
          />
        </div>
      </div>
    </section>
  );
}
