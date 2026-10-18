"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, BookOpen } from "lucide-react";
import { LeftToolbar } from "./LeftToolbar";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasArea } from "./CanvasArea";
import { ToolOptionsBar } from "./ToolOptionsBar";
import { RightPanel } from "./RightPanel";
import { useDrawStudio } from "../hooks/useDrawStudio";
import type { MangaProject } from "../hooks/useMangaProjects";
import type { PanelStacks } from "../data";

interface Props {
  activeProject?: MangaProject | null;
  targetPage?: number;
  onSavePageData?: (
    pageNumber: number,
    layoutId: string,
    panels: Record<string, string>,
    stacks: PanelStacks,
  ) => void;
  onAddPageToProject?: () => void;
  onGoToProjects?: () => void;
}

export function DrawStudio({
  activeProject,
  targetPage = 1,
  onSavePageData,
  onAddPageToProject,
  onGoToProjects,
}: Props = {}) {
  const currentPageLayoutId =
    activeProject?.pages.find((p) => p.pageNumber === targetPage)?.layoutId ||
    "classic-5";

  const stablePageNumbers = useMemo(
    () => activeProject?.pages?.map((p) => p.pageNumber) ?? [1],
    [activeProject?.pages],
  );

  const s = useDrawStudio({
    projectId: activeProject?.id,
    initialPage: targetPage,
    activeProjectPages: stablePageNumbers,
    currentLayoutId: currentPageLayoutId,
    onSavePageData,
    onAddPageToProject,
  });

  const aiConsentEligible = true;

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b0612] p-8 text-center">
        <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 shadow-xl">
          <BookOpen size={28} />
        </div>
        <h3 className="text-white font-bold text-base mb-1.5">Chưa chọn dự án Manga</h3>
        <p className="text-white/50 text-xs max-w-sm mb-6 leading-relaxed">
          Mỗi bản vẽ được lưu riêng biệt theo từng tác phẩm. Vui lòng chọn hoặc tạo mới một dự án để bắt đầu vẽ.
        </p>
        {onGoToProjects && (
          <button
            onClick={onGoToProjects}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-xs shadow-lg shadow-pink-500/20 transition-all"
          >
            Mở Trang Quản lý Dự án
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left toolbar */}
      <LeftToolbar
        tool={s.tool}
        onToolChange={s.setTool}
        color={s.color}
        onColorChange={s.setColor}
        disabled={!s.activePanel}
        shapeType={s.shapeType}
        onShapeTypeChange={s.setShapeType}
        shapeFill={s.shapeFill}
        onShapeFillChange={s.setShapeFill}
        shapeSides={s.shapeSides}
        onShapeSidesChange={s.setShapeSides}
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
          pages={s.pages}
          addPage={s.addPage}
          undo={s.undo}
          redo={s.redo}
          canUndo={s.canUndo}
          canRedo={s.canRedo}
          isSaved={s.isSaved}
          saveDraft={s.saveDraft}
          exportCurrentPanel={s.exportCurrentPanel}
          exportFullPage={s.exportFullPage}
          aiStrokeCount={s.aiStrokeCount}
          exportAiStrokes={s.exportAiStrokes}
          setExportAiStrokes={s.setExportAiStrokes}
          clearCanvas={s.clearCanvas}
          panelFullscreen={s.panelFullscreen}
          setPanelFullscreen={s.setPanelFullscreen}
          activeGuides={aiConsentEligible ? s.activeGuides : []}
          ghostType={aiConsentEligible ? s.ghostType : null}
          ghostId={aiConsentEligible ? s.ghostId : null}
        />

        <ToolOptionsBar
          tool={s.tool}
          settings={s.settings}
          onSettingsChange={s.updateSettings}
          color={s.color}
          disabled={!s.activePanel}
          shapeType={s.shapeType}
          onShapeTypeChange={s.setShapeType}
          selectionActive={s.selection !== null}
          selectMode={s.selectMode}
          onSelectModeChange={s.setSelectMode}
          onRotateSelection={s.rotateSelection}
          onFlipSelection={s.flipSelection}
          onScaleSelection={s.scaleSelectionBy}
          onInvertSelection={s.invertSelection}
          onDeleteSelection={s.deleteSelection}
          onClearSelection={s.clearSelection}
        />

        <CanvasArea
          activePanel={s.activePanel}
          layout={s.layout}
          panelData={s.panelData}
          panelHints={s.panelHints}
          panelFullscreen={s.panelFullscreen}
          panelAspect={s.panelAspect}
          canvasRef={s.canvasRef}
          inputRef={s.inputRef}
          selectionOverlayRef={s.selectionOverlayRef}
          tool={s.tool}
          down={s.down}
          move={s.move}
          up={s.up}
          zoom={s.zoom}
          zoomBy={s.zoomBy}
          resetView={s.resetView}
          panelBackingSize={s.panelBackingSize}
          ghostType={s.ghostType}
          ghostId={s.ghostId}
          ghostOpacity={s.ghostOpacity}
          aiStrokeLayers={s.aiStrokeLayers}
          aiOverlayAbove={s.aiOverlayAbove}
          setAiOverlayAbove={s.setAiOverlayAbove}
          clearPanelAiOverlay={s.clearPanelAiOverlay}
          applyAiToActiveLayer={s.applyAiToActiveLayer}
          canApplyAiToLayer={s.canApplyAiToLayer}
          ghostStrokesSummary={s.ghostStrokesSummary}
          drawingPlaceholder={s.drawingPlaceholder}
          setDrawingPlaceholder={s.setDrawingPlaceholder}
          setGhostType={s.setGhostType}
          setGhostId={s.setGhostId}
          setGhostOpacity={s.setGhostOpacity}
          setSelectedComp={s.setSelectedComp}
          activeGuides={s.activeGuides}
          aiConsentEligible={aiConsentEligible}
          showTextInput={s.showTextInput}
          textInputPos={s.textInputPos}
          insertText={s.insertText}
          cancelText={s.cancelText}
          analyzing={s.analyzing}
          analysisResult={s.analysisResult}
          analysisError={s.analysisError}
          reviewResult={s.reviewResult}
          selectedFindingIndex={s.selectedFindingIndex}
          setSelectedFindingIndex={s.setSelectedFindingIndex}
          showAnalysis={s.showAnalysis}
          dismissAnalysis={s.dismissAnalysis}
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
      <RightPanel s={s} />

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
