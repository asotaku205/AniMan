"use client";

import { AnimatePresence, motion } from "motion/react";
import { Wand2 } from "lucide-react";
import {
  COLS, HEX_R, TERRAIN, TERRAIN_LIST, hexCenter, hexPolygon,
  svgHeight, svgWidth, type CaptureFrame, type HexCell, type WorldCharacter, type WorldMode,
} from "../data";

interface WorldMapSvgProps {
  hexMap: HexCell[][];
  mode: WorldMode;
  hoveredHex: { col: number; row: number } | null;
  setHoveredHex: (h: { col: number; row: number } | null) => void;
  selectedHex: { col: number; row: number } | null;
  isPainting: boolean;
  setIsPainting: (p: boolean) => void;
  paintHex: (col: number, row: number) => void;
  startCapture: (col: number, row: number) => void;
  placingChar: boolean;
  setAddCharAt: (pos: { col: number; row: number }) => void;
  setPlacingChar: (p: boolean) => void;
  captureFrame: CaptureFrame | null;
  genStep: number;
  characters: WorldCharacter[];
  selectedChar: string | null;
  setSelectedChar: (id: string | null) => void;
  cameraElevation: number;
  cameraRotation: number;
  cameraZoom: number;
  generatingWorld: boolean;
}

export function WorldMapSvg({
  hexMap, mode, hoveredHex, setHoveredHex, selectedHex,
  isPainting, setIsPainting, paintHex, startCapture,
  placingChar, setAddCharAt, setPlacingChar,
  captureFrame, genStep, characters, selectedChar, setSelectedChar,
  cameraElevation, cameraRotation, cameraZoom, generatingWorld,
}: WorldMapSvgProps) {
  const W = svgWidth();
  const H = svgHeight();

  return (
    <div className="flex-1 overflow-auto bg-[#060312] relative flex items-center justify-center">
      <div
        style={{
          perspective: "900px",
          perspectiveOrigin: "50% 40%",
          transformStyle: "preserve-3d",
        }}
      >
        <svg
          width={W}
          height={H}
          style={{
            transform: `rotateX(${cameraElevation}deg) rotateZ(${cameraRotation}deg) scale(${cameraZoom})`,
            transformOrigin: "50% 50%",
            transition: "transform 0.25s ease",
            display: "block",
          }}
          onMouseLeave={() => { setHoveredHex(null); if (isPainting) setIsPainting(false); }}
        >
          <defs>
            <filter id="hexShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.4)" />
            </filter>
          </defs>

          {/* Hex grid */}
          {hexMap.map((row, ri) => row.map((cell, ci) => {
            const { cx, cy } = hexCenter(ci, ri, HEX_R);
            const pts = hexPolygon(cx, cy, HEX_R - 1);
            const t = TERRAIN[cell.terrain];
            const isHovered = hoveredHex?.col === ci && hoveredHex?.row === ri;
            const isSelected = selectedHex?.col === ci && selectedHex?.row === ri;
            const isCaptured = captureFrame && cx >= captureFrame.x1 && cx <= captureFrame.x2 && cy >= captureFrame.y1 && cy <= captureFrame.y2;
            const cellIdx = ri * COLS + ci;
            const isVisible = genStep >= cellIdx;

            return (
              <g key={`${ci}-${ri}`}
                onMouseEnter={() => { setHoveredHex({ col: ci, row: ri }); if (isPainting && mode === "map") paintHex(ci, ri); }}
                onMouseDown={() => {
                  if (mode === "map") { setIsPainting(true); paintHex(ci, ri); }
                  else if (mode === "capture") startCapture(ci, ri);
                  else if (mode === "characters" && placingChar) { setAddCharAt({ col: ci, row: ri }); setPlacingChar(false); }
                }}
                onMouseUp={() => setIsPainting(false)}
                style={{ cursor: mode === "map" ? "crosshair" : "pointer", opacity: isVisible ? 1 : 0, transition: "opacity 0.15s ease" }}
              >
                <polygon points={pts}
                  fill={t.fill}
                  stroke={isSelected ? "#ffffff" : isCaptured ? "#a855f7" : t.stroke}
                  strokeWidth={isSelected ? 2 : isCaptured ? 1.5 : 0.8}
                  opacity={isHovered ? 0.95 : 0.85}
                  filter={isSelected || isHovered ? "url(#hexShadow)" : undefined}
                />
                <polygon points={hexPolygon(cx, cy, HEX_R * 0.55)}
                  fill="rgba(255,255,255,0.08)" stroke="none" />

                {(cell.terrain === "city" || cell.terrain === "magic" || cell.terrain === "snow") && (
                  <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" style={{ userSelect: "none", pointerEvents: "none" }}>
                    {TERRAIN[cell.terrain].emoji}
                  </text>
                )}

                {cell.name && isHovered && (
                  <g>
                    <rect x={cx - 30} y={cy - 20} width={60} height={14} rx={4} fill="rgba(0,0,0,0.75)" />
                    <text x={cx} y={cy - 9} textAnchor="middle" fontSize="8" fill="white" style={{ userSelect: "none", pointerEvents: "none" }}>{cell.name}</text>
                  </g>
                )}
              </g>
            );
          }))}

          {/* Capture frame */}
          {captureFrame && (
            <rect
              x={captureFrame.x1} y={captureFrame.y1}
              width={captureFrame.x2 - captureFrame.x1}
              height={captureFrame.y2 - captureFrame.y1}
              fill="rgba(168,85,247,0.12)"
              stroke="#a855f7"
              strokeWidth="1.5"
              strokeDasharray="5,3"
            />
          )}

          {/* Characters */}
          {characters.map(char => {
            const { cx, cy } = hexCenter(char.hexCol, char.hexRow, HEX_R);
            const isSelChar = selectedChar === char.id;
            return (
              <g key={char.id}
                onClick={() => { if (mode === "characters") setSelectedChar(selectedChar === char.id ? null : char.id); }}
                style={{ cursor: "pointer" }}
              >
                <circle cx={cx} cy={cy} r={isSelChar ? 14 : 11} fill="rgba(0,0,0,0.5)" />
                <circle cx={cx} cy={cy} r={isSelChar ? 13 : 10} fill={char.color}
                  stroke={isSelChar ? "white" : "rgba(255,255,255,0.4)"}
                  strokeWidth={isSelChar ? 2 : 1} />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={isSelChar ? "10" : "9"}
                  fill="white" fontWeight="bold" style={{ userSelect: "none", pointerEvents: "none" }}>
                  {char.name[0]}
                </text>
                {isSelChar && (
                  <g>
                    <rect x={cx - 22} y={cy - 28} width={44} height={14} rx={4} fill="rgba(0,0,0,0.8)" />
                    <text x={cx} y={cy - 17} textAnchor="middle" fontSize="8" fill="white" style={{ userSelect: "none", pointerEvents: "none" }}>{char.name}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-[#0d0817]/80 backdrop-blur border border-white/8 rounded-2xl p-3">
        <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Chú thích</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {TERRAIN_LIST.filter(t => t !== "sea").map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: TERRAIN[t].fill }} />
              <span className="text-white/50 text-[10px]">{TERRAIN[t].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Generating world overlay */}
      <AnimatePresence>
        {generatingWorld && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
              <Wand2 size={36} className="text-purple-400" />
            </motion.div>
            <p className="text-white text-lg font-medium">AI đang tạo thế giới...</p>
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" animate={{ width: ["0%", "100%"] }} transition={{ duration: 2.2 }} />
            </div>
            <p className="text-white/50 text-sm">Đang phân bố địa hình · Đặt bối cảnh</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
