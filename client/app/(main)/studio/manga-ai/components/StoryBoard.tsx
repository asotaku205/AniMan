"use client";

import { motion } from "motion/react";
import { Bot, Plus } from "lucide-react";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { mangaList, type Manga } from "@/app/components/data/mangas";
import { LAYOUTS } from "../data";

export default function StoryBoard({ onBack }: { onBack: () => void }) {
  const chapters = mangaList.slice(0, 6);
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-[#0d0817] border-r border-white/5 flex flex-col p-3 gap-2 overflow-y-auto">
        <p className="text-white/40 text-[10px] uppercase tracking-widest px-1 mb-1">Chương</p>
        {chapters.map((m: Manga, i: number) => (
          <div key={m.slug} className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all ${i === 0 ? "bg-purple-500/20 border border-purple-500/30" : "hover:bg-white/5"}`}>
            <div className="w-8 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1226]">
              <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-medium truncate">{m.t}</p>
                  <p className="text-white/40 text-[9px]">Chương {i + 1}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Panel grid */}
      <div className="flex-1 overflow-auto bg-[#0b0612] p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">Story Board</h2>
          <button onClick={onBack} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={14} /> Thêm trang
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {LAYOUTS.map((layout, i) => (
            <motion.div
              key={layout.id}
              className={`relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all ${
                i === 0 ? "border-purple-500 shadow-lg shadow-purple-500/20" : "border-white/10 hover:border-white/20"
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="aspect-[3/4] bg-white relative">
                {layout.panels.map((p) => (
                  <div key={p.id} className="absolute border border-gray-300 bg-gray-50" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Bot size={8} className="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className="text-white text-xs font-medium">Trang {i + 1} • {layout.label}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
