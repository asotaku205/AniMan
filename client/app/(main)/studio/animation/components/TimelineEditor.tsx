"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { AnimScene } from "../lib/animProject";
import {
  applyLayerMotions,
  createSceneLayer,
  createSceneTimeline,
  EASING_OPTIONS,
  easingCurvePoints,
  IDENTITY_CAMERA,
  IDENTITY_TRANSFORM,
  LAYER_MOTION_OPTIONS,
  removeTransformKey,
  sampleCamera,
  sampleLayerTransform,
  sampleTransform,
  sortKeys,
  upsertCameraKey,
  upsertTransformKey,
  type CameraKey,
  type EasingId,
  type LayerMotionKind,
  type SceneLayer,
  type SceneTimeline,
  type Transform,
} from "../lib/timeline";
import { CAMERA_PRESETS, LAYER_PRESETS } from "../lib/motionPresets";
import { suggestMotionPresets } from "../lib/motionPrompt";
import {
  TRANSLATION_TARGET_OPTIONS,
  translateDialogue,
  type TranslationTargetLang,
} from "@/lib/translation-api";
import { useAuth } from "@/app/auth/AuthProvider";
import {
  dialogueLineAt,
  newDialogueId,
  type DialogueLine,
} from "../lib/dialogue";

const STAGE_W = 960;
const STAGE_H = 540;

function newKeyId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Editor timeline 2D cho MỘT cảnh — vỏ mỏng trên `lib/timeline.ts`:
 * sân khấu canvas vẽ layer theo transform nội suy tại playhead (camera
 * áp trước, onion skin vẽ bóng key trước/sau), panel phải chỉnh layer /
 * keyframe / chuyển động tham số / camera / preset. Mọi thay đổi đi qua
 * `onChange` để workspace lưu vào dự án.
 */
export function TimelineEditor({
  scene,
  onChange,
  onDialogueChange,
}: {
  scene: AnimScene;
  onChange: (timeline: SceneTimeline) => void;
  onDialogueChange?: (lines: DialogueLine[]) => void;
}) {
  const timeline = useMemo<SceneTimeline>(
    () => scene.timeline ?? createSceneTimeline(),
    [scene.timeline],
  );
  const duration = Math.max(0.5, scene.durationSec);
  const [timeSec, setTimeSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    timeline.layers[0]?.id ?? null,
  );
  const [onion, setOnion] = useState(false);
  const [draftT, setDraftT] = useState<Transform>(IDENTITY_TRANSFORM);
  const [draftEasing, setDraftEasing] = useState<EasingId>("ease-in-out");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftCam, setDraftCam] = useState(IDENTITY_CAMERA);
  const [draftCamDirty, setDraftCamDirty] = useState(false);
  const { authenticatedFetch } = useAuth();
  const [motionQuery, setMotionQuery] = useState("");
  const [targetLang, setTargetLang] = useState<TranslationTargetLang>("en");
  const [glossary, setGlossary] = useState<string>(() =>
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem("animan-translate-glossary") ?? ""),
  );
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translatedDraft, setTranslatedDraft] = useState<Array<{
    id: string;
    text: string;
  }> | null>(null);

  const runTranslate = async () => {
    const lines = (scene.dialogue ?? []).filter((l) => l.text.trim());
    if (lines.length === 0 || !onDialogueChange) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      window.localStorage.setItem("animan-translate-glossary", glossary);
      const result = await translateDialogue(authenticatedFetch, {
        targetLang,
        sceneName: scene.name,
        sceneNote: scene.note,
        glossary,
        lines: lines.map((l) => ({ id: l.id, text: l.text, speaker: l.speaker })),
      });
      setTranslatedDraft(result.translations);
    } catch (error) {
      setTranslateError(
        error instanceof Error ? error.message : "Dịch thất bại, thử lại sau.",
      );
    } finally {
      setTranslating(false);
    }
  };
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, setImageTick] = useState(0);

  const selectedLayer =
    timeline.layers.find((l) => l.id === selectedLayerId) ?? null;

  const update = useCallback(
    (next: SceneTimeline) => onChange(next),
    [onChange],
  );
  const updateLayer = useCallback(
    (layerId: string, patch: Partial<SceneLayer>) => {
      update({
        ...timeline,
        layers: timeline.layers.map((l) =>
          l.id === layerId ? { ...l, ...patch } : l,
        ),
      });
    },
    [timeline, update],
  );

  // Playhead di chuyển (không đang sửa nháp) → nháp bám theo giá trị nội suy
  useEffect(() => {
    if (!draftDirty && selectedLayer) {
      setDraftT(sampleTransform(selectedLayer.keys, timeSec));
    }
    if (!draftCamDirty) {
      setDraftCam(sampleCamera(timeline.cameraKeys, timeSec));
    }
  }, [timeSec, selectedLayer, timeline.cameraKeys, draftDirty, draftCamDirty]);

  // Phát thử: rAF tiến thời gian, lặp vòng để xem đi xem lại
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTimeSec((prev) => {
        const next = prev + dt;
        return next >= duration ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, duration]);

  // ── Vẽ sân khấu ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = "#0a0616";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);

    const cam = draftCamDirty ? draftCam : sampleCamera(timeline.cameraKeys, timeSec);

    const drawLayer = (layer: SceneLayer, t: number, ghost?: "prev" | "next") => {
      let tr = sampleLayerTransform(layer, t);
      if (!ghost && draftDirty && layer.id === selectedLayerId) {
        tr = applyLayerMotions(draftT, layer.motions, t);
      }
      ctx.save();
      ctx.translate(STAGE_W / 2, STAGE_H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x * STAGE_W, -cam.y * STAGE_H);
      ctx.translate(tr.x * STAGE_W, tr.y * STAGE_H);
      ctx.rotate((tr.rotation * Math.PI) / 180);
      ctx.scale(tr.scale, tr.scale);
      ctx.globalAlpha = (ghost ? 0.3 : 1) * Math.max(0, Math.min(1, tr.opacity));
      const img = layer.imageDataUrl
        ? imageCacheRef.current.get(layer.imageDataUrl)
        : undefined;
      if (layer.imageDataUrl && !img) {
        const el = new Image();
        el.onload = () => setImageTick((v) => v + 1);
        el.src = layer.imageDataUrl;
        imageCacheRef.current.set(layer.imageDataUrl, el);
      }
      if (img && img.complete && img.naturalWidth > 0) {
        const scale = Math.max(STAGE_W / img.naturalWidth, STAGE_H / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else {
        ctx.fillStyle = ghost === "prev" ? "#7f1d2d" : ghost === "next" ? "#14532d" : layer.color;
        const w = STAGE_W * 0.62;
        const h = STAGE_H * 0.62;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 18);
        ctx.fill();
        if (!ghost) {
          ctx.fillStyle = "rgba(255,255,255,0.75)";
          ctx.font = "600 22px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(layer.name, 0, 8);
        }
      }
      ctx.restore();
    };

    for (const layer of timeline.layers) {
      if (!layer.visible) continue;
      if (onion && layer.id === selectedLayerId && layer.keys.length > 0) {
        const sorted = sortKeys(layer.keys);
        const prev = [...sorted].reverse().find((k) => k.timeSec < timeSec - 1e-4);
        const next = sorted.find((k) => k.timeSec > timeSec + 1e-4);
        if (prev) drawLayer(layer, prev.timeSec, "prev");
        if (next) drawLayer(layer, next.timeSec, "next");
      }
      drawLayer(layer, timeSec);
    }

    // Phụ đề: dòng thoại đang hiệu lực, vẽ ở đáy sân khấu (màn hình-space)
    const activeLine = dialogueLineAt(scene.dialogue ?? [], timeSec);
    if (activeLine) {
      ctx.save();
      ctx.font = "600 25px sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.fillStyle = "#ffffff";
      const label = activeLine.speaker
        ? `${activeLine.speaker}: ${activeLine.text}`
        : activeLine.text;
      ctx.strokeText(label, STAGE_W / 2, STAGE_H - 28);
      ctx.fillText(label, STAGE_W / 2, STAGE_H - 28);
      ctx.restore();
    }

  }, [timeline, timeSec, draftDirty, draftT, draftCam, draftCamDirty, selectedLayerId, onion, scene.dialogue]);

  // ── Thao tác keyframe ──────────────────────────────────────────────────────
  const placeLayerKey = () => {
    if (!selectedLayer) return;
    const keys = upsertTransformKey(selectedLayer.keys, {
      id: newKeyId("key"),
      timeSec: Math.round(timeSec * 100) / 100,
      transform: draftT,
      easing: draftEasing,
    });
    updateLayer(selectedLayer.id, { keys });
    setDraftDirty(false);
  };

  const placeCameraKey = () => {
    const keys = upsertCameraKey(timeline.cameraKeys, {
      id: newKeyId("camkey"),
      timeSec: Math.round(timeSec * 100) / 100,
      camera: draftCam,
      easing: draftEasing,
    });
    update({ ...timeline, cameraKeys: keys });
    setDraftCamDirty(false);
  };

  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onVal: (v: number) => void,
    format?: (v: number) => string,
  ) => (
    <label className="flex items-center gap-2 text-[11px] text-white/50">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onVal(Number(e.currentTarget.value))}
        className="flex-1 accent-pink-500"
      />
      <span className="w-11 text-right tabular-nums text-white/75">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </label>
  );

  const easingSelect = (
    <select
      value={draftEasing}
      onChange={(e) => setDraftEasing(e.currentTarget.value as EasingId)}
      aria-label="Easing cho key sắp đặt"
      className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
    >
      {EASING_OPTIONS.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );

  // Đồ thị easing xem trước (SVG)
  const curve = easingCurvePoints(draftEasing)
    .map((p) => `${(p.x * 56).toFixed(1)},${(30 - Math.max(-0.3, Math.min(1.3, p.y)) * 30).toFixed(1)}`)
    .join(" ");

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-white/80">
          TIMELINE 2D — {scene.name.toUpperCase()}
        </h2>
        <label className="flex items-center gap-2 text-[12px] text-white/55">
          <input
            type="checkbox"
            checked={onion}
            onChange={(e) => setOnion(e.currentTarget.checked)}
            className="accent-emerald-500"
          />
          Onion skin (bóng key trước đỏ / sau xanh)
        </label>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div>
          <canvas
            ref={canvasRef}
            width={STAGE_W}
            height={STAGE_H}
            className="w-full aspect-video rounded-xl border border-white/10 bg-black"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Dừng" : "Phát"}
              className="p-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 transition"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-[12px] tabular-nums text-white/60 w-24">
              {timeSec.toFixed(2)}s / {duration.toFixed(1)}s
            </span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.01}
              value={timeSec}
              onChange={(e) => {
                setPlaying(false);
                setTimeSec(Number(e.currentTarget.value));
              }}
              aria-label="Playhead"
              className="flex-1 accent-pink-500"
            />
          </div>
          {/* Mốc key của layer đang chọn + camera */}
          <div className="relative h-5 mt-1">
            {selectedLayer &&
              sortKeys(selectedLayer.keys).map((k) => (
                <span
                  key={k.id}
                  title={`Key layer tại ${k.timeSec.toFixed(2)}s`}
                  className="absolute top-0.5 w-2.5 h-2.5 rotate-45 bg-pink-400"
                  style={{ left: `calc(${(k.timeSec / duration) * 100}% - 5px)` }}
                />
              ))}
            {sortKeys(timeline.cameraKeys).map((k: CameraKey) => (
              <span
                key={k.id}
                title={`Key camera tại ${k.timeSec.toFixed(2)}s`}
                className="absolute bottom-0 w-2.5 h-2.5 rotate-45 bg-sky-400"
                style={{ left: `calc(${(k.timeSec / duration) * 100}% - 5px)` }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          {/* Motion prompt — gợi ý preset theo mô tả (tool, không tốn quota AI) */}
          <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <h3 className="text-[12px] font-semibold text-white/70">
              MÔ TẢ CHUYỂN ĐỘNG
            </h3>
            <input
              value={motionQuery}
              onChange={(e) => setMotionQuery(e.currentTarget.value)}
              placeholder="VD: phóng to dần vào mặt nhân vật…"
              className="w-full h-9 rounded-lg bg-black/50 border border-white/10 px-2.5 text-[12px] outline-none focus:border-pink-400/50"
            />
            {motionQuery.trim() && (
              <div className="space-y-1.5">
                {suggestMotionPresets(motionQuery).map((sug) => (
                  <button
                    key={sug.presetId}
                    onClick={() => {
                      if (sug.target === "camera") {
                        const preset = CAMERA_PRESETS.find((p) => p.id === sug.presetId);
                        if (preset) {
                          update({ ...timeline, cameraKeys: preset.build(duration) });
                          setDraftCamDirty(false);
                        }
                      } else if (selectedLayer) {
                        const preset = LAYER_PRESETS.find((p) => p.id === sug.presetId);
                        if (preset) {
                          updateLayer(selectedLayer.id, { keys: preset.build(duration) });
                          setDraftDirty(false);
                        }
                      }
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg bg-pink-500/10 border border-pink-400/30 text-[12px] hover:bg-pink-500/20 transition"
                  >
                    {sug.name}
                    <span className="text-white/40">
                      {" "}
                      — {sug.target === "camera" ? "áp cho camera" : "áp cho layer đang chọn"}
                    </span>
                  </button>
                ))}
                {suggestMotionPresets(motionQuery).length === 0 && (
                  <p className="text-[11px] text-white/35">
                    Chưa khớp preset nào — thử từ như "phóng to", "lia trái", "rung", "trôi vào", "mờ dần".
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Layer */}
          <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold text-white/70">LAYER</h3>
              <button
                onClick={() => {
                  const layer = createSceneLayer(`Lớp ${timeline.layers.length + 1}`);
                  update({ ...timeline, layers: [...timeline.layers, layer] });
                  setSelectedLayerId(layer.id);
                }}
                className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
              >
                <Plus className="w-3 h-3" /> Lớp
              </button>
            </div>
            {timeline.layers.map((layer) => (
              <div
                key={layer.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 border ${
                  layer.id === selectedLayerId
                    ? "border-pink-400/50 bg-pink-500/10"
                    : "border-white/5 hover:border-white/15"
                }`}
              >
                <button
                  onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                  aria-label="Ẩn/hiện layer"
                  className="text-white/50 hover:text-white"
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setSelectedLayerId(layer.id)}
                  className="flex-1 text-left text-[13px] truncate"
                >
                  {layer.name}
                </button>
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => updateLayer(layer.id, { color: e.currentTarget.value })}
                  aria-label="Màu layer"
                  className="w-6 h-6 bg-transparent cursor-pointer"
                />
                <button
                  onClick={() => {
                    update({
                      ...timeline,
                      layers: timeline.layers.filter((l) => l.id !== layer.id),
                    });
                    if (selectedLayerId === layer.id) setSelectedLayerId(null);
                  }}
                  aria-label="Xoá layer"
                  className="text-white/35 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {selectedLayer && (
              <label className="block text-[11px] text-white/45">
                Hình cho layer đang chọn (lấy từ khung tranh manga, hoặc tải ảnh lên)
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-[12px] text-white/60"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      updateLayer(selectedLayer.id, {
                        imageDataUrl: String(reader.result),
                      });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            )}
          </section>

          {/* Transform + keyframe */}
          {selectedLayer && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <h3 className="text-[12px] font-semibold text-white/70">
                BIẾN ĐỔI — {selectedLayer.name}
              </h3>
              {slider("X", draftT.x, 0, 1, 0.005, (v) => { setDraftT({ ...draftT, x: v }); setDraftDirty(true); })}
              {slider("Y", draftT.y, 0, 1, 0.005, (v) => { setDraftT({ ...draftT, y: v }); setDraftDirty(true); })}
              {slider("Cỡ", draftT.scale, 0.1, 3, 0.01, (v) => { setDraftT({ ...draftT, scale: v }); setDraftDirty(true); }, (v) => `${Math.round(v * 100)}%`)}
              {slider("Xoay", draftT.rotation, -180, 180, 1, (v) => { setDraftT({ ...draftT, rotation: v }); setDraftDirty(true); }, (v) => `${Math.round(v)}°`)}
              {slider("Mờ", draftT.opacity, 0, 1, 0.01, (v) => { setDraftT({ ...draftT, opacity: v }); setDraftDirty(true); }, (v) => `${Math.round(v * 100)}%`)}
              <div className="flex items-center gap-2 pt-1">
                {easingSelect}
                <svg width="56" height="30" className="rounded bg-black/50 border border-white/10">
                  <polyline points={curve} fill="none" stroke="#f472b6" strokeWidth="1.5" />
                </svg>
                <button
                  onClick={placeLayerKey}
                  className="flex-1 h-8 rounded-lg bg-pink-500/25 border border-pink-400/40 text-[12px] font-medium hover:bg-pink-500/35 flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Đặt key tại {timeSec.toFixed(2)}s
                </button>
              </div>
              {sortKeys(selectedLayer.keys).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sortKeys(selectedLayer.keys).map((k) => (
                    <span
                      key={k.id}
                      className="flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[11px]"
                    >
                      {k.timeSec.toFixed(2)}s · {k.easing}
                      <button
                        onClick={() =>
                          updateLayer(selectedLayer.id, {
                            keys: removeTransformKey(selectedLayer.keys, k.id),
                          })
                        }
                        aria-label="Xoá key"
                        className="text-white/40 hover:text-rose-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <select
                  id="layer-preset"
                  aria-label="Preset chuyển động cho layer"
                  className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Áp preset chuyển động…
                  </option>
                  {LAYER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const sel = document.getElementById("layer-preset") as HTMLSelectElement | null;
                    const preset = LAYER_PRESETS.find((p) => p.id === sel?.value);
                    if (preset) {
                      updateLayer(selectedLayer.id, { keys: preset.build(duration) });
                      setDraftDirty(false);
                    }
                  }}
                  className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                >
                  Áp dụng
                </button>
              </div>

              {/* Chuyển động tham số */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold text-white/60">
                  CHUYỂN ĐỘNG NHỎ (THAM SỐ — CHỈNH TAY)
                </h4>
                {selectedLayer.motions.map((m) => (
                  <div key={m.id} className="rounded-lg bg-white/[0.03] border border-white/5 p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <select
                        value={m.kind}
                        onChange={(e) =>
                          updateLayer(selectedLayer.id, {
                            motions: selectedLayer.motions.map((x) =>
                              x.id === m.id
                                ? { ...x, kind: e.currentTarget.value as LayerMotionKind }
                                : x,
                            ),
                          })
                        }
                        className="h-7 rounded bg-black/50 border border-white/10 px-1.5 text-[11px]"
                      >
                        {LAYER_MOTION_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() =>
                          updateLayer(selectedLayer.id, {
                            motions: selectedLayer.motions.filter((x) => x.id !== m.id),
                          })
                        }
                        aria-label="Xoá chuyển động"
                        className="text-white/35 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {slider("Cường độ", m.intensity, 0, 1, 0.05, (v) =>
                      updateLayer(selectedLayer.id, {
                        motions: selectedLayer.motions.map((x) =>
                          x.id === m.id ? { ...x, intensity: v } : x,
                        ),
                      }),
                    )}
                    {slider("Tốc độ", m.speed, 0.05, 2, 0.05, (v) =>
                      updateLayer(selectedLayer.id, {
                        motions: selectedLayer.motions.map((x) =>
                          x.id === m.id ? { ...x, speed: v } : x,
                        ),
                      }),
                      (v) => `${v.toFixed(2)}Hz`,
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    updateLayer(selectedLayer.id, {
                      motions: [
                        ...selectedLayer.motions,
                        {
                          id: newKeyId("motion"),
                          kind: "breath" as LayerMotionKind,
                          intensity: 0.6,
                          speed: 0.25,
                          phase: Math.random(),
                        },
                      ],
                    })
                  }
                  className="w-full h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                >
                  + Thêm chuyển động nhỏ
                </button>
              </div>
            </section>
          )}

          {/* Thoại / phụ đề */}
          {onDialogueChange && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-semibold text-white/70">
                  THOẠI / PHỤ ĐỀ
                </h3>
                <button
                  onClick={() =>
                    onDialogueChange([
                      ...(scene.dialogue ?? []),
                      {
                        id: newDialogueId(),
                        text: "",
                        startSec: Math.round(timeSec * 10) / 10,
                        durationSec: 2,
                      },
                    ])
                  }
                  className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                >
                  <Plus className="w-3 h-3" /> Dòng thoại
                </button>
              </div>
              {(scene.dialogue ?? []).map((line) => (
                <div key={line.id} className="rounded-lg bg-white/[0.03] border border-white/5 p-2 space-y-1.5">
                  <input
                    value={line.text}
                    onChange={(e) =>
                      onDialogueChange(
                        (scene.dialogue ?? []).map((x) =>
                          x.id === line.id ? { ...x, text: e.currentTarget.value } : x,
                        ),
                      )
                    }
                    placeholder="Nội dung thoại…"
                    className="w-full bg-transparent text-[13px] outline-none border-b border-transparent focus:border-white/30"
                  />
                  <div className="flex items-center gap-2 text-[11px] text-white/45">
                    <label className="flex items-center gap-1">
                      Từ
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={line.startSec}
                        onChange={(e) =>
                          onDialogueChange(
                            (scene.dialogue ?? []).map((x) =>
                              x.id === line.id
                                ? { ...x, startSec: Number(e.currentTarget.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-14 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                      />
                      s
                    </label>
                    <label className="flex items-center gap-1">
                      Dài
                      <input
                        type="number"
                        min={0.3}
                        step={0.1}
                        value={line.durationSec}
                        onChange={(e) =>
                          onDialogueChange(
                            (scene.dialogue ?? []).map((x) =>
                              x.id === line.id
                                ? { ...x, durationSec: Number(e.currentTarget.value) }
                                : x,
                            ),
                          )
                        }
                        className="w-14 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-white"
                      />
                      s
                    </label>
                    <button
                      onClick={() =>
                        onDialogueChange(
                          (scene.dialogue ?? []).filter((x) => x.id !== line.id),
                        )
                      }
                      aria-label="Xoá dòng thoại"
                      className="ml-auto text-white/35 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {(scene.dialogue ?? []).length === 0 && (
                <p className="text-[11px] text-white/35">
                  Chưa có thoại — nạp từ manga sẽ tự trích chữ trong panel,
                  hoặc thêm dòng thoại tay.
                </p>
              )}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold text-white/60">
                  DỊCH CÓ NGỮ CẢNH BẰNG AI (BẢN NHÁP — DUYỆT RỒI MỚI ÁP)
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.currentTarget.value as TranslationTargetLang)}
                    aria-label="Ngôn ngữ đích"
                    className="h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                  >
                    {TRANSLATION_TARGET_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void runTranslate()}
                    disabled={translating || (scene.dialogue ?? []).every((l) => !l.text.trim())}
                    className="flex-1 h-8 rounded-lg bg-violet-500/25 border border-violet-400/40 text-[12px] font-medium hover:bg-violet-500/35 disabled:opacity-40"
                  >
                    {translating ? "Đang dịch cả cảnh…" : "Dịch cả cảnh (1 lượt AI)"}
                  </button>
                </div>
                <textarea
                  value={glossary}
                  onChange={(e) => setGlossary(e.currentTarget.value)}
                  placeholder="Bảng thuật ngữ/tên riêng (tuỳ chọn) — VD: Haru = giữ nguyên; 'senpai' dịch là 'tiền bối'"
                  rows={2}
                  className="w-full rounded-lg bg-black/50 border border-white/10 px-2.5 py-2 text-[12px] outline-none placeholder:text-white/25"
                />
                {translateError && (
                  <p className="text-[11px] text-rose-300 leading-relaxed">{translateError}</p>
                )}
                {translatedDraft && (
                  <div className="space-y-1.5">
                    {translatedDraft.map((t) => {
                      const original = (scene.dialogue ?? []).find((l) => l.id === t.id);
                      return (
                        <div key={t.id} className="rounded-lg bg-violet-500/[0.07] border border-violet-400/20 p-2 text-[12px] leading-relaxed">
                          <div className="text-white/40 line-through-none">{original?.text}</div>
                          <div className="text-violet-200">{t.text}</div>
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onDialogueChange(
                            (scene.dialogue ?? []).map((l) => {
                              const t = translatedDraft.find((x) => x.id === l.id);
                              return t ? { ...l, text: t.text } : l;
                            }),
                          );
                          setTranslatedDraft(null);
                        }}
                        className="flex-1 h-8 rounded-lg bg-violet-500/40 border border-violet-300/40 text-[12px] font-medium hover:bg-violet-500/55"
                      >
                        Áp dụng bản dịch
                      </button>
                      <button
                        onClick={() => setTranslatedDraft(null)}
                        className="px-3 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-white/30 leading-relaxed">
                  Dịch dùng chung hạn mức AI với Manga Studio (5 lượt/phút, 30
                  lượt/ngày). Cần đăng nhập để dùng.
                </p>
              </div>
            </section>
          )}

          {/* Camera */}
          <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <h3 className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> CAMERA
            </h3>
            {slider("Tâm X", draftCam.x, 0, 1, 0.005, (v) => { setDraftCam({ ...draftCam, x: v }); setDraftCamDirty(true); })}
            {slider("Tâm Y", draftCam.y, 0, 1, 0.005, (v) => { setDraftCam({ ...draftCam, y: v }); setDraftCamDirty(true); })}
            {slider("Zoom", draftCam.zoom, 0.3, 3, 0.01, (v) => { setDraftCam({ ...draftCam, zoom: v }); setDraftCamDirty(true); }, (v) => `${v.toFixed(2)}×`)}
            <button
              onClick={placeCameraKey}
              className="w-full h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 text-[12px] font-medium hover:bg-sky-500/30 flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" /> Đặt key camera tại {timeSec.toFixed(2)}s
            </button>
            {sortKeys(timeline.cameraKeys).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {sortKeys(timeline.cameraKeys).map((k) => (
                  <span
                    key={k.id}
                    className="flex items-center gap-1 px-2 h-6 rounded-md bg-white/5 border border-white/10 text-[11px]"
                  >
                    {k.timeSec.toFixed(2)}s · {k.camera.zoom.toFixed(2)}×
                    <button
                      onClick={() =>
                        update({
                          ...timeline,
                          cameraKeys: timeline.cameraKeys.filter((x) => x.id !== k.id),
                        })
                      }
                      aria-label="Xoá key camera"
                      className="text-white/40 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <select
                id="camera-preset"
                aria-label="Preset cú máy"
                className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                defaultValue=""
              >
                <option value="" disabled>
                  Áp preset cú máy…
                </option>
                {CAMERA_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const sel = document.getElementById("camera-preset") as HTMLSelectElement | null;
                  const preset = CAMERA_PRESETS.find((p) => p.id === sel?.value);
                  if (preset) {
                    update({ ...timeline, cameraKeys: preset.build(duration) });
                    setDraftCamDirty(false);
                  }
                }}
                className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
              >
                Áp dụng
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
