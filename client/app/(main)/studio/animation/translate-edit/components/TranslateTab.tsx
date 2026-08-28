"use client";

import { Wand2 } from "lucide-react";
import { languages, subtitleLines } from "../../data";

interface TranslateTabProps {
  targetLang: string;
  setTargetLang: (s: string) => void;
}

export function TranslateTab({ targetLang, setTargetLang }: TranslateTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-[11px] text-white/50 shrink-0 font-medium">DỊCH SANG</div>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="flex-1 h-8 rounded-md bg-white/5 border border-white/10 text-xs px-2 focus:outline-none focus:border-fuchsia-400"
        >
          {languages.map((l: string) => (
            <option key={l} className="bg-[#0d0817]">{l}</option>
          ))}
        </select>
        <button className="px-2.5 h-8 rounded-md bg-gradient-to-r from-fuchsia-500 to-pink-400 text-xs flex items-center gap-1 font-medium hover:opacity-90 transition">
          <Wand2 className="w-3.5 h-3.5" /> Auto
        </button>
      </div>
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="grid grid-cols-2 text-[10px] text-white/40 bg-white/5 font-medium">
          <div className="px-2 py-1.5 border-r border-white/10">NGUỒN (JP)</div>
          <div className="px-2 py-1.5">{targetLang.toUpperCase()}</div>
        </div>
        <div>
          {subtitleLines.map((l: typeof subtitleLines[number], i: number) => (
            <div key={i} className="grid grid-cols-2 border-t border-white/5 text-xs">
              <div className="px-2 py-2 border-r border-white/10 text-white/70">
                <div className="text-[10px] text-fuchsia-300/70 tabular-nums font-mono">{l.t}</div>
                <div className="mt-0.5" style={{ fontFamily: "Shippori Mincho, serif" }}>{l.src}</div>
              </div>
              <div className="px-2 py-2 text-white/90">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-400 font-medium">● {l.conf}%</span>
                  <button className="text-[10px] text-white/40 hover:text-white transition">Sửa</button>
                </div>
                <div className="mt-0.5">{l.vi}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[10px] text-white/40 leading-relaxed">
        AI giữ phong cách văn học, ngắt câu theo nhịp thoại gốc. Bạn có thể chỉnh tay từng dòng hoặc đổi tone (trang trọng / thân mật).
      </div>
    </div>
  );
}
