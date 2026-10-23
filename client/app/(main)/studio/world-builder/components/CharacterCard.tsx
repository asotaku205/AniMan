"use client";

import { motion } from "motion/react";
import { Library, Navigation, X } from "lucide-react";
import type { WorldCharacter } from "../data";

interface CharacterCardProps {
  char: WorldCharacter;
  selected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onSendToLibrary?: () => void;
}

export function CharacterCard({ char, selected, onClick, onDelete, onSendToLibrary }: CharacterCardProps) {
  return (
    <motion.div
      layout
      onClick={onClick}
      className={`p-3 rounded-2xl border cursor-pointer transition-all ${selected ? "border-purple-400/60 bg-purple-500/10" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: char.color }}>
          {char.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-sm font-medium">{char.name}</span>
            {char.faction && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{char.faction}</span>}
          </div>
          <span className="text-white/40 text-xs">{char.role}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-white/20 hover:text-red-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      {selected && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
          <div className="flex flex-wrap gap-1">
            {char.traits.map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${char.color}25`, color: char.color }}>{t}</span>
            ))}
          </div>
          <p className="text-white/50 text-[11px] leading-relaxed">{char.backstory}</p>
          <div className="text-[10px] text-white/30 flex items-center gap-1">
            <Navigation size={9} /> Vị trí: Cột {char.hexCol}, Hàng {char.hexRow}
          </div>
          {onSendToLibrary && (
            <button
              onClick={(e) => { e.stopPropagation(); onSendToLibrary(); }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-pink-300 hover:text-pink-200 transition-colors"
            >
              <Library size={11} /> Đưa vào thư viện tài sản (dùng làm nhân vật 3D trong phim)
            </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
