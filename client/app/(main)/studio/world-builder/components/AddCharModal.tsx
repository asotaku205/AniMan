"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus, RefreshCw, Wand2, X } from "lucide-react";
import type { WorldCharacter } from "../data";

interface AddCharModalProps {
  onClose: () => void;
  onAdd: (c: Omit<WorldCharacter, "id">) => void;
  hexCol: number;
  hexRow: number;
}

export function AddCharModal({ onClose, onAdd, hexCol, hexRow }: AddCharModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [traits, setTraits] = useState("");
  const [backstory, setBackstory] = useState("");
  const [color, setColor] = useState("#ef4444");
  const [generating, setGenerating] = useState(false);

  const roles = ["Chiến binh", "Pháp sư", "Thương nhân", "Trinh sát", "Quý tộc", "Trộm cắp", "Thầy thuốc", "Nhà thám hiểm"];
  const colors = ["#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#0ea5e9","#8b5cf6","#ec4899"];

  const generateAI = () => {
    if (!name) return;
    setGenerating(true);
    setTimeout(() => {
      setRole(roles[Math.floor(Math.random() * roles.length)]);
      setTraits(["Dũng cảm", "Bí ẩn", "Trung thành"].join(", "));
      setBackstory(`${name} xuất thân từ vùng đất xa xôi, mang theo bí mật từ quá khứ. Số phận đưa đẩy đến vùng này với một sứ mệnh chưa được tiết lộ.`);
      setGenerating(false);
    }, 1200);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#120a1f] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-base">Thêm nhân vật</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-white/40 text-xs mb-1 block">Tên nhân vật</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nhập tên..."
                className="w-full px-3 h-9 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400/50" />
            </div>
            <button onClick={generateAI} disabled={!name || generating}
              className="self-end h-9 px-3 rounded-xl bg-purple-600/20 border border-purple-400/20 text-purple-300 text-xs hover:bg-purple-600/30 disabled:opacity-40 transition-all flex items-center gap-1">
              {generating ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={12} /></motion.div> : <Wand2 size={12} />}
              AI
            </button>
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Vai trò</label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map(r => (
                <button key={r} onClick={() => setRole(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${role === r ? "bg-purple-600 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Màu đại diện</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-white ring-offset-1 ring-offset-[#120a1f]" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Đặc điểm tính cách (cách nhau bởi dấu phẩy)</label>
            <input value={traits} onChange={e => setTraits(e.target.value)} placeholder="Dũng cảm, Bí ẩn..."
              className="w-full px-3 h-9 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-white/40 text-xs mb-1 block">Xuất thân / Tiểu sử</label>
            <textarea value={backstory} onChange={e => setBackstory(e.target.value)} rows={3} placeholder="Kể về nhân vật..."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm resize-none focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">Hủy</button>
          <button
            disabled={!name || !role}
            onClick={() => {
              if (!name || !role) return;
              onAdd({ name, role, color, hexCol, hexRow, traits: traits.split(",").map(t => t.trim()).filter(Boolean), backstory, faction: undefined });
              onClose();
            }}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-pink-200 to-white text-rose-950 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5">
            <Plus size={14} /> Thêm nhân vật
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
