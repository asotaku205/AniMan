"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen, Bot, Camera, Check, ChevronDown, ChevronRight,
  Download, Film, Globe, Map, Navigation, Plus, RefreshCw,
  Sparkles, Users, Wand2, X,
} from "lucide-react";
import { CharacterCard } from "./CharacterCard";
import {
  sendWorldCharacterToLibrary,
  sendWorldRegionToLibrary,
} from "../lib/worldToAssets";
import { ScenePreview } from "./ScenePreview";
import {
  EXAMPLE_DESCS, TERRAIN, TERRAIN_LIST, type TerrainType, type WorldMode,
} from "../data";
import type { WorldBuilderState } from "../hooks/useWorldBuilder";

export function WorldBuilderSidebar({ s }: { s: WorldBuilderState }) {
  return (
    <div className="w-64 bg-[#120a1f] border-r border-white/5 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-white/5">
        <div className="text-[10px] text-purple-400/60 tracking-widest mb-0.5 font-mono">WORLD BUILDER 3D</div>
        <div className="text-lg text-white font-semibold" style={{ fontFamily: "Shippori Mincho, serif" }}>Xây dựng Thế giới</div>
        <p className="text-white/30 text-[10px] mt-0.5 leading-relaxed">Vẽ bản đồ · Tạo nhân vật · Xuất cảnh</p>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-white/5">
        {([
          { k: "map",        label: "Bản đồ",    icon: <Map size={13} /> },
          { k: "characters", label: "Nhân vật",   icon: <Users size={13} /> },
          { k: "capture",    label: "Xuất cảnh",  icon: <Camera size={13} /> },
        ] as { k: WorldMode; label: string; icon: React.ReactNode }[]).map(({ k, label, icon }) => (
          <button key={k} onClick={() => s.setMode(k)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${s.mode === k ? "text-purple-300 border-b-2 border-purple-400 font-medium" : "text-white/30 hover:text-white/60"}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* ── MAP MODE ── */}
        {s.mode === "map" && (
          <>
            {/* ── DESCRIPTION INPUT PANEL ── */}
            <div className="rounded-2xl border border-purple-500/25 bg-purple-500/5 overflow-hidden">
              <button
                onClick={() => s.setShowDescPanel(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Globe size={13} className="text-purple-400" />
                  <span className="text-white/80 text-[11px] font-medium">Tạo thế giới từ mô tả</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">AI</span>
                </div>
                {s.showDescPanel ? <ChevronDown size={12} className="text-white/30" /> : <ChevronRight size={12} className="text-white/30" />}
              </button>

              <AnimatePresence>
                {s.showDescPanel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2.5 border-t border-purple-500/15">
                      <p className="text-white/40 text-[10px] leading-relaxed pt-2">
                        Mô tả thế giới bằng tiếng Việt — AI sẽ phân tích địa hình, hướng và tạo bản đồ tương ứng.
                      </p>

                      <textarea
                        value={s.worldDesc}
                        onChange={e => s.setWorldDesc(e.target.value)}
                        rows={4}
                        placeholder="Ví dụ: Dãy núi hùng vĩ ở phía bắc, rừng già bí ẩn ở phía tây. Kinh thành cổ kính ở trung tâm, sa mạc cát vàng ở phía đông..."
                        className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-[11px] resize-none focus:outline-none focus:border-purple-400/40 placeholder:text-white/20 leading-relaxed"
                      />

                      <div className="space-y-1">
                        <p className="text-white/25 text-[9px]">Ví dụ nhanh:</p>
                        {EXAMPLE_DESCS.map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => s.setWorldDesc(ex)}
                            className="w-full text-left text-[9px] text-white/35 hover:text-white/65 leading-snug px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/8 line-clamp-2"
                          >
                            {i + 1}. {ex.substring(0, 65)}…
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={s.generateFromDesc}
                        disabled={!s.worldDesc.trim() || s.generatingFromDesc}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-200 to-white text-rose-950 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:from-pink-100 hover:to-white"
                      >
                        {s.generatingFromDesc
                          ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={13} /></motion.div>
                          : <Sparkles size={13} />}
                        {s.generatingFromDesc ? "AI đang phân tích và tạo bản đồ..." : "Tạo bản đồ từ mô tả"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-medium">Cọ vẽ địa hình</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TERRAIN_LIST.map(t => (
                  <button key={t} onClick={() => s.setBrushTerrain(t)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${s.brushTerrain === t ? "border-purple-400/50 bg-purple-500/10 font-medium text-white" : "border-white/5 bg-white/[0.03] hover:border-white/10 text-white/70"}`}>
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: TERRAIN[t].fill }} />
                    <span className="text-[11px] truncate">{TERRAIN[t].label}</span>
                    {s.brushTerrain === t && <Check size={9} className="ml-auto text-purple-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium">AI hỗ trợ</p>
              <button onClick={s.generateWorld} disabled={s.generatingWorld}
                className="w-full py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-300 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                {s.generatingWorld
                  ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}><RefreshCw size={13} /></motion.div>
                  : <Wand2 size={13} />}
                {s.generatingWorld ? "Đang tạo bản đồ..." : "AI tạo thế giới ngẫu nhiên"}
              </button>
              {s.selectedHex && (
                <button onClick={s.generateDescription} disabled={s.aiLoading}
                  className="w-full py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 text-pink-300 text-xs font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                  {s.aiLoading
                    ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={13} /></motion.div>
                    : <Bot size={13} />}
                  AI mô tả vùng đất này
                </button>
              )}
            </div>

            {s.selectedCell && (
              <div className="space-y-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Vùng đã chọn</p>
                <div className="p-3 rounded-2xl border border-white/8 bg-white/[0.03] space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md" style={{ background: TERRAIN[s.selectedCell.terrain].fill }} />
                    <div>
                      <p className="text-white text-xs font-medium">{s.selectedCell.name ?? TERRAIN[s.selectedCell.terrain].label}</p>
                      <p className="text-white/40 text-[10px]">C{s.selectedHex!.col} · R{s.selectedHex!.row}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      void sendWorldRegionToLibrary(s.selectedCell!)
                        .then((msg) => s.showToast(msg))
                        .catch(() => s.showToast("Không tạo được phong cảnh — thử lại sau."));
                    }}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-pink-300 hover:text-pink-200 transition-colors"
                  >
                    Tạo phong cảnh cho phim từ vùng này
                  </button>
                  {s.aiDescription && (
                    <p className="text-white/60 text-[11px] leading-relaxed border-t border-white/5 pt-2">{s.aiDescription}</p>
                  )}
                  {s.aiLoading && (
                    <div className="flex items-center gap-2 text-purple-300 text-[11px]">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw size={10} /></motion.div>
                      AI đang viết mô tả...
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CHARACTERS MODE ── */}
        {s.mode === "characters" && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium">Nhân vật ({s.characters.length})</p>
              <button
                onClick={() => { s.setPlacingChar(true); s.showToast("Click vào ô trên bản đồ để đặt nhân vật"); }}
                className="flex items-center gap-1 text-purple-300 text-[11px] font-medium hover:text-purple-200 transition-colors">
                <Plus size={12} /> Thêm
              </button>
            </div>
            {s.placingChar && (
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20 text-purple-300 text-[11px] flex items-center gap-2">
                <Navigation size={11} />
                Click vào bản đồ để chọn vị trí nhân vật
                <button onClick={() => s.setPlacingChar(false)} className="ml-auto"><X size={11} /></button>
              </div>
            )}
            <div className="space-y-2">
              {s.characters.map(char => (
                <CharacterCard key={char.id} char={char} selected={s.selectedChar === char.id}
                  onSendToLibrary={() => {
                    void sendWorldCharacterToLibrary(char)
                      .then((msg) => s.showToast(msg))
                      .catch(() => s.showToast("Không đưa được vào thư viện — thử lại sau."));
                  }}
                  onClick={() => s.setSelectedChar(s.selectedChar === char.id ? null : char.id)}
                  onDelete={() => { s.setCharacters(p => p.filter(c => c.id !== char.id)); if (s.selectedChar === char.id) s.setSelectedChar(null); }} />
              ))}
            </div>
            {s.characters.length === 0 && (
              <div className="text-center py-8 text-white/20 text-sm">
                <Users size={28} className="mx-auto mb-2 opacity-30" />
                Chưa có nhân vật nào
              </div>
            )}
          </>
        )}

        {/* ── CAPTURE MODE ── */}
        {s.mode === "capture" && (
          <>
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-medium">Góc máy ảnh</p>
              <div className="space-y-3">
                {[
                  { label: "Góc nhìn", key: "elevation", value: s.cameraElevation, set: s.setCameraElevation, min: 0, max: 75, unit: "°" },
                  { label: "Xoay", key: "rotation", value: s.cameraRotation, set: s.setCameraRotation, min: 0, max: 360, unit: "°" },
                  { label: "Zoom", key: "zoom", value: Math.round(s.cameraZoom * 100), set: (v: number) => s.setCameraZoom(v / 100), min: 50, max: 200, unit: "%" },
                ].map(({ label, key, value, set, min, max, unit }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/50 text-xs">{label}</span>
                      <span className="text-purple-300 text-xs tabular-nums font-mono">{value}{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} value={value} onChange={e => set(+e.target.value)}
                      className="w-full h-1.5 accent-purple-500" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                {[
                  { label: "Chim", v: 70 },
                  { label: "45°", v: 45 },
                  { label: "Mắt", v: 10 },
                ].map(({ label, v }) => (
                  <button key={label} onClick={() => s.setCameraElevation(v)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] transition-all ${s.cameraElevation === v ? "bg-purple-600/30 text-purple-300 border border-purple-400/30 font-medium" : "bg-white/5 text-white/40 hover:text-white/70 border border-white/5"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-medium">Xuất cảnh</p>
              <div className="space-y-1.5">
                <button onClick={() => s.showToast("Đã mở MangaConverter với cảnh này")}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium hover:bg-pink-500/20 transition-all">
                  <BookOpen size={13} /> Dùng cho Manga (2D)
                </button>
                <button onClick={() => s.showToast("Đã mở AnimationLab với cảnh này")}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-all">
                  <Film size={13} /> Dùng cho Animation
                </button>
                <button onClick={() => s.showToast("Đã lưu ảnh bản đồ")}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 transition-all">
                  <Download size={13} /> Tải ảnh bản đồ
                </button>
              </div>
            </div>

            {s.captureFrame && (
              <div>
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-medium">Xem trước 2D</p>
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-video">
                  <ScenePreview terrains={s.getCapturedTerrains()} cameraElevation={s.cameraElevation} />
                </div>
                <p className="text-white/25 text-[9px] mt-1.5 text-center">Dựa trên vùng đang chọn · Góc {s.cameraElevation}°</p>
              </div>
            )}
            {!s.captureFrame && (
              <div className="text-center py-6 text-white/20 text-sm">
                <Camera size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px]">Click vào bản đồ để chọn cảnh xuất</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
