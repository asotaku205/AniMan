"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Pause,
  Play,
  Mic,
  Plus,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import type { AnimScene } from "../lib/animProject";
import {
  applyLayerMotions,
  catmullRomPoint,
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
  type MotionInstance,
  type MotionParams,
  type SceneLayer,
  type SceneTimeline,
  type Transform,
} from "../lib/timeline";
import { CAMERA_PRESETS, LAYER_PRESETS } from "../lib/motionPresets";
import {
  applyMotionPreset,
  bakeMotionInstance,
  defaultMotionParams,
  motionPresetById,
  MOTION_DIRECTION_LABEL,
  MOTION_GROUP_LABEL,
  MOTION_LOOP_LABEL,
  MOTION_PRESETS,
} from "../lib/motionAttach";
import type { Motion2DAsset } from "../lib/animAssets";
import {
  deleteAnimAsset,
  listAnimAssets,
  saveAnimAsset,
} from "../lib/animStorage";
import { layerAtPoint, stageToWorld } from "../lib/stageHitTest";
import {
  layerEffectAt,
  layerEffectsOf,
  weatherParticles,
  type LayerEffectKey,
  type SceneWeather,
  type WeatherType,
} from "../lib/layerEffects";
import { particlePointsAt, type ParticleSystemSettings } from "../lib/particles";
import {
  newStrokeId,
  strokeVisiblePoints,
  type SceneStroke,
} from "../lib/strokes";
import { SceneParticlesPanel } from "./SceneParticlesPanel";
import DrawStudioModal from "./DrawStudioModal";
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
import DialogueVoice from "./DialogueVoice";
import { SceneAudioPanel } from "./SceneAudioPanel";
import { playSceneSounds } from "../lib/voicePreview";
import type { SceneAudioClip } from "../lib/animProject";

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
/** Dải timeline đa track ở đáy editor (bố cục R1): camera, từng layer và
 * thoại trên cùng một trục thời gian — bấm vào dải để tua, bấm tên layer
 * để chọn, thoi vàng là mốc key. Dải được giới hạn chiều cao và cuộn nội
 * bộ để sân khấu luôn cao tối đa. */
function TimelineStrip({
  timeline,
  dialogue,
  audioClips,
  duration,
  timeSec,
  selectedLayerId,
  onSelectLayer,
  onSeek,
}: {
  timeline: SceneTimeline;
  dialogue: DialogueLine[];
  audioClips: SceneAudioClip[];
  duration: number;
  timeSec: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onSeek: (t: number) => void;
}) {
  const pct = (t: number) => `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;
  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(duration, ratio * duration)));
  };
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.001; t += duration > 12 ? 2 : 1) ticks.push(t);
  const rows: { id: string; label: string; color: string; onClick?: () => void }[] = [
    { id: "camera", label: "Camera", color: "#38bdf8" },
    ...timeline.layers.map((l) => ({
      id: l.id,
      label: l.name,
      color: "#a78bfa",
      onClick: () => onSelectLayer(l.id),
    })),
    { id: "dialogue", label: "Thoại", color: "#f472b6" },
    ...(audioClips.length > 0
      ? [{ id: "audio", label: "Âm thanh", color: "#34d399" }]
      : []),
  ];
  return (
    <div className="shrink-0 border-t border-white/10 pt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-white/50">
          TIMELINE — BẤM ĐỂ TUA · BẤM TÊN LAYER ĐỂ CHỌN
        </span>
        <span className="text-[11px] text-white/40 tabular-nums">
          {timeSec.toFixed(2)}s / {duration.toFixed(1)}s
        </span>
      </div>
      <div className="max-h-[188px] overflow-y-auto overflow-x-clip">
        <div className="grid grid-cols-[116px_minmax(0,1fr)]">
          <div>
            <div className="h-4 sticky top-0 bg-[#0a0614] z-10" />
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={r.onClick}
                className={`h-6 w-full flex items-center gap-1.5 px-1.5 text-xs truncate text-left rounded ${
                  r.id === selectedLayerId
                    ? "bg-pink-500/15 text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ background: r.color }}
                />
                <span className="truncate">{r.label}</span>
              </button>
            ))}
          </div>
          <div className="relative" onPointerDown={seekFromEvent}>
            <div className="h-4 relative border-b border-white/10 cursor-pointer sticky top-0 bg-[#0a0614] z-10">
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-0 text-[10px] text-white/40"
                  style={{
                    left: pct(t),
                    transform:
                      t === 0
                        ? "none"
                        : t >= duration
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {t.toFixed(0)}s
                </span>
              ))}
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="h-6 relative border-b border-white/5 cursor-pointer"
              >
                {r.id === "camera" &&
                  sortKeys(timeline.cameraKeys).map((k) => (
                    <span
                      key={k.id}
                      title={`Key camera tại ${k.timeSec.toFixed(2)}s`}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-sky-400"
                      style={{ left: `calc(${pct(k.timeSec)} - 4px)` }}
                    />
                  ))}
                {r.id !== "camera" &&
                  r.id !== "dialogue" &&
                  r.id !== "audio" &&
                  (() => {
                    const layer = timeline.layers.find((l) => l.id === r.id);
                    if (!layer) return null;
                    return (
                      <>
                        <span className="absolute top-[2px] bottom-[2px] left-0 right-0 rounded bg-violet-500/25 border border-violet-400/30" />
                        {sortKeys(layer.keys).map((k) => (
                          <span
                            key={k.id}
                            title={`Key tại ${k.timeSec.toFixed(2)}s`}
                            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-amber-400"
                            style={{ left: `calc(${pct(k.timeSec)} - 4px)` }}
                          />
                        ))}
                      </>
                    );
                  })()}
                {r.id === "dialogue" &&
                  dialogue.map((line) => (
                    <span
                      key={line.id}
                      title={`${line.speaker}: ${line.text}`}
                      className="absolute top-[2px] bottom-[2px] rounded bg-pink-500/40 border border-pink-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px]"
                      style={{
                        left: pct(line.startSec),
                        width: `${Math.max(2, (line.durationSec / duration) * 100)}%`,
                      }}
                    >
                      {line.speaker}
                    </span>
                  ))}
                {r.id === "audio" &&
                  audioClips.map((clip) => (
                    <span
                      key={clip.id}
                      title={clip.name}
                      className="absolute top-[2px] bottom-[2px] rounded bg-emerald-500/40 border border-emerald-400/40 text-[9px] text-white/85 px-1 truncate leading-[17px]"
                      style={{
                        left: pct(clip.startSec),
                        width: `${Math.max(2, (clip.durationSec / duration) * 100)}%`,
                      }}
                    >
                      {clip.name}
                    </span>
                  ))}
              </div>
            ))}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none"
              style={{ left: pct(timeSec) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TimelineEditor({
  scene,
  onChange,
  onDialogueChange,
  onWeatherChange,
  onAudioChange,
  onParticlesChange,
  onStrokesChange,
}: {
  scene: AnimScene;
  onChange: (timeline: SceneTimeline) => void;
  onDialogueChange?: (lines: DialogueLine[]) => void;
  onWeatherChange?: (weather: SceneWeather | null) => void;
  onAudioChange?: (clips: SceneAudioClip[]) => void;
  onParticlesChange?: (particles: ParticleSystemSettings | null) => void;
  onStrokesChange?: (strokes: SceneStroke[]) => void;
}) {
  const timeline = useMemo<SceneTimeline>(
    () => scene.timeline ?? createSceneTimeline(),
    [scene.timeline],
  );
  const duration = Math.max(0.5, scene.durationSec);
  const [timeSec, setTimeSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [drawingLayer, setDrawingLayer] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    timeline.layers[0]?.id ?? null,
  );
  const [onion, setOnion] = useState(false);
  const [propsOpen, setPropsOpen] = useState(true);
  const [draftT, setDraftT] = useState<Transform>(IDENTITY_TRANSFORM);
  const [draftEasing, setDraftEasing] = useState<EasingId>("ease-in-out");
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftCam, setDraftCam] = useState(IDENTITY_CAMERA);
  const [draftCamDirty, setDraftCamDirty] = useState(false);
  const { authenticatedFetch } = useAuth();
  const [motionQuery, setMotionQuery] = useState("");
  const [voiceLineId, setVoiceLineId] = useState<string | null>(null);
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
  // Kéo layer trực tiếp trên sân khấu (S3)
  const stageDragRef = useRef<{
    layerId: string;
    startWorld: { x: number; y: number };
    startT: Transform;
  } | null>(null);
  const [stageDragging, setStageDragging] = useState(false);
  // Vệt vẽ tay (R3)
  const [strokeMode, setStrokeMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#7df9ff");
  const [strokeWidth, setStrokeWidth] = useState(7);
  const [drawingStroke, setDrawingStroke] = useState<{ x: number; y: number }[] | null>(null);
  const drawingRef = useRef<{ startSec: number; wallStart: number } | null>(null);
  const [selectedFxKeyId, setSelectedFxKeyId] = useState<string | null>(null);
  // Gắn chuyển động 2D: mẫu + tham số, mẫu đã lưu, đường vẽ tay
  const [motionPresetId, setMotionPresetId] = useState("slide-in");
  const [motionParams, setMotionParams] = useState<MotionParams>(() =>
    defaultMotionParams(0),
  );
  const [motionMsg, setMotionMsg] = useState<string | null>(null);
  const [savedMotions, setSavedMotions] = useState<Motion2DAsset[]>([]);
  const [savedMotionName, setSavedMotionName] = useState("");
  const [copyFromLayerId, setCopyFromLayerId] = useState("");
  const [pathMode, setPathMode] = useState(false);
  const [pathDraft, setPathDraft] = useState<Array<{ x: number; y: number }> | null>(null);
  const [selectedPathPoint, setSelectedPathPoint] = useState<number | null>(null);
  const [pathParams, setPathParams] = useState({
    startSec: 0,
    durationSec: 2,
    orientToPath: true,
    easing: "ease-in-out" as EasingId,
  });
  const pathDragRef = useRef<number | null>(null);

  useEffect(() => {
    listAnimAssets()
      .then((all) =>
        setSavedMotions(
          all.filter((a): a is Motion2DAsset => a.kind === "motion2d"),
        ),
      )
      .catch(() => {});
  }, []);

  const stagePointOf = (e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    // Canvas hiển thị theo kiểu giữ tỉ lệ (object-contain): quy điểm chạm
    // về vùng hình thật ở giữa, tránh lệch khi ô chứa không đúng 16:9.
    const scale = Math.min(rect.width / STAGE_W, rect.height / STAGE_H);
    const cw = STAGE_W * scale;
    const ch = STAGE_H * scale;
    const ox = rect.left + (rect.width - cw) / 2;
    const oy = rect.top + (rect.height - ch) / 2;
    return {
      x: (e.clientX - ox) / cw,
      y: (e.clientY - oy) / ch,
    };
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    const point = stagePointOf(e);
    if (!point) return;
    if (pathMode) {
      const world = stageToWorld(timeline, timeSec, point);
      const draft = pathDraft ?? [];
      const hitIdx = draft.findIndex(
        (p) => Math.hypot(p.x - world.x, p.y - world.y) < 0.04,
      );
      if (hitIdx >= 0) {
        setSelectedPathPoint(hitIdx);
        pathDragRef.current = hitIdx;
      } else {
        setPathDraft([...draft, world]);
        setSelectedPathPoint(draft.length);
      }
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    if (strokeMode && onStrokesChange) {
      drawingRef.current = { startSec: timeSec, wallStart: performance.now() };
      setDrawingStroke([point]);
      canvasRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    const hit = layerAtPoint(timeline, timeSec, point);
    if (!hit) return;
    setSelectedLayerId(hit.id);
    const base = sampleTransform(hit.keys, timeSec);
    setDraftT(base);
    setDraftDirty(false);
    stageDragRef.current = {
      layerId: hit.id,
      startWorld: stageToWorld(timeline, timeSec, point),
      startT: base,
    };
    setStageDragging(true);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (pathDragRef.current !== null) {
      const point = stagePointOf(e);
      if (!point) return;
      const world = stageToWorld(timeline, timeSec, point);
      const idx = pathDragRef.current;
      setPathDraft((prev) =>
        prev ? prev.map((p, i) => (i === idx ? world : p)) : prev,
      );
      return;
    }
    if (drawingRef.current) {
      const point = stagePointOf(e);
      if (!point) return;
      setDrawingStroke((prev) => {
        if (!prev) return prev;
        const last = prev[prev.length - 1];
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.004) return prev;
        return [...prev, point];
      });
      return;
    }
    const drag = stageDragRef.current;
    if (!drag) return;
    const point = stagePointOf(e);
    if (!point) return;
    const world = stageToWorld(timeline, timeSec, point);
    setDraftT({
      ...drag.startT,
      x: Math.max(-0.5, Math.min(1.5, drag.startT.x + (world.x - drag.startWorld.x))),
      y: Math.max(-0.5, Math.min(1.5, drag.startT.y + (world.y - drag.startWorld.y))),
    });
    setDraftDirty(true);
  };

  const onStagePointerUp = () => {
    if (pathDragRef.current !== null) {
      pathDragRef.current = null;
      return;
    }
    if (drawingRef.current && onStrokesChange) {
      const info = drawingRef.current;
      drawingRef.current = null;
      const points = drawingStroke ?? [];
      setDrawingStroke(null);
      if (points.length >= 1) {
        const drawn = points.length === 1 ? [points[0], { x: points[0].x + 0.001, y: points[0].y }] : points;
        const dur = Math.max(0.3, Math.min(scene.durationSec, (performance.now() - info.wallStart) / 1000));
        onStrokesChange([
          ...(scene.strokes ?? []),
          {
            id: newStrokeId(),
            color: strokeColor,
            widthPx: strokeWidth,
            points: drawn,
            startSec: Math.round(info.startSec * 100) / 100,
            durationSec: Math.round(dur * 100) / 100,
          },
        ]);
      }
      return;
    }
    stageDragRef.current = null;
    setStageDragging(false);
  };
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, setImageTick] = useState(0);

  const selectedLayer =
    timeline.layers.find((l) => l.id === selectedLayerId) ?? null;

  // ── Hoàn tác / làm lại (Slice B7): mọi thay đổi qua `update` đều ghi
  // một mốc lịch sử (tối đa 60); các thay đổi dồn dập trong 800ms (kéo
  // thanh trượt) gộp chung một mốc để hoàn tác không nhảy từng nấc nhỏ.
  const HISTORY_LIMIT = 60;
  const pastRef = useRef<SceneTimeline[]>([]);
  const futureRef = useRef<SceneTimeline[]>([]);
  const lastPushAtRef = useRef(0);
  const [, setHistoryTick] = useState(0);
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  const update = useCallback(
    (next: SceneTimeline) => {
      const now = performance.now();
      if (now - lastPushAtRef.current > 800) {
        pastRef.current = [
          ...pastRef.current.slice(-(HISTORY_LIMIT - 1)),
          timelineRef.current,
        ];
        lastPushAtRef.current = now;
      }
      futureRef.current = [];
      setHistoryTick((t) => t + 1);
      onChange(next);
    },
    [onChange],
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, timelineRef.current];
    lastPushAtRef.current = 0;
    setHistoryTick((t) => t + 1);
    onChange(prev);
  }, [onChange]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, timelineRef.current];
    lastPushAtRef.current = 0;
    setHistoryTick((t) => t + 1);
    onChange(next);
  }, [onChange]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return; // đang gõ chữ — để trình duyệt xử lý hoàn tác văn bản
      }
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
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

  const timeSecRef = useRef(0);
  const dialogueRef = useRef<DialogueLine[]>([]);
  dialogueRef.current = scene.dialogue ?? [];
  const audioClipsRef = useRef<SceneAudioClip[]>([]);
  audioClipsRef.current = scene.audioClips ?? [];

  // Phát thử KÈM TIẾNG: lên lịch các bản thu đã chọn theo mốc thoại
  const voicePlaybackRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => {
    if (!playing) {
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
      return;
    }
    timeSecRef.current = timeSec;
    let alive = true;
    void playSceneSounds(dialogueRef.current, audioClipsRef.current, timeSec).then((pb) => {
      if (!alive) {
        pb?.stop();
        return;
      }
      voicePlaybackRef.current = pb;
    });
    return () => {
      alive = false;
      voicePlaybackRef.current?.stop();
      voicePlaybackRef.current = null;
    };
    // Chỉ chạy lại khi bấm phát/dừng — mốc bắt đầu lấy tại thời điểm bấm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

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
      const fx = ghost
        ? null
        : layerEffectAt(
            layer.effects,
            layer.keys.map((k) => k.timeSec),
            t,
            scene.durationSec,
            layer.effectKeys,
          );
      ctx.save();
      ctx.translate(STAGE_W / 2, STAGE_H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x * STAGE_W, -cam.y * STAGE_H);
      ctx.translate(
        (tr.x + (fx?.shakeX ?? 0)) * STAGE_W,
        (tr.y + (fx?.shakeY ?? 0)) * STAGE_H,
      );
      ctx.rotate((tr.rotation * Math.PI) / 180);
      ctx.scale(tr.scale * (fx?.scaleMul ?? 1), tr.scale * (fx?.scaleMul ?? 1));
      ctx.globalAlpha =
        (ghost ? 0.3 : 1) *
        Math.max(0, Math.min(1, tr.opacity)) *
        (fx?.opacityMul ?? 1);
      if (fx && fx.glowPx > 0) {
        ctx.shadowColor = "rgba(255,240,200,0.95)";
        ctx.shadowBlur = fx.glowPx;
      }
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

    // Thời tiết của cảnh (S2) — cùng hàm tất định với bản xuất
    if (scene.weather && scene.weather.intensity > 0) {
      ctx.save();
      for (const p of weatherParticles(scene.weather, timeSec)) {
        const x = p.x * STAGE_W;
        const y = p.y * STAGE_H;
        if (scene.weather.type === "rain") {
          ctx.strokeStyle = `rgba(170,205,255,${p.alpha})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + p.drift * p.size * STAGE_H * 0.4, y + p.size * STAGE_H);
          ctx.stroke();
        } else {
          ctx.fillStyle =
            scene.weather.type === "snow"
              ? `rgba(255,255,255,${p.alpha})`
              : `rgba(255,235,170,${p.alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, p.size * STAGE_H), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Hệ hạt tự chế (R3) — cùng hàm thuần với bản xuất
    if (scene.particles && scene.particles.count > 0) {
      ctx.save();
      ctx.fillStyle = scene.particles.color;
      for (const p of particlePointsAt(scene.particles, timeSec)) {
        if (p.alpha < 0.02) continue;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x * STAGE_W, p.y * STAGE_H, Math.max(0.6, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Vệt vẽ tay (R3) + nét đang vẽ dở
    const drawStrokePath = (pts: { x: number; y: number }[], color: string, widthPx: number) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = widthPx * 0.7;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * STAGE_W, pts[0].y * STAGE_H);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * STAGE_W, pts[i].y * STAGE_H);
      ctx.stroke();
      ctx.restore();
    };
    for (const stroke of scene.strokes ?? []) {
      drawStrokePath(strokeVisiblePoints(stroke, timeSec), stroke.color, stroke.widthPx);
    }
    if (drawingStroke) drawStrokePath(drawingStroke, strokeColor, strokeWidth);

    // Đường đi của vật đang chọn (gắn chuyển động 2D): nét đứt qua các
    // điểm cong Catmull-Rom, điểm kiểm soát là chấm tròn (điểm đang chọn
    // màu vàng). Khi không ở chế độ vẽ thì vẽ mờ để thấy đường đã lưu.
    const pathToDraw =
      pathMode && pathDraft ? pathDraft : selectedLayer?.motionPath?.points;
    if (pathToDraw && pathToDraw.length >= 1) {
      const camDraw = draftCamDirty ? draftCam : sampleCamera(timeline.cameraKeys, timeSec);
      const toStage = (w: { x: number; y: number }) => ({
        x: ((w.x - camDraw.x) * camDraw.zoom + 0.5) * STAGE_W,
        y: ((w.y - camDraw.y) * camDraw.zoom + 0.5) * STAGE_H,
      });
      ctx.save();
      if (pathToDraw.length >= 2) {
        ctx.strokeStyle = pathMode ? "#f472b6" : "rgba(244,114,182,0.45)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const pt = toStage(catmullRomPoint(pathToDraw, i / 60));
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      pathToDraw.forEach((p, i) => {
        const s = toStage(p);
        ctx.fillStyle =
          i === selectedPathPoint && pathMode ? "#fbbf24" : "#f472b6";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
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

  }, [timeline, timeSec, draftDirty, draftT, draftCam, draftCamDirty, selectedLayerId, onion, scene.dialogue, scene.weather, scene.particles, scene.strokes, drawingStroke, strokeColor, strokeWidth, scene.durationSec, pathMode, pathDraft, selectedPathPoint]);

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

  // Mốc hiệu ứng theo thời gian của layer (R3)
  const addFxKey = () => {
    if (!selectedLayer) return;
    const fx = layerEffectsOf(selectedLayer.effects);
    const key: LayerEffectKey = {
      id: newKeyId("fxkey"),
      timeSec: Math.round(timeSec * 100) / 100,
      values: { opacity: 1, shake: fx.shake, glow: fx.glow, pulse: fx.pulse },
    };
    const rest = (selectedLayer.effectKeys ?? []).filter(
      (k) => Math.abs(k.timeSec - key.timeSec) > 1e-6,
    );
    updateLayer(selectedLayer.id, {
      effectKeys: [...rest, key].sort((a, b) => a.timeSec - b.timeSec),
    });
    setSelectedFxKeyId(key.id);
  };
  const updateFxKey = (keyId: string, values: LayerEffectKey["values"]) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      effectKeys: (selectedLayer.effectKeys ?? []).map((k) =>
        k.id === keyId ? { ...k, values } : k,
      ),
    });
  };
  const selectedFxKey =
    (selectedLayer?.effectKeys ?? []).find((k) => k.id === selectedFxKeyId) ??
    null;

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

  // ── Gắn chuyển động 2D ──────────────────────────────────────────────────
  const motionPreset = motionPresetById(motionPresetId);

  const attachMotion = () => {
    if (!selectedLayer || !motionPreset) return;
    const rest = sampleTransform(selectedLayer.keys, motionParams.startSec);
    const { keys, instance } = applyMotionPreset(
      selectedLayer.keys,
      motionPreset,
      motionParams,
      rest,
    );
    updateLayer(selectedLayer.id, {
      keys,
      ...(instance
        ? { motionInstances: [...(selectedLayer.motionInstances ?? []), instance] }
        : {}),
    });
    setMotionMsg(
      instance
        ? `Đã gắn “${motionPreset.name}” chạy ${MOTION_LOOP_LABEL[instance.params.loop].toLowerCase()} từ ${instance.params.startSec.toFixed(1)}s.`
        : `Đã gắn “${motionPreset.name}” thành keys thật — sửa tay từng key được.`,
    );
  };

  const bakeInstance = (inst: MotionInstance) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, {
      keys: bakeMotionInstance(selectedLayer.keys, inst),
      motionInstances: (selectedLayer.motionInstances ?? []).filter(
        (i) => i.id !== inst.id,
      ),
    });
    setMotionMsg(`Đã chuyển “${inst.name}” thành keys thật.`);
  };

  const enterPathMode = () => {
    const existing = selectedLayer?.motionPath;
    setPathDraft(existing ? existing.points.map((pt) => ({ ...pt })) : []);
    if (existing) {
      setPathParams({
        startSec: existing.startSec,
        durationSec: existing.durationSec,
        orientToPath: existing.orientToPath,
        easing: existing.easing,
      });
    }
    setSelectedPathPoint(null);
    setPathMode(true);
  };

  const commitPath = () => {
    if (!selectedLayer) return;
    const pts = pathDraft ?? [];
    if (pts.length < 2) {
      setMotionMsg("Đường cần ít nhất 2 điểm — bấm thêm điểm lên sân khấu.");
      return;
    }
    updateLayer(selectedLayer.id, {
      motionPath: {
        id: newKeyId("path"),
        points: pts,
        startSec: pathParams.startSec,
        durationSec: Math.max(0.1, pathParams.durationSec),
        orientToPath: pathParams.orientToPath,
        easing: pathParams.easing,
      },
    });
    setPathMode(false);
    setPathDraft(null);
    setSelectedPathPoint(null);
    setMotionMsg("Đã lưu đường đi cho vật.");
  };

  const refreshSavedMotions = async () => {
    try {
      const all = await listAnimAssets();
      setSavedMotions(all.filter((a): a is Motion2DAsset => a.kind === "motion2d"));
    } catch {
      /* thư viện chưa đọc được thì để danh sách cũ */
    }
  };

  const saveMotion = async () => {
    if (!motionPreset) return;
    const name = savedMotionName.trim();
    if (!name) {
      setMotionMsg("Nhập tên rồi mới lưu được.");
      return;
    }
    await saveAnimAsset({
      kind: "motion2d",
      id: newKeyId("motion"),
      name,
      presetId: motionPreset.id,
      params: motionParams,
      pathPoints:
        selectedLayer?.motionPath && selectedLayer.motionPath.points.length >= 2
          ? selectedLayer.motionPath.points
          : undefined,
      createdAt: Date.now(),
    });
    setSavedMotionName("");
    await refreshSavedMotions();
    setMotionMsg(`Đã lưu chuyển động “${name}”.`);
  };

  const applySavedMotion = (m: Motion2DAsset) => {
    if (!selectedLayer) return;
    const preset = motionPresetById(m.presetId);
    if (!preset) {
      setMotionMsg("Mẫu gốc của chuyển động này không còn nữa.");
      return;
    }
    const rest = sampleTransform(selectedLayer.keys, m.params.startSec);
    const { keys, instance } = applyMotionPreset(
      selectedLayer.keys,
      preset,
      m.params,
      rest,
    );
    updateLayer(selectedLayer.id, {
      keys,
      ...(instance
        ? { motionInstances: [...(selectedLayer.motionInstances ?? []), instance] }
        : {}),
      ...(m.pathPoints && m.pathPoints.length >= 2
        ? {
            motionPath: {
              id: newKeyId("path"),
              points: m.pathPoints,
              startSec: m.params.startSec,
              durationSec: Math.max(0.1, m.params.durationSec),
              orientToPath: true,
              easing: m.params.easing,
            },
          }
        : {}),
    });
    setMotionMsg(`Đã áp chuyển động “${m.name}”.`);
  };

  const copyMotionFrom = () => {
    if (!selectedLayer || !copyFromLayerId) return;
    const src = timeline.layers.find((l) => l.id === copyFromLayerId);
    if (!src) return;
    updateLayer(selectedLayer.id, {
      ...(src.motionInstances && src.motionInstances.length > 0
        ? {
            motionInstances: src.motionInstances.map((i) => ({
              ...i,
              id: newKeyId("minst"),
              cycleKeys: i.cycleKeys.map((k) => ({ ...k, id: newKeyId("mkey") })),
            })),
          }
        : {}),
      ...(src.motionPath
        ? { motionPath: { ...src.motionPath, id: newKeyId("path") } }
        : {}),
    });
    setMotionMsg(`Đã sao chép chuyển động từ “${src.name}”.`);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 p-3">
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
        <button
          onClick={() => setPropsOpen((v) => !v)}
          title={propsOpen ? "Thu gọn cột thuộc tính" : "Mở cột thuộc tính"}
          className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          {propsOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {propsOpen ? "Thu gọn panel" : "Mở panel"}
        </button>
      </div>

      <div className={`grid grid-cols-1 ${propsOpen ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)]"} gap-4 flex-1 min-h-0`}>
        <div className="min-w-0 min-h-0 flex flex-col overflow-hidden pr-0.5">
          <div className="relative flex-1 min-h-0">
            <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[10.5px] text-white/70">
              {strokeMode
                ? "Đang vẽ vệt: kéo chuột trên khung hình, nhả ra để lưu nét"
                : "Bấm layer để chọn · kéo để dời vị trí · xong bấm \"Đặt key\""}
            </span>
            <canvas
              ref={canvasRef}
              width={STAGE_W}
              height={STAGE_H}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              className={`w-full h-full object-contain rounded-xl border border-white/10 bg-black touch-none ${
                stageDragging ? "cursor-grabbing" : "cursor-grab"
              }`}
            />
          </div>
          <div className="mt-2 shrink-0 flex items-center gap-2">
            <button
              onClick={() => setPlaying((v) => !v)}
              aria-label={playing ? "Dừng" : "Phát"}
              className="p-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-rose-400 hover:opacity-90 transition"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Hoàn tác (Ctrl+Z)"
              aria-label="Hoàn tác"
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-35"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Làm lại (Ctrl+Y)"
              aria-label="Làm lại"
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-35"
            >
              <Redo2 className="w-4 h-4" />
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
                className="absolute bottom-0 w-2 h-2 rotate-45 bg-sky-400"
                style={{ left: `calc(${(k.timeSec / duration) * 100}% - 5px)` }}
              />
            ))}
          </div>
        </div>

        {propsOpen && (
        <div className="space-y-4 text-sm overflow-y-auto min-h-0 pr-0.5">
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
                <button
                  onClick={() => setDrawingLayer(true)}
                  className="mt-2 px-3 py-2 leading-snug rounded-lg bg-sky-500/25 border border-sky-300/35 hover:bg-sky-500/35 text-[12px] text-white"
                >
                  Vẽ / sửa hình bằng bút vẽ
                </button>
              </label>
            )}
            {drawingLayer && selectedLayer && (
              <DrawStudioModal
                title={`Vẽ hình cho layer "${selectedLayer.name}"`}
                initialDataUrl={selectedLayer.imageDataUrl}
                canvasWidth={960}
                canvasHeight={540}
                onClose={() => setDrawingLayer(false)}
                onSave={(dataUrl) => {
                  updateLayer(selectedLayer.id, { imageDataUrl: dataUrl });
                  setDrawingLayer(false);
                }}
              />
            )}
          </section>

          {/* Thời tiết của cảnh (S2) */}
          {onWeatherChange && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <h3 className="text-[12px] font-semibold text-white/70">
                HIỆU ỨNG CẢNH — THỜI TIẾT & KHÔNG KHÍ
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <select
                  value={scene.weather?.type ?? "none"}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v === "none") onWeatherChange(null);
                    else
                      onWeatherChange({
                        type: v as WeatherType,
                        intensity: scene.weather?.intensity ?? 0.7,
                      });
                  }}
                  className="h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-white/80"
                >
                  <option value="none">Không có</option>
                  <option value="rain">Mưa</option>
                  <option value="snow">Tuyết rơi</option>
                  <option value="sparkles">Lấp lánh</option>
                </select>
                {scene.weather && (
                  <label className="flex items-center gap-2 text-white/50 flex-1 min-w-[160px]">
                    Mật độ
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={scene.weather.intensity}
                      onChange={(e) =>
                        onWeatherChange({
                          ...scene.weather!,
                          intensity: Number(e.currentTarget.value),
                        })
                      }
                      className="flex-1 accent-sky-400"
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-white/35">
                Thời tiết hiện ở cả lúc dựng, lúc phát thử và trong bản xuất.
              </p>
            </section>
          )}

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
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold text-white/60">
                  HIỆU ỨNG CỦA LAYER NÀY
                </h4>
                {slider("Mờ hiện dần", layerEffectsOf(selectedLayer.effects).fadeInSec, 0, 3, 0.1, (v) =>
                  updateLayer(selectedLayer.id, {
                    effects: { ...layerEffectsOf(selectedLayer.effects), fadeInSec: v },
                  }), (v) => `${v.toFixed(1)}s`)}
                {slider("Mờ khuất dần", layerEffectsOf(selectedLayer.effects).fadeOutSec, 0, 3, 0.1, (v) =>
                  updateLayer(selectedLayer.id, {
                    effects: { ...layerEffectsOf(selectedLayer.effects), fadeOutSec: v },
                  }), (v) => `${v.toFixed(1)}s`)}
                {slider("Rung", layerEffectsOf(selectedLayer.effects).shake, 0, 1, 0.05, (v) =>
                  updateLayer(selectedLayer.id, {
                    effects: { ...layerEffectsOf(selectedLayer.effects), shake: v },
                  }), (v) => `${Math.round(v * 100)}%`)}
                {slider("Phát sáng", layerEffectsOf(selectedLayer.effects).glow, 0, 1, 0.05, (v) =>
                  updateLayer(selectedLayer.id, {
                    effects: { ...layerEffectsOf(selectedLayer.effects), glow: v },
                  }), (v) => `${Math.round(v * 100)}%`)}
                {slider("Nhịp phồng", layerEffectsOf(selectedLayer.effects).pulse, 0, 1, 0.05, (v) =>
                  updateLayer(selectedLayer.id, {
                    effects: { ...layerEffectsOf(selectedLayer.effects), pulse: v },
                  }), (v) => `${Math.round(v * 100)}%`)}
              </div>
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold text-white/60">
                  MỐC HIỆU ỨNG THEO THỜI GIAN
                </h4>
                <p className="text-[11px] leading-relaxed text-white/35">
                  Đặt mốc tại các thời điểm khác nhau để hiệu ứng tự biến
                  đổi (phát sáng tăng dần, rung mạnh rồi tắt...). Giữa hai
                  mốc, giá trị tự nội suy.
                </p>
                <button
                  onClick={addFxKey}
                  className="w-full h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 transition"
                >
                  + Đặt mốc hiệu ứng tại {timeSec.toFixed(2)}s
                </button>
                {(selectedLayer.effectKeys ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedLayer.effectKeys ?? []).map((k) => (
                      <span
                        key={k.id}
                        className={`flex items-center gap-1 px-2 h-6 rounded-md border text-[11px] ${
                          selectedFxKeyId === k.id
                            ? "bg-pink-500/20 border-pink-400/40 text-white"
                            : "bg-white/5 border-white/10 text-white/60"
                        }`}
                      >
                        <button onClick={() => setSelectedFxKeyId(k.id)}>
                          {k.timeSec.toFixed(2)}s
                        </button>
                        <button
                          onClick={() => {
                            updateLayer(selectedLayer.id, {
                              effectKeys: (selectedLayer.effectKeys ?? []).filter((x) => x.id !== k.id),
                            });
                            if (selectedFxKeyId === k.id) setSelectedFxKeyId(null);
                          }}
                          aria-label="Xoá mốc hiệu ứng"
                          className="text-white/40 hover:text-rose-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {selectedFxKey && (
                  <div className="space-y-2 rounded-lg bg-black/30 border border-white/5 p-2">
                    <div className="text-[11px] text-white/45">
                      Giá trị tại mốc {selectedFxKey.timeSec.toFixed(2)}s:
                    </div>
                    {slider("Độ mờ", selectedFxKey.values.opacity, 0, 1, 0.01, (v) =>
                      updateFxKey(selectedFxKey.id, { ...selectedFxKey.values, opacity: v }), (v) => `${Math.round(v * 100)}%`)}
                    {slider("Rung", selectedFxKey.values.shake, 0, 1, 0.05, (v) =>
                      updateFxKey(selectedFxKey.id, { ...selectedFxKey.values, shake: v }), (v) => `${Math.round(v * 100)}%`)}
                    {slider("Phát sáng", selectedFxKey.values.glow, 0, 1, 0.05, (v) =>
                      updateFxKey(selectedFxKey.id, { ...selectedFxKey.values, glow: v }), (v) => `${Math.round(v * 100)}%`)}
                    {slider("Nhịp phồng", selectedFxKey.values.pulse, 0, 1, 0.05, (v) =>
                      updateFxKey(selectedFxKey.id, { ...selectedFxKey.values, pulse: v }), (v) => `${Math.round(v * 100)}%`)}
                  </div>
                )}
              </div>
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
              {/* Chuyển động gắn 1 chạm: mẫu sinh keys thật, lặp chạy theo
                  tham số, đường vẽ tay trên sân khấu. */}
              <div className="pt-2 border-t border-white/5 space-y-2">
                <h4 className="text-[11px] font-semibold text-white/60">
                  CHUYỂN ĐỘNG — GẮN 1 CHẠM
                </h4>
                <select
                  value={motionPresetId}
                  onChange={(e) => setMotionPresetId(e.currentTarget.value)}
                  aria-label="Mẫu chuyển động"
                  className="w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                >
                  {(["enter", "exit", "emphasis"] as const).map((g) => (
                    <optgroup key={g} label={MOTION_GROUP_LABEL[g]}>
                      {MOTION_PRESETS.filter((p) => p.group === g).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {motionPreset && (
                  <p className="text-[11px] leading-relaxed text-white/35">
                    {motionPreset.desc}
                  </p>
                )}
                {slider("Bắt đầu", motionParams.startSec, 0, duration, 0.1, (v) =>
                  setMotionParams({ ...motionParams, startSec: v }),
                (v) => `${v.toFixed(1)}s`)}
                <button
                  onClick={() =>
                    setMotionParams({ ...motionParams, startSec: timeSec })
                  }
                  className="h-7 px-2 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
                >
                  Dùng mốc đang tua ({timeSec.toFixed(2)}s)
                </button>
                {slider("Thời lượng", motionParams.durationSec, 0.2, duration, 0.1, (v) =>
                  setMotionParams({ ...motionParams, durationSec: v }),
                (v) => `${v.toFixed(1)}s`)}
                {motionPreset?.usesDirection && (
                  <label className="flex items-center gap-2 text-[11px] text-white/50">
                    <span className="w-14 shrink-0">Hướng</span>
                    <select
                      value={motionParams.direction}
                      onChange={(e) =>
                        setMotionParams({
                          ...motionParams,
                          direction: e.currentTarget.value as MotionParams["direction"],
                        })
                      }
                      className="flex-1 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-[11px]"
                    >
                      {(["left", "right", "bottom"] as const).map((d) => (
                        <option key={d} value={d}>
                          {MOTION_DIRECTION_LABEL[d]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {motionPreset?.usesStrength &&
                  slider("Độ mạnh", motionParams.strength, 0, 2, 0.05, (v) =>
                    setMotionParams({ ...motionParams, strength: v }),
                  (v) => `${Math.round(v * 100)}%`)}
                <label className="flex items-center gap-2 text-[11px] text-white/50">
                  <span className="w-14 shrink-0">Mềm/cứng</span>
                  <select
                    value={motionParams.easing}
                    onChange={(e) =>
                      setMotionParams({
                        ...motionParams,
                        easing: e.currentTarget.value as EasingId,
                      })
                    }
                    className="flex-1 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-[11px]"
                  >
                    {EASING_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/50">
                  <span className="w-14 shrink-0">Lặp</span>
                  <select
                    value={motionParams.loop}
                    onChange={(e) =>
                      setMotionParams({
                        ...motionParams,
                        loop: e.currentTarget.value as MotionParams["loop"],
                      })
                    }
                    className="flex-1 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-[11px]"
                  >
                    {(["once", "loop", "pingpong"] as const).map((l) => (
                      <option key={l} value={l}>
                        {MOTION_LOOP_LABEL[l]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={attachMotion}
                  className="w-full h-8 rounded-lg bg-pink-500/25 border border-pink-400/40 text-[12px] font-medium hover:bg-pink-500/35"
                >
                  Gắn vào vật
                </button>
                <p className="text-[11px] leading-relaxed text-white/35">
                  Gắn một lần sinh keys thật — sửa tay từng key được. Gắn
                  lặp thì vật chạy theo tham số; muốn sửa tay thì bấm
                  “Chuyển thành keys” ở dưới.
                </p>
                {(selectedLayer.motionInstances ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-white/60">
                      ĐANG CHẠY LẶP
                    </div>
                    {(selectedLayer.motionInstances ?? []).map((inst) => (
                      <div
                        key={inst.id}
                        className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5 text-[11px] text-white/70"
                      >
                        <span className="flex-1 truncate">
                          {inst.name} · {MOTION_LOOP_LABEL[inst.params.loop]} · từ{" "}
                          {inst.params.startSec.toFixed(1)}s
                        </span>
                        <button
                          onClick={() => bakeInstance(inst)}
                          className="px-2 h-6 rounded bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          Chuyển thành keys
                        </button>
                        <button
                          onClick={() =>
                            updateLayer(selectedLayer.id, {
                              motionInstances: (selectedLayer.motionInstances ?? []).filter(
                                (i) => i.id !== inst.id,
                              ),
                            })
                          }
                          aria-label="Xoá chuyển động lặp"
                          className="text-white/40 hover:text-rose-400"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {motionMsg && (
                  <p className="text-[11px] text-emerald-300/80">{motionMsg}</p>
                )}

                <div className="pt-1 space-y-2">
                  <h5 className="text-[11px] font-semibold text-white/60">
                    ĐƯỜNG ĐI VẼ TAY
                  </h5>
                  {slider("Bắt đầu", pathParams.startSec, 0, duration, 0.1, (v) =>
                    setPathParams({ ...pathParams, startSec: v }),
                  (v) => `${v.toFixed(1)}s`)}
                  {slider("Thời lượng", pathParams.durationSec, 0.2, duration, 0.1, (v) =>
                    setPathParams({ ...pathParams, durationSec: v }),
                  (v) => `${v.toFixed(1)}s`)}
                  <label className="flex items-center gap-2 text-[11px] text-white/50">
                    <input
                      type="checkbox"
                      checked={pathParams.orientToPath}
                      onChange={(e) =>
                        setPathParams({ ...pathParams, orientToPath: e.currentTarget.checked })
                      }
                      className="accent-pink-500"
                    />
                    Xoay vật theo hướng đường đi
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-white/50">
                    <span className="w-14 shrink-0">Mềm/cứng</span>
                    <select
                      value={pathParams.easing}
                      onChange={(e) =>
                        setPathParams({
                          ...pathParams,
                          easing: e.currentTarget.value as EasingId,
                        })
                      }
                      className="flex-1 h-7 rounded bg-black/50 border border-white/10 px-1.5 text-[11px]"
                    >
                      {EASING_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!pathMode ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={enterPathMode}
                        className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                      >
                        {selectedLayer.motionPath ? "Sửa đường" : "Vẽ đường đi"}
                      </button>
                      {selectedLayer.motionPath && (
                        <button
                          onClick={() => {
                            updateLayer(selectedLayer.id, { motionPath: null });
                            setMotionMsg("Đã xoá đường đi.");
                          }}
                          className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-rose-300 hover:bg-white/10"
                        >
                          Xoá đường
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11px] leading-relaxed text-white/35">
                        Bấm lên sân khấu để thêm điểm, kéo điểm để dời
                        (điểm đang chọn màu vàng). Đang có{" "}
                        {(pathDraft ?? []).length} điểm.
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={commitPath}
                          className="flex-1 h-8 rounded-lg bg-pink-500/25 border border-pink-400/40 text-[12px] font-medium hover:bg-pink-500/35"
                        >
                          Xong — lưu đường
                        </button>
                        <button
                          onClick={() => {
                            setPathMode(false);
                            setPathDraft(null);
                            setSelectedPathPoint(null);
                          }}
                          className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                        >
                          Huỷ
                        </button>
                        <button
                          disabled={selectedPathPoint === null}
                          onClick={() => {
                            if (selectedPathPoint === null) return;
                            setPathDraft(
                              (pathDraft ?? []).filter((_, i) => i !== selectedPathPoint),
                            );
                            setSelectedPathPoint(null);
                          }}
                          className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-40"
                        >
                          Xoá điểm
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedLayer.motionPath && !pathMode && (
                    <p className="text-[11px] text-white/35">
                      Đã có đường {selectedLayer.motionPath.points.length} điểm, từ{" "}
                      {selectedLayer.motionPath.startSec.toFixed(1)}s trong{" "}
                      {selectedLayer.motionPath.durationSec.toFixed(1)}s.
                    </p>
                  )}
                </div>

                <div className="pt-1 space-y-2">
                  <h5 className="text-[11px] font-semibold text-white/60">
                    ĐÃ LƯU — DÙNG LẠI CHO VẬT KHÁC
                  </h5>
                  <div className="flex gap-1.5">
                    <input
                      value={savedMotionName}
                      onChange={(e) => setSavedMotionName(e.currentTarget.value)}
                      placeholder="Tên chuyển động riêng…"
                      className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none placeholder:text-white/25"
                    />
                    <button
                      onClick={saveMotion}
                      className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                    >
                      Lưu mẫu này
                    </button>
                  </div>
                  {savedMotions.length === 0 ? (
                    <p className="text-[11px] text-white/35">
                      Chưa có mẫu nào — chỉnh mẫu trên rồi lưu tên riêng để
                      dùng lại cho vật khác, dự án khác.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {savedMotions.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5 text-[11px] text-white/70"
                        >
                          <span className="flex-1 truncate">{m.name}</span>
                          <button
                            onClick={() => applySavedMotion(m)}
                            className="px-2 h-6 rounded bg-white/5 border border-white/10 hover:bg-white/10"
                          >
                            Áp
                          </button>
                          <button
                            onClick={async () => {
                              await deleteAnimAsset(m.id);
                              await refreshSavedMotions();
                            }}
                            aria-label="Xoá mẫu đã lưu"
                            className="text-white/40 hover:text-rose-400"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-1 space-y-2">
                  <h5 className="text-[11px] font-semibold text-white/60">
                    SAO CHÉP TỪ VẬT KHÁC
                  </h5>
                  <div className="flex gap-1.5">
                    <select
                      value={copyFromLayerId}
                      onChange={(e) => setCopyFromLayerId(e.currentTarget.value)}
                      aria-label="Vật nguồn để sao chép chuyển động"
                      className="flex-1 h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] outline-none"
                    >
                      <option value="" disabled>
                        Chọn vật trong cảnh…
                      </option>
                      {timeline.layers
                        .filter((l) => l.id !== selectedLayer.id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={copyMotionFrom}
                      disabled={!copyFromLayerId}
                      className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10 disabled:opacity-40"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>
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
                        setVoiceLineId((v) => (v === line.id ? null : line.id))
                      }
                      className={`flex items-center gap-1 px-2 h-7 rounded-lg border text-[11px] ml-auto ${
                        (line.takes ?? []).length > 0
                          ? "bg-fuchsia-500/20 border-fuchsia-300/40 text-fuchsia-100"
                          : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10"
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      Giọng{(line.takes ?? []).length > 0 ? ` (${(line.takes ?? []).length})` : ""}
                    </button>
                    <button
                      onClick={() =>
                        onDialogueChange(
                          (scene.dialogue ?? []).filter((x) => x.id !== line.id),
                        )
                      }
                      aria-label="Xoá dòng thoại"
                      className="text-white/35 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {voiceLineId === line.id && (
                    <DialogueVoice
                      line={line}
                      onChange={(next) =>
                        onDialogueChange(
                          (scene.dialogue ?? []).map((x) =>
                            x.id === next.id ? next : x,
                          ),
                        )
                      }
                    />
                  )}
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
          {onParticlesChange && (
            <SceneParticlesPanel
              value={scene.particles ?? null}
              onChange={onParticlesChange}
            />
          )}
          {onStrokesChange && (
            <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
              <h4 className="text-[12px] font-semibold text-white/60">
                VỆT VẼ TAY TRÊN KHUNG HÌNH
              </h4>
              <p className="text-[11px] leading-relaxed text-white/35">
                Bật chế độ vẽ rồi kéo chuột thẳng lên khung hình — vệt
                sáng phép thuật, đường bay, vòng nhấn... Nét vẽ xuất hiện
                dần đúng khoảng thời gian bạn vẽ.
              </p>
              <button
                onClick={() => setStrokeMode((v) => !v)}
                className={`w-full h-8 rounded-lg border text-[12px] font-medium transition ${
                  strokeMode
                    ? "bg-cyan-500/25 border-cyan-300/40 text-cyan-100"
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                }`}
              >
                {strokeMode ? "Đang vẽ — bấm để tắt chế độ vẽ" : "Bật chế độ vẽ vệt"}
              </button>
              <label className="flex items-center gap-2 text-[11px] text-white/50">
                <span className="w-14 shrink-0">Màu nét</span>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.currentTarget.value)}
                  className="w-10 h-7 rounded bg-white/5 border border-white/10 cursor-pointer"
                />
                <span className="text-white/60">{strokeColor}</span>
              </label>
              {slider("Độ dày nét", strokeWidth, 2, 30, 1, (v) => setStrokeWidth(v), (v) => `${Math.round(v)}px`)}
              {(scene.strokes ?? []).length > 0 && (
                <ul className="space-y-1">
                  {(scene.strokes ?? []).map((st, i) => (
                    <li
                      key={st.id}
                      className="flex items-center gap-2 text-[11px] text-white/55"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-none border border-white/20"
                        style={{ background: st.color }}
                      />
                      <span className="flex-1">
                        Vệt {i + 1} · từ {st.startSec.toFixed(1)}s, hiện trong{" "}
                        {st.durationSec.toFixed(1)}s
                      </span>
                      <button
                        onClick={() =>
                          onStrokesChange(
                            (scene.strokes ?? []).filter((x) => x.id !== st.id),
                          )
                        }
                        className="text-white/35 hover:text-rose-400"
                      >
                        Xoá
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {onAudioChange && (
            <SceneAudioPanel scene={scene} onChange={onAudioChange} />
          )}
        </div>
        )}
      </div>
      {/* Dải timeline đa track (R1): mọi thứ theo thời gian trên một trục */}
      <TimelineStrip
        timeline={timeline}
        dialogue={scene.dialogue ?? []}
        audioClips={scene.audioClips ?? []}
        duration={duration}
        timeSec={timeSec}
        selectedLayerId={selectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onSeek={(t) => {
          setPlaying(false);
          setTimeSec(t);
        }}
      />
    </div>
  );
}
