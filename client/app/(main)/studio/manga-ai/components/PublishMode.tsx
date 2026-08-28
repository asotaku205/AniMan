"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { LAYOUTS } from "../data";

export function PublishMode() {
  const [step,  setStep]  = useState<"form" | "preview" | "done">("form");
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("Action");
  const [desc,  setDesc]  = useState("");

  if (step === "done") return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#0b0612] p-8">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
        <CheckCircle2 size={40} className="text-green-400" />
      </motion.div>
      <div className="text-center">
        <h2 className="text-white text-2xl font-bold mb-2">Đã xuất bản thành công!</h2>
        <p className="text-white/50">"{title}" đã được đăng lên cộng đồng.</p>
      </div>
      <button onClick={() => setStep("form")} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl transition-colors">
        Đăng tập mới
      </button>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#0b0612] p-6">
      <h2 className="text-white font-bold text-xl mb-6">Xuất bản Manga</h2>
      <div className="max-w-2xl mx-auto space-y-5">
        {step === "form" ? (
          <>
            <div>
              <label className="text-white/50 text-sm mb-1 block">Tên tập</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tập 1: Khởi đầu..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-purple-500 transition-colors" />
            </div>
            <div>
              <label className="text-white/50 text-sm mb-1 block">Thể loại</label>
              <select value={genre} onChange={e => setGenre(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors">
                {["Action","Romance","Fantasy","Sci-Fi","Horror","Comedy","Drama"].map(g => (
                  <option key={g} className="bg-gray-900">{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-sm mb-1 block">Mô tả ngắn</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="Tóm tắt nội dung tập này..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-purple-500 resize-none transition-colors" />
            </div>
            <div className="bg-white/5 rounded-2xl p-4">
              <p className="text-white/40 text-sm mb-3">Bố cục trang</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {LAYOUTS.map(l => (
                  <div key={l.id} className="flex-shrink-0 w-14 aspect-[3/4] bg-white rounded-lg border border-gray-200 relative overflow-hidden">
                    {l.panels.map(p => (
                      <div key={p.id} className="absolute border border-gray-300"
                        style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` }} />
                    ))}
                    <span className="absolute bottom-0.5 left-0.5 right-0.5 text-center text-gray-400 text-[6px]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setStep("preview")} disabled={!title}
              className="w-full bg-gradient-to-r from-pink-200 to-white hover:from-pink-100 hover:to-white disabled:opacity-50 disabled:cursor-not-allowed text-rose-950 py-3 rounded-xl font-semibold transition-all">
              Xem trước &amp; Đăng
            </button>
          </>
        ) : (
          <>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
              <h3 className="text-white text-lg font-bold">{title}</h3>
              <div className="flex gap-2">
                <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-0.5 rounded-lg">{genre}</span>
                <span className="bg-white/10 text-white/60 text-xs px-2 py-0.5 rounded-lg">{LAYOUTS.length} trang</span>
              </div>
              {desc && <p className="text-white/50 text-sm">{desc}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl transition-colors">Chỉnh sửa</button>
              <button onClick={() => setStep("done")} className="flex-1 bg-gradient-to-r from-pink-200 to-white hover:from-pink-100 hover:to-white text-rose-950 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                <Send size={16} /> Xuất bản ngay
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
