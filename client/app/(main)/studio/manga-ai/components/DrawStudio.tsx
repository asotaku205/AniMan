"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { LeftToolbar } from "./LeftToolbar";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasArea } from "./CanvasArea";
import { RightPanel } from "./RightPanel";
import { useDrawStudio } from "../hooks/useDrawStudio";
import { useAuth } from "@/app/auth/AuthProvider";

export function DrawStudio() {
  const s = useDrawStudio();
  const { user } = useAuth();
  const [aiConsent, setAiConsent] = useState<{
    eligible: boolean;
    userId: string | null;
  }>({ eligible: false, userId: null });
  const aiConsentEligible = aiConsent.eligible && aiConsent.userId === user?.id;
  const clearAiSuggestions = s.clearAiSuggestions;
  const handleAiEligibilityChange = useCallback(
    (eligible: boolean, userId: string | null) => {
      if (!eligible || aiConsent.userId !== userId || user?.id !== userId) {
        clearAiSuggestions();
      }
      setAiConsent({ eligible, userId });
    },
    [aiConsent.userId, clearAiSuggestions, user?.id],
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left toolbar */}
      <LeftToolbar
        tool={s.tool}
        onToolChange={s.setTool}
        color={s.color}
        onColorChange={s.setColor}
        size={s.size}
        onSizeChange={s.setSize}
        disabled={!s.activePanel}
      />

      {/* Center Canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <CanvasTopBar
          activePanel={s.activePanel}
          exitPanel={s.exitPanel}
          tool={s.tool}
          panelDef={s.panelDef}
          layout={s.layout}
          page={s.page}
          setPage={s.setPage}
          undo={s.undo}
          redo={s.redo}
          clearCanvas={s.clearCanvas}
          panelFullscreen={s.panelFullscreen}
          setPanelFullscreen={s.setPanelFullscreen}
          activeGuides={aiConsentEligible ? s.activeGuides : []}
          ghostType={aiConsentEligible ? s.ghostType : null}
          ghostId={aiConsentEligible ? s.ghostId : null}
        />

        <CanvasArea
          activePanel={s.activePanel}
          layout={s.layout}
          panelData={s.panelData}
          panelHints={s.panelHints}
          panelFullscreen={s.panelFullscreen}
          panelAspect={s.panelAspect}
          canvasRef={s.canvasRef}
          tool={s.tool}
          down={s.down}
          move={s.move}
          up={s.up}
          ghostType={s.ghostType}
          ghostId={s.ghostId}
          ghostOpacity={s.ghostOpacity}
          drawingPlaceholder={s.drawingPlaceholder}
          setDrawingPlaceholder={s.setDrawingPlaceholder}
          setGhostType={s.setGhostType}
          setGhostId={s.setGhostId}
          setGhostOpacity={s.setGhostOpacity}
          setSelectedComp={s.setSelectedComp}
          activeGuides={s.activeGuides}
          aiConsentEligible={aiConsentEligible}
          analyzing={s.analyzing}
          analysisResult={s.analysisResult}
          showAnalysis={s.showAnalysis}
          runAnalysis={s.runAnalysis}
          sceneType={s.sceneType}
          selectedComp={s.selectedComp}
          showPanelSuggestions={s.showPanelSuggestions}
          setShowPanelSuggestions={s.setShowPanelSuggestions}
          panelSuggestPulse={s.panelSuggestPulse}
          showSuggestBtn={s.showSuggestBtn}
          setShowSuggestBtn={s.setShowSuggestBtn}
          applyComp={s.applyComp}
          enterPanel={s.enterPanel}
          setPanelFullscreen={s.setPanelFullscreen}
        />
      </div>

      {/* Right panel */}
      <RightPanel
        s={s}
        onAiEligibilityChange={handleAiEligibilityChange}
        onAiConsentRevoked={clearAiSuggestions}
      />

      {/* Toast */}
      <AnimatePresence>
        {s.toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 bg-[#1a1226] border border-white/10 text-white text-xs px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2"
          >
            <Check size={12} className="text-green-400" /> {s.toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
