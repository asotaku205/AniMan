"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { WorldBuilderSidebar } from "./components/WorldBuilderSidebar";
import { WorldMapSvg }          from "./components/WorldMapSvg";
import { AddCharModal }         from "./components/AddCharModal";
import { useWorldBuilder }     from "./hooks/useWorldBuilder";
import { TERRAIN }             from "./data";

export function WorldBuilder() {
  const s = useWorldBuilder();

  return (
    <div className="flex h-screen bg-[#0b0612] text-white overflow-hidden">
      {/* Sidebar */}
      <WorldBuilderSidebar s={s} />

      {/* Main Map View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map Top Bar */}
        <div className="h-10 bg-[#0d0817] border-b border-white/5 flex items-center px-4 gap-3 flex-shrink-0">
          <span className="text-white/30 text-xs font-medium">Bản đồ thế giới</span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-white/20 text-xs">
            {s.mode === "map" ? `Cọ: ${TERRAIN[s.brushTerrain].label}` :
             s.mode === "characters" ? `${s.characters.length} nhân vật` :
             `Góc cam: ${s.cameraElevation}°`}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => s.setCameraZoom(v => Math.min(2, v + 0.15))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"><ZoomIn size={13} /></button>
            <button onClick={() => s.setCameraZoom(v => Math.max(0.5, v - 0.15))} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all"><ZoomOut size={13} /></button>
            <button onClick={() => { s.setCameraZoom(1); s.setCameraElevation(35); s.setCameraRotation(0); }} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all" title="Reset camera"><RotateCcw size={12} /></button>
          </div>
        </div>

        {/* Interactive Hex Map SVG */}
        <WorldMapSvg
          hexMap={s.hexMap}
          mode={s.mode}
          hoveredHex={s.hoveredHex}
          setHoveredHex={s.setHoveredHex}
          selectedHex={s.selectedHex}
          isPainting={s.isPainting}
          setIsPainting={s.setIsPainting}
          paintHex={s.paintHex}
          startCapture={s.startCapture}
          placingChar={s.placingChar}
          setAddCharAt={s.setAddCharAt}
          setPlacingChar={s.setPlacingChar}
          captureFrame={s.captureFrame}
          genStep={s.genStep}
          characters={s.characters}
          selectedChar={s.selectedChar}
          setSelectedChar={s.setSelectedChar}
          cameraElevation={s.cameraElevation}
          cameraRotation={s.cameraRotation}
          cameraZoom={s.cameraZoom}
          generatingWorld={s.generatingWorld}
        />
      </div>

      {/* Add character modal */}
      <AnimatePresence>
        {s.addCharAt && (
          <AddCharModal
            hexCol={s.addCharAt.col}
            hexRow={s.addCharAt.row}
            onClose={() => s.setAddCharAt(null)}
            onAdd={data => {
              s.setCharacters(prev => [...prev, { ...data, id: `c${Date.now()}` }]);
              s.showToast(`✓ Đã thêm nhân vật "${data.name}"`);
            }}
          />
        )}
      </AnimatePresence>

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
