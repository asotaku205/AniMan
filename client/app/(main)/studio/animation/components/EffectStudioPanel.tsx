/**
 * Effect Studio (Phase 5): tự dựng hiệu ứng hạt 3D từ mẫu, chỉnh công
 * thức bằng thanh trượt, xem thử ngay trên sân khấu, lưu riêng đặt tên
 * rồi gắn vào timeline tại thời điểm + vị trí.
 */

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PrevizScene } from "../lib/previz";
import { newPrevizId } from "../lib/previz";
import {
  newEffectId,
  type EffectEvent,
  type EffectFormula,
  type EffectLayer,
} from "../lib/effectFormula";
import { EFFECT_PRESETS } from "../lib/effectPresets";
import { deleteAnimAsset, saveAnimAsset } from "../lib/animStorage";

const DEFAULT_LAYER: EffectLayer = {
  shape: "sphere",
  count: 40,
  speed: [1, 3],
  life: [0.5, 1],
  gravity: 0,
  size: [0.3, 0.1],
  colorStart: "#ffdd55",
  colorEnd: "#ff4400",
  glow: true,
  spread: 0.5,
  opacity: 1,
};

function cloneFormula(f: EffectFormula): EffectFormula {
  return JSON.parse(JSON.stringify(f)) as EffectFormula;
}

/** Màu giữa 2 màu hex — hiển thị mặc định cho ô "Màu giữa". */
function mixHex(a: string, b: string): string {
  const px = (h: string) => {
    const v = h.replace("#", "");
    const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
    const n = parseInt(full, 16);
    return Number.isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = px(a);
  const [r2, g2, b2] = px(b);
  const hx = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${hx((r1 + r2) / 2)}${hx((g1 + g2) / 2)}${hx((b1 + b2) / 2)}`;
}

function numInput(
  label: string,
  value: number,
  onChange: (v: number) => void,
  step = 0.1,
) {
  return (
    <label className="flex-1 text-[11px] text-white/45">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value) || 0)}
        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white outline-none"
      />
    </label>
  );
}

export function EffectStudioPanel({
  previz,
  onChange,
  timeSec,
  selectedPosition,
  formulas,
  onFormulasChange,
  previewing,
  onPreview,
  mode,
  onAttachFx,
  placePosition,
  onPlaceRequest,
}: {
  /** Cảnh 3D — chỉ chế độ 3d dùng (gắn event vào previz.effectEvents). */
  previz?: PrevizScene;
  onChange?: (previz: PrevizScene) => void;
  timeSec: number;
  selectedPosition: { x: number; y: number; z: number } | null;
  formulas: EffectFormula[];
  onFormulasChange: () => void;
  previewing: boolean;
  onPreview: (formula: EffectFormula | null) => void;
  /** "2d": gắn event vào cảnh 2D qua onAttachFx, vị trí theo tọa độ
   * khung hình (x/y 0..1, không có Z). Mặc định "3d" giữ hành vi cũ. */
  mode?: "3d" | "2d";
  /** Chế độ 2d: gắn event này vào cảnh 2D đang sửa. */
  onAttachFx?: (ev: EffectEvent) => void;
  /** Chế độ 2d: vị trí vừa bấm lên sân khấu — panel đồng bộ vào ô X/Y. */
  placePosition?: { x: number; y: number } | null;
  /** Chế độ 2d: bấm để bật chế độ bấm sân khấu đặt vị trí. */
  onPlaceRequest?: () => void;
}) {
  const is2d = mode === "2d";
  const [draft, setDraft] = useState<EffectFormula | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [evStart, setEvStart] = useState(0);
  const [evDur, setEvDur] = useState(2);
  const [evPos, setEvPos] = useState(
    is2d ? { x: 0.5, y: 0.5, z: 0 } : { x: 0, y: 0.5, z: 0 },
  );
  const [evBurst, setEvBurst] = useState(true);
  const [evShake, setEvShake] = useState(0);
  const [evFlash, setEvFlash] = useState(0);

  // Chế độ 2d: vị trí bấm lên sân khấu đổ vào ô X/Y của form gắn.
  useEffect(() => {
    if (is2d && placePosition) {
      setEvPos({ x: placePosition.x, y: placePosition.y, z: 0 });
    }
  }, [is2d, placePosition]);

  const draftSaved = draft ? formulas.some((f) => f.id === draft.id) : false;

  // Đang xem thử thì bản nháp sửa tới đâu, sân khấu đổi tới đó.
  useEffect(() => {
    if (previewing && draft) onPreview(draft);
    // Chỉ chạy khi bản nháp đổi trong lúc đang xem thử.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const updateLayer = (idx: number, patch: Partial<EffectLayer>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      layers: draft.layers.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    await saveAnimAsset({
      kind: "effect",
      id: draft.id,
      name: draft.name,
      formula: draft,
      createdAt: Date.now(),
    });
    onFormulasChange();
    setMsg(`Đã lưu hiệu ứng "${draft.name}".`);
  };

  const openPreset = (f: EffectFormula) => {
    const copy = cloneFormula(f);
    copy.id = newEffectId("fx");
    setDraft(copy);
    setEvBurst(copy.burstDefault);
    setEvShake(copy.suggestedShake);
    setEvFlash(copy.suggestedFlash);
    onPreview(null);
    setMsg(null);
  };

  return (
    <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
      <h3 className="text-[12px] font-semibold text-white/70">
        HIỆU ỨNG (Effect Studio)
      </h3>
      {msg && <p className="text-[11px] text-emerald-300 leading-relaxed">{msg}</p>}

      <div>
        <p className="text-[11px] text-white/45 mb-1.5">Mẫu khởi đầu</p>
        <div className="flex flex-wrap gap-1.5">
          {EFFECT_PRESETS.map((f) => (
            <button
              key={f.id}
              onClick={() => openPreset(f)}
              className="px-2.5 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {formulas.length > 0 && (
        <div>
          <p className="text-[11px] text-white/45 mb-1.5">Hiệu ứng đã lưu</p>
          <div className="flex flex-wrap gap-1.5">
            {formulas.map((f) => (
              <span
                key={f.id}
                className="flex items-center gap-1 px-2 h-7 rounded-lg bg-violet-500/15 border border-violet-400/30 text-[11px]"
              >
                <button onClick={() => { setDraft(cloneFormula(f)); onPreview(null); }}>
                  {f.name} · {f.layers.length} lớp
                </button>
                <button
                  onClick={() => { void deleteAnimAsset(f.id).then(() => onFormulasChange()); }}
                  aria-label="Xoá hiệu ứng"
                  className="text-white/40 hover:text-rose-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {draft && (
        <>
          <label className="block text-[11px] text-white/45">
            Tên hiệu ứng
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
              className="mt-0.5 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] text-white outline-none"
            />
          </label>
          <div className="flex items-center gap-1.5 text-[11px] text-white/60">
            <span>Seed</span>
            <span className="tabular-nums">{draft.seed}</span>
            <button
              onClick={() => setDraft({ ...draft, seed: Math.floor(Math.random() * 1e9) })}
              className="px-2 h-7 rounded-lg bg-white/5 border border-white/10"
            >
              Đổi seed
            </button>
          </div>
          <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
            {draft.layers.map((l, idx) => (
              <details key={idx} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2" open={idx === 0}>
                <summary className="text-[12px] text-white/70 cursor-pointer flex justify-between">
                  <span>Lớp {idx + 1} · {l.shape} · {l.count} hạt</span>
                </summary>
                <div className="space-y-2 mt-2">
                  <div className="flex gap-1.5">
                    <label className="flex-1 text-[11px] text-white/45">
                      Nguồn phát
                      <select
                        value={l.shape}
                        onChange={(e) => updateLayer(idx, { shape: e.currentTarget.value as EffectLayer["shape"] })}
                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1 text-[12px] text-white outline-none"
                      >
                        <option value="point">Điểm (chùm hẹp)</option>
                        <option value="cone">Nón (chùm rộng)</option>
                        <option value="sphere">Cầu (mọi hướng)</option>
                      </select>
                    </label>
                    {numInput("Số hạt", l.count, (v) => updateLayer(idx, { count: Math.max(1, Math.round(v)) }), 1)}
                  </div>
                  <div className="flex gap-1.5">
                    {numInput("Tốc độ nhỏ", l.speed[0], (v) => updateLayer(idx, { speed: [v, l.speed[1]] }))}
                    {numInput("Tốc độ lớn", l.speed[1], (v) => updateLayer(idx, { speed: [l.speed[0], v] }))}
                  </div>
                  <div className="flex gap-1.5">
                    {numInput("Thọ nhỏ (s)", l.life[0], (v) => updateLayer(idx, { life: [v, l.life[1]] }))}
                    {numInput("Thọ lớn (s)", l.life[1], (v) => updateLayer(idx, { life: [l.life[0], v] }))}
                  </div>
                  <div className="flex gap-1.5">
                    {numInput("Trọng lực", l.gravity, (v) => updateLayer(idx, { gravity: v }))}
                    {numInput("Độ mở", l.spread, (v) => updateLayer(idx, { spread: Math.min(1, Math.max(0, v)) }))}
                    {numInput("Độ mờ", l.opacity, (v) => updateLayer(idx, { opacity: Math.min(1, Math.max(0, v)) }))}
                  </div>
                  <div className="flex gap-1.5">
                    {numInput("Cỡ đầu", l.size[0], (v) => updateLayer(idx, { size: [v, l.size[1]] }))}
                    {numInput("Cỡ cuối", l.size[1], (v) => updateLayer(idx, { size: [l.size[0], v] }))}
                  </div>
                  <div className="flex gap-1.5 items-end">
                    <label className="flex-1 text-[11px] text-white/45">
                      Màu đầu
                      <input
                        type="color" value={l.colorStart}
                        onChange={(e) => updateLayer(idx, { colorStart: e.currentTarget.value })}
                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1"
                      />
                    </label>
                    <label className="flex-1 text-[11px] text-white/45">
                      Màu cuối
                      <input
                        type="color" value={l.colorEnd}
                        onChange={(e) => updateLayer(idx, { colorEnd: e.currentTarget.value })}
                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-white/60 pb-1.5">
                      <input
                        type="checkbox" checked={l.glow}
                        onChange={(e) => updateLayer(idx, { glow: e.currentTarget.checked })}
                      />
                      Phát sáng
                    </label>
                  </div>
                  <div className="flex gap-1.5">
                    <label className="flex-1 text-[11px] text-white/45">
                      Hình hạt
                      <select
                        value={l.texture ?? "dot"}
                        onChange={(e) => updateLayer(idx, { texture: e.currentTarget.value as EffectLayer["texture"] })}
                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1 text-[12px] text-white outline-none"
                      >
                        <option value="dot">Chấm tròn</option>
                        <option value="star">Ngôi sao</option>
                        <option value="streak">Vệt sáng</option>
                        <option value="custom">Tải ảnh lên</option>
                      </select>
                    </label>
                    {numInput("Xoay (°/s)", l.spin ?? 0, (v) => updateLayer(idx, { spin: v }))}
                  </div>
                  {(l.texture ?? "dot") === "custom" && (
                    <div className="flex gap-1.5 items-end">
                      <label className="flex-1 text-[11px] text-white/45">
                        Ảnh hạt
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => updateLayer(idx, { textureDataUrl: String(reader.result) });
                            reader.readAsDataURL(file);
                          }}
                          className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1 text-[12px] text-white outline-none"
                        />
                      </label>
                      {l.textureDataUrl && (
                        <button
                          onClick={() => updateLayer(idx, { textureDataUrl: undefined })}
                          className="h-7 px-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/60"
                        >
                          Gỡ ảnh
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {numInput("Cản gió", l.drag ?? 0, (v) => updateLayer(idx, { drag: Math.max(0, v) }))}
                    {numInput("Nhiễu", l.turbulence ?? 0, (v) => updateLayer(idx, { turbulence: Math.max(0, v) }))}
                  </div>
                  <div className="flex gap-1.5 items-end">
                    {numInput("Cỡ giữa", l.sizeMid ?? (l.size[0] + l.size[1]) / 2, (v) => updateLayer(idx, { sizeMid: v }))}
                    <label className="flex-1 text-[11px] text-white/45">
                      Màu giữa
                      <input
                        type="color"
                        value={l.colorMid ?? mixHex(l.colorStart, l.colorEnd)}
                        onChange={(e) => updateLayer(idx, { colorMid: e.currentTarget.value })}
                        className="mt-0.5 w-full h-7 rounded-lg bg-black/40 border border-white/10 px-1"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => setDraft({ ...draft, layers: draft.layers.filter((_, i) => i !== idx) })}
                    className="text-[11px] text-rose-300 underline underline-offset-2"
                  >
                    Xoá lớp này
                  </button>
                </div>
              </details>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDraft({ ...draft, layers: [...draft.layers, { ...DEFAULT_LAYER }] })}
              className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px]"
            >
              + Thêm lớp
            </button>
            <button
              onClick={() => onPreview(previewing ? null : draft)}
              className="flex-1 h-8 rounded-lg bg-amber-500/25 border border-amber-400/40 text-[12px] font-medium hover:bg-amber-500/35"
            >
              {previewing ? "Dừng xem thử" : "Xem thử trên sân khấu"}
            </button>
            <button
              onClick={() => void saveDraft()}
              className="flex-1 h-8 rounded-lg bg-violet-500/25 border border-violet-400/40 text-[12px] font-medium hover:bg-violet-500/35"
            >
              Lưu hiệu ứng
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
            <p className="text-[11px] text-white/60 font-medium">
              {is2d ? "Gắn vào cảnh" : "Gắn vào timeline"}
            </p>
            {is2d && (
              <p className="text-[11px] text-white/40 leading-relaxed">
                Vị trí theo khung hình (X 0..1 trái→phải, Y 0..1 trên→dưới).
              </p>
            )}
            {!draftSaved && (
              <p className="text-[11px] text-amber-300 leading-relaxed">
                Lưu hiệu ứng trước rồi mới gắn vào timeline được.
              </p>
            )}
            <div className="flex gap-1.5">
              {numInput("Bắt đầu (s)", evStart, setEvStart)}
              {numInput("Dài (s)", evDur, (v) => setEvDur(Math.max(0.1, v)))}
            </div>
            <div className="flex gap-1.5">
              {numInput(
                "X",
                evPos.x,
                (v) =>
                  setEvPos({
                    ...evPos,
                    x: is2d ? Math.min(1, Math.max(0, v)) : v,
                  }),
              )}
              {numInput(
                "Y",
                evPos.y,
                (v) =>
                  setEvPos({
                    ...evPos,
                    y: is2d ? Math.min(1, Math.max(0, v)) : v,
                  }),
              )}
              {!is2d &&
                numInput("Z", evPos.z, (v) => setEvPos({ ...evPos, z: v }))}
            </div>
            <div className="flex gap-1.5 items-center">
              <label className="flex items-center gap-1.5 text-[11px] text-white/60">
                <input type="checkbox" checked={evBurst} onChange={(e) => setEvBurst(e.currentTarget.checked)} />
                Nổ cùng lúc
              </label>
              {numInput("Rung", evShake, (v) => setEvShake(Math.min(1, Math.max(0, v))))}
              {numInput("Chớp", evFlash, (v) => setEvFlash(Math.min(1, Math.max(0, v))))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setEvStart(Math.round(timeSec * 100) / 100)}
                className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px]"
              >
                Lấy mốc đang xem
              </button>
              {!is2d && (
                <button
                  onClick={() => { if (selectedPosition) setEvPos({ ...selectedPosition }); }}
                  disabled={!selectedPosition}
                  className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] disabled:opacity-40"
                >
                  Lấy vị trí vật đang chọn
                </button>
              )}
              {is2d && onPlaceRequest && (
                <button
                  onClick={onPlaceRequest}
                  className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px]"
                >
                  Bấm lên sân khấu để đặt
                </button>
              )}
              <button
                onClick={() => {
                  if (!draft) return;
                  if (is2d) {
                    onAttachFx?.({
                      id: newEffectId("fx"),
                      effectId: draft.id,
                      startSec: evStart,
                      durationSec: evDur,
                      position: { x: evPos.x, y: evPos.y, z: 0 },
                      burst: evBurst,
                      shake: evShake,
                      flash: evFlash,
                    });
                    setMsg(`Đã gắn "${draft.name}" vào cảnh tại ${evStart}s.`);
                    return;
                  }
                  if (!previz || !onChange) return;
                  onChange({
                    ...previz,
                    effectEvents: [
                      ...(previz.effectEvents ?? []),
                      {
                        id: newPrevizId("fx"),
                        effectId: draft.id,
                        startSec: evStart,
                        durationSec: evDur,
                        position: { ...evPos },
                        burst: evBurst,
                        shake: evShake,
                        flash: evFlash,
                      },
                    ],
                  });
                  setMsg(`Đã gắn "${draft.name}" vào timeline tại ${evStart}s.`);
                }}
                disabled={!draftSaved || (is2d && !onAttachFx)}
                className="flex-1 h-8 rounded-lg bg-violet-500/25 border border-violet-400/40 text-[12px] font-medium hover:bg-violet-500/35 disabled:opacity-40"
              >
                {is2d ? "Gắn vào cảnh" : "Gắn vào timeline"}
              </button>
            </div>
          </div>
        </>
      )}

      {!is2d && previz && (previz.effectEvents ?? []).length > 0 && (
        <div>
          <p className="text-[11px] text-white/45 mb-1.5">Sự kiện trên timeline</p>
          <div className="flex flex-wrap gap-1.5">
            {(previz.effectEvents ?? []).map((ev) => {
              const f = formulas.find((x) => x.id === ev.effectId);
              return (
                <span
                  key={ev.id}
                  className="flex items-center gap-1 px-2 h-6 rounded-md bg-amber-500/15 border border-amber-400/30 text-[11px]"
                >
                  {f ? f.name : "Hiệu ứng đã xoá"} · {ev.startSec.toFixed(1)}–{(ev.startSec + ev.durationSec).toFixed(1)}s
                  {ev.burst ? " · nổ" : " · rải"}
                  {ev.shake > 0 ? " · rung" : ""}
                  {ev.flash > 0 ? " · chớp" : ""}
                  <button
                    onClick={() => { if (!previz || !onChange) return; onChange({ ...previz, effectEvents: (previz.effectEvents ?? []).filter((x) => x.id !== ev.id) }); }}
                    aria-label="Xoá sự kiện"
                    className="text-white/40 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
      
    </section>
  );
}
