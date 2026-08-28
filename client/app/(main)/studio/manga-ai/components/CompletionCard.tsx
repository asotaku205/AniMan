"use client";

import { motion } from "motion/react";
import { Brush, Check } from "lucide-react";
import type { LayoutDef, PageCompletion } from "../data";

type Props = {
  completion: PageCompletion;
  layout: LayoutDef;
  activePanel: string | null;
  onApply: () => void;
  applied: boolean;
};

export function CompletionCard({ completion, layout, activePanel, onApply, applied }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border rounded-2xl overflow-hidden cursor-pointer group transition-all ${
        applied ? "border-purple-500/60" : "border-white/10 hover:border-purple-500/40"
      }`}
      onClick={onApply}
    >
      <div className="relative bg-white" style={{ aspectRatio: "3/4" }}>
        {layout.panels.map((p, pi) => {
          const isActive = p.id === activePanel;
          return (
            <div
              key={p.id}
              className={`absolute border text-[3px] ${isActive ? "border-pink-400 bg-pink-50" : "border-gray-200 bg-gray-50"}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` }}
            >
              {isActive ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brush size={6} className="text-pink-400" />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center px-0.5">
                  <span className="text-gray-400 text-center leading-tight" style={{ fontSize: "3.5px" }}>
                    {completion.hints[pi] ?? ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-white text-[11px] font-semibold flex items-center gap-1">
          {applied && <Check size={9} className="text-purple-400" />}
          {completion.name}
        </p>
        <p className="text-white/40 leading-tight" style={{ fontSize: "9px" }}>{completion.flow}</p>
      </div>
    </motion.div>
  );
}
