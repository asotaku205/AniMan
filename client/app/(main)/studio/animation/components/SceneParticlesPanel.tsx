"use client";

/**
 * Hệ hạt tự chế của cảnh (R3): người dùng tự đặt nguồn phát, hướng bay,
 * tốc độ, trọng lực, màu, tuổi thọ hạt — hoặc bắt đầu từ một mẫu có sẵn
 * rồi tinh chỉnh. Dùng chung cho cả editor 2D và 3D.
 */

import { Sparkles } from "lucide-react";
import {
  PARTICLE_PRESETS,
  defaultParticles,
  type ParticleSystemSettings,
} from "../lib/particles";

export function SceneParticlesPanel({
  value,
  onChange,
}: {
  value: ParticleSystemSettings | null;
  onChange: (v: ParticleSystemSettings | null) => void;
}) {
  const sys = value;
  const set = (patch: Partial<ParticleSystemSettings>) => {
    if (sys) onChange({ ...sys, ...patch });
  };
  return (
    <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-white/60 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> HỆ HẠT TỰ CHẾ
        </h4>
        <button
          onClick={() => onChange(sys ? null : defaultParticles())}
          className={`px-2.5 h-7 rounded-lg border text-[11px] transition ${
            sys
              ? "bg-amber-500/25 border-amber-300/40 text-amber-100"
              : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10"
          }`}
        >
          {sys ? "Đang bật — bấm để tắt" : "Bật hệ hạt"}
        </button>
      </div>
      {sys && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PARTICLE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onChange({ ...p.settings })}
                className="px-2 h-7 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/65 hover:bg-white/10 hover:text-white transition"
              >
                {p.name}
              </button>
            ))}
          </div>
          <PSlider label="Số hạt" value={sys.count} min={0} max={400} step={5}
            onVal={(v) => set({ count: v })} format={(v) => `${Math.round(v)}`} />
          <PSlider label="Cỡ hạt" value={sys.size} min={1} max={14} step={0.5}
            onVal={(v) => set({ size: v })} format={(v) => `${v.toFixed(1)}`} />
          <PSlider label="Tốc độ" value={sys.speed} min={0} max={1.2} step={0.01}
            onVal={(v) => set({ speed: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <PSlider label="Hướng bay" value={sys.directionDeg} min={0} max={360} step={5}
            onVal={(v) => set({ directionDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <PSlider label="Độ tản hướng" value={sys.spreadDeg} min={0} max={180} step={5}
            onVal={(v) => set({ spreadDeg: v })} format={(v) => `${Math.round(v)}°`} />
          <PSlider label="Trọng lực" value={sys.gravity} min={-1} max={2} step={0.1}
            onVal={(v) => set({ gravity: v })} format={(v) => v.toFixed(1)} />
          <PSlider label="Tuổi thọ hạt" value={sys.lifetimeSec} min={0.5} max={10} step={0.5}
            onVal={(v) => set({ lifetimeSec: v })} format={(v) => `${v.toFixed(1)}s`} />
          <PSlider label="Nguồn phát — ngang" value={sys.emitterX} min={0} max={1} step={0.02}
            onVal={(v) => set({ emitterX: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <PSlider label="Nguồn phát — dọc" value={sys.emitterY} min={0} max={1} step={0.02}
            onVal={(v) => set({ emitterY: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <PSlider label="Độ rộng nguồn" value={sys.emitterWidth} min={0} max={1} step={0.02}
            onVal={(v) => set({ emitterWidth: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <label className="flex items-center gap-2 text-[11px] text-white/50">
            <span className="w-[104px] shrink-0">Màu hạt</span>
            <input
              type="color"
              value={sys.color}
              onChange={(e) => set({ color: e.currentTarget.value })}
              className="w-10 h-7 rounded bg-white/5 border border-white/10 cursor-pointer"
            />
            <span className="text-white/60">{sys.color}</span>
          </label>
          
        </>
      )}
    </section>
  );
}

function PSlider({
  label,
  value,
  min,
  max,
  step,
  onVal,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onVal: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-white/50">
      <span className="w-[104px] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onVal(Number(e.currentTarget.value))}
        className="flex-1 accent-amber-400"
      />
      <span className="w-10 text-right tabular-nums text-white/70">
        {format ? format(value) : value}
      </span>
    </label>
  );
}
