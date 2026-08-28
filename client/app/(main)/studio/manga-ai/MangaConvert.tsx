"use client";

import { useState } from "react";
import { StudioHeader } from "./components/StudioHeader";
import { DrawStudio }   from "./components/DrawStudio";
import { PublishMode }  from "./components/PublishMode";
import StoryBoard       from "./components/StoryBoard";
import type { StudioMode } from "./data";

export function MangaConverter() {
  const [mode, setMode] = useState<StudioMode>("draw");

  return (
    <div className="flex flex-col h-screen bg-[#0b0612] overflow-hidden">
      {/* Top Header Bar */}
      <StudioHeader mode={mode} setMode={setMode} />

      {/* Main Mode View */}
      <div className="flex flex-1 overflow-hidden">
        {mode === "draw"       && <DrawStudio />}
        {mode === "storyboard" && <StoryBoard onBack={() => setMode("draw")} />}
        {mode === "publish"    && <PublishMode />}
      </div>
    </div>
  );
}
