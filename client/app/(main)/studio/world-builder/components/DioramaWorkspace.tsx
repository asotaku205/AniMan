"use client";

/**
 * Sa bàn World Builder — lát cắt W1 (bố cục hướng A đã chốt):
 * cột trái = thư viện mẫu 3D + thực thể truyện, giữa = sa bàn 3D,
 * cột phải = hồ sơ của vật đang chọn. Có nút "Mở to bản đồ" để sa bàn
 * chiếm toàn màn hình (Esc hoặc nút thu nhỏ để thoát).
 *
 * Lưu bền: placement records + thực thể vào IndexedDB (khôi phục khi
 * F5). Lần đầu mở: chuyển dữ liệu nhân vật từ bản đồ hex cũ (hoặc
 * nhân vật mặc định nếu chưa có gì) sang sa bàn.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Plus,
  RotateCw,
  Trash2,
  X,
} from "lucide-react";
import { DioramaCanvas } from "./DioramaCanvas";
import DrawStudioModal from "../../animation/components/DrawStudioModal";
import {
  ASSET_STATUSES,
  MODEL_DEFS,
  addCustomField,
  addDesignExpression,
  addPaletteColor,
  addRelation,
  addTrait,
  addWorldEvent,
  clampGround,
  createPlacement,
  entityKindLabel,
  migrateLegacyWorld,
  modelDef,
  placementFootprint,
  removeCustomField,
  removeDesignExpression,
  removePaletteColor,
  removeRelation,
  removeTrait,
  removeWorldEvent,
  rotatePlacement,
  snapToGrid,
  sortedEvents,
  starterPlacements,
  type AssetStatus,
  type DioramaModelId,
  type DioramaPlacement,
  type DioramaState,
  type StoryEntity,
  type WorldEvent,
} from "../lib/diorama";
import { listAnimAssets } from "../../animation/lib/animStorage";
import type { Model3DAsset } from "../../animation/lib/animAssets";
import { inspectionSummary } from "../../animation/lib/modelInspect";
import {
  dataUrlToBytes,
  downloadHandoffZip,
  handoffPromptText,
} from "../lib/handoffZip";
import { loadDiorama, saveDiorama } from "../lib/dioramaStorage";
import { DEFAULT_CHARACTERS } from "../data";

const LEGACY_KEY = "animan-world-builder-v1";

interface LegacySaved {
  characters?: Array<{
    id: string;
    name: string;
    role: string;
    traits: string[];
    backstory: string;
    hexCol: number;
    hexRow: number;
    color: string;
  }>;
}

function readLegacy(): LegacySaved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacySaved;
    if (!Array.isArray(parsed.characters)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function DioramaWorkspace() {
  const [state, setState] = useState<DioramaState | null>(null);
  const [placingModel, setPlacingModel] = useState<DioramaModelId | null>(null);
  const [pendingEntityId, setPendingEntityId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<"models" | "story" | "events">("models");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityKind, setNewEntityKind] = useState("character");
  const [glbAssets, setGlbAssets] = useState<Model3DAsset[]>([]);
  const [placingGlb, setPlacingGlb] = useState<Model3DAsset | null>(null);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventEntities, setNewEventEntities] = useState<string[]>([]);
  const [fieldKeyDraft, setFieldKeyDraft] = useState("");
  const [fieldValueDraft, setFieldValueDraft] = useState("");
  const [paletteDraft, setPaletteDraft] = useState("#8b5cf6");
  const [exprLabelDraft, setExprLabelDraft] = useState("");
  const [designDraw, setDesignDraw] = useState<
    | { slot: "front" | "side" | "back"; initial: string | null }
    | { slot: "expr"; initial: null }
    | null
  >(null);
  const [traitDraft, setTraitDraft] = useState("");
  const [relTargetId, setRelTargetId] = useState("");
  const [relLabel, setRelLabel] = useState("");
  const firstSaveRef = useRef(true);

  // Nạp: IndexedDB trước; chưa có thì chuyển từ bản đồ hex cũ
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadDiorama();
      if (cancelled) return;
      if (saved) {
        setState(saved);
        return;
      }
      const legacy = readLegacy();
      const chars = legacy?.characters?.length
        ? legacy.characters
        : DEFAULT_CHARACTERS;
      const migrated = migrateLegacyWorld(chars);
      const next: DioramaState = {
        entities: migrated.entities,
        placements: [...starterPlacements(), ...migrated.placements],
        events: [],
      };
      setState(next);
      await saveDiorama(next).catch(() => undefined);
      setNote(
        legacy?.characters?.length
          ? `Đã chuyển ${chars.length} nhân vật từ bản đồ cũ sang sa bàn — vị trí giữ nguyên theo ô hex cũ.`
          : "Sa bàn khởi điểm đã sẵn sàng — kéo mẫu 3D thả vào mặt đất để bắt đầu bày thế giới.",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nạp danh sách GLB từ kho tài sản Animation Studio (W2): vật 3D
  // thật đặt lên sa bàn dùng chung 1 kho, không copy file.
  useEffect(() => {
    listAnimAssets()
      .then((all) =>
        setGlbAssets(
          all.filter((a): a is Model3DAsset => a.kind === "model3d"),
        ),
      )
      .catch(() => undefined);
  }, []);

  // Lưu bền (debounce) — lỗi lưu hiển thị, không nuốt âm thầm
  useEffect(() => {
    if (!state) return;
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      saveDiorama(state)
        .then(() => setSaveError(null))
        .catch(() => setSaveError("Không lưu được sa bàn — thay đổi có thể mất khi tải lại trang."));
    }, 400);
    return () => clearTimeout(t);
  }, [state]);

  // Esc: huỷ đặt vật / thoát mở to
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else if (placingModel || placingGlb) {
        setPlacingModel(null);
        setPlacingGlb(null);
        setPendingEntityId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, placingModel, placingGlb]);

  const updatePlacement = useCallback(
    (id: string, patch: Partial<DioramaPlacement>) => {
      setState((s) =>
        s
          ? {
              ...s,
              placements: s.placements.map((p) =>
                p.id === id ? { ...p, ...patch } : p,
              ),
            }
          : s,
      );
    },
    [],
  );
  const updateEntity = useCallback(
    (id: string, patch: Partial<StoryEntity>) => {
      setState((s) =>
        s
          ? {
              ...s,
              entities: s.entities.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
              ),
            }
          : s,
      );
    },
    [],
  );

  const handlePlace = useCallback(
    (x: number, z: number) => {
      if (!placingModel && !placingGlb) return;
      const modelId = placingModel ?? "character";
      const def = modelDef(modelId);
      setState((s) => {
        if (!s) return s;
        const placement = createPlacement(
          modelId,
          x,
          z,
          pendingEntityId,
          pendingEntityId
            ? (s.entities.find((e) => e.id === pendingEntityId)?.name ?? def.name)
            : (placingGlb?.name ?? undefined),
          placingGlb?.id ?? null,
        );
        return { ...s, placements: [...s.placements, placement] };
      });
      setSelectedId(null);
      // Giữ chế độ đặt để bày nhiều vật liên tiếp; Esc hoặc bấm lại mẫu để dừng
      setPendingEntityId(null);
    },
    [placingModel, placingGlb, pendingEntityId],
  );

  const selected = state?.placements.find((p) => p.id === selectedId) ?? null;
  const selectedEntity = selected?.storyEntityId
    ? (state?.entities.find((e) => e.id === selected.storyEntityId) ?? null)
    : null;

  const placeEntity = (entity: StoryEntity) => {
    const existing = state?.placements.find(
      (p) => p.storyEntityId === entity.id,
    );
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    setPlacingModel("character");
    setPendingEntityId(entity.id);
    setNote(
      `Đang đặt nhân vật "${entity.name}" — bấm vào mặt đất để đặt xuống (Esc để huỷ).`,
    );
  };

  const addEntity = () => {
    const name = newEntityName.trim();
    if (!name || !state) return;
    const entity: StoryEntity = {
      id: `ent-${Date.now().toString(36)}`,
      kind: newEntityKind.trim() || "character",
      name,
      role: "",
      traits: [],
      description: "",
      color: "#8b5cf6",
      relations: [],
      customFields: [],
      design2d: { palette: [], expressions: [] },
    };
    setState({ ...state, entities: [...state.entities, entity] });
    setNewEntityName("");
    setNote(`Đã tạo thực thể "${name}" — bấm vào tên nó để đặt lên sa bàn.`);
  };

  if (!state) {
    return (
      <div className="h-[calc(100dvh-76px)] grid place-items-center bg-[#0b0612] text-white/50 text-sm">
        Đang mở sa bàn…
      </div>
    );
  }

  const center = (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#0d0817]">
      {/* Thanh công cụ của sa bàn */}
      <div className="h-11 flex-none bg-[#0d0817] border-b border-white/5 flex items-center px-3 gap-2">
        <span className="text-white/40 text-xs font-medium">
          Sa bàn 3D · {state.placements.length} vật · {state.entities.length} thực thể truyện
        </span>
        {(placingModel || placingGlb) && (
          <span className="text-[12px] text-pink-200 bg-pink-500/15 border border-pink-400/30 rounded-full px-2.5 py-1">
            Đang đặt: {placingGlb ? placingGlb.name : placingModel ? modelDef(placingModel).name : ""}
            {pendingEntityId ? ` cho "${state.entities.find((e) => e.id === pendingEntityId)?.name}"` : ""}
            {" "}· bấm vào mặt đất (Esc để huỷ)
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => {
              if (!selected) return;
              updatePlacement(selected.id, rotatePlacement(selected));
            }}
            disabled={!selected}
            title="Xoay vật đã chọn 45°"
            className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-[12px] flex items-center gap-1 disabled:opacity-35"
          >
            <RotateCw size={13} /> Xoay 45°
          </button>
          <button
            onClick={() => {
              if (!selected) return;
              setState({
                ...state,
                placements: state.placements.filter((p) => p.id !== selected.id),
              });
              setSelectedId(null);
            }}
            disabled={!selected}
            title="Xoá vật đã chọn"
            className="h-8 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-rose-300 text-[12px] flex items-center gap-1 disabled:opacity-35"
          >
            <Trash2 size={13} /> Xoá vật
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Thu nhỏ bản đồ" : "Mở to bản đồ"}
            className="h-8 px-3 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px] flex items-center gap-1.5 hover:bg-violet-500/35"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {expanded ? "Thu nhỏ" : "Mở to bản đồ"}
          </button>
        </div>
      </div>
      {/* Khung nhìn 3D */}
      <div className="flex-1 min-h-0 relative">
        <DioramaCanvas
          placements={state.placements}
          entities={state.entities}
          selectedId={selectedId}
          placing={placingModel !== null || placingGlb !== null}
          glbDataUrls={Object.fromEntries(glbAssets.map((a) => [a.id, a.dataUrl]))}
          onSelect={setSelectedId}
          onPlace={handlePlace}
          onMove={(id, x, z) => updatePlacement(id, { x, z })}
        />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 rounded-full px-3.5 py-1.5 text-[11px] text-white/60 pointer-events-none whitespace-nowrap">
          Kéo để xoay góc nhìn · Lăn chuột để phóng to · Kéo vật để dời (snap 0.5)
        </div>
      </div>
    </div>
  );

  const left = (
    <aside className="w-[264px] flex-none bg-[#100a1f] border-r border-white/5 p-3 overflow-y-auto">
      <div className="flex gap-1.5 mb-3">
        {(
          [
            ["models", "Mẫu 3D"],
            ["story", "Câu chuyện"],
            ["events", "Sự kiện"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setLeftTab(tab)}
            className={`flex-1 h-9 rounded-lg text-[13px] font-medium ${leftTab === tab ? "bg-violet-500/25 border border-violet-400/40 text-violet-100" : "bg-white/5 border border-white/10 text-white/55"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {leftTab === "models" ? (
        <>
          <p className="text-[11px] text-white/40 leading-relaxed mb-2">
            Bấm một mẫu để cầm lên, rồi bấm vào mặt đất để đặt. Bấm lại mẫu
            để dừng đặt.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {MODEL_DEFS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setPlacingModel((cur) => (cur === m.id ? null : m.id));
                  setPlacingGlb(null);
                  setPendingEntityId(null);
                }}
                className={`rounded-xl border p-2.5 text-left ${placingModel === m.id ? "bg-violet-500/20 border-violet-400/50" : "bg-black/30 border-white/10 hover:border-white/25"}`}
              >
                <span
                  className="block w-full h-8 rounded-md mb-2"
                  style={{ background: m.parts[0].color === "__entity__" ? "#8b5cf6" : m.parts[0].color }}
                />
                <span className="block text-[12px] font-medium text-white/85">{m.name}</span>
                <span className="text-[10px] text-emerald-300/80">{m.license}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] font-medium text-white/60 mt-4 mb-2">
            Mô hình 3D thật (từ thư viện Animation Studio)
          </p>
          {glbAssets.length === 0 ? (
            <p className="text-[11px] text-white/40 leading-relaxed">
              Chưa có file GLB nào. Sang Animation Studio → Thư viện tài
              sản → nạp file .glb, rồi quay lại đây để đặt lên sa bàn.
            </p>
          ) : (
            <div className="space-y-1.5">
              {glbAssets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setPlacingGlb((cur) => (cur?.id === a.id ? null : a));
                    setPlacingModel(null);
                    setPendingEntityId(null);
                  }}
                  className={`w-full rounded-xl border p-2.5 text-left ${placingGlb?.id === a.id ? "bg-violet-500/20 border-violet-400/50" : "bg-black/30 border-white/10 hover:border-white/25"}`}
                >
                  <span className="block text-[12px] font-medium text-white/85">{a.name}</span>
                  <span className="block text-[11px] text-white/40">
                    {a.inspection ? inspectionSummary(a.inspection) : "Chưa kiểm tra cấu trúc"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : leftTab === "story" ? (
        <>
          <div className="flex gap-1.5 mb-2">
            <input
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.currentTarget.value)}
              placeholder="Tên nhân vật / địa điểm / sự kiện…"
              className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
            />
            <input
              value={newEntityKind}
              onChange={(e) => setNewEntityKind(e.currentTarget.value)}
              placeholder="Loại (VD: Quốc gia…)"
              list="wb-kind-suggestions"
              aria-label="Loại thực thể (tự đặt)"
              className="w-28 h-9 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
            />
            <datalist id="wb-kind-suggestions">
              <option value="character" />
              <option value="place" />
              <option value="event" />
            </datalist>
            <button
              onClick={addEntity}
              className="w-9 h-9 flex-none rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 grid place-items-center"
              aria-label="Thêm thực thể"
            >
              <Plus size={15} />
            </button>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed mb-2">
            Bấm vào thực thể để đặt nó lên sa bàn (nhân vật) hoặc xem vật
            đã gắn.
          </p>
          <div className="space-y-1.5">
            {state.entities.map((e) => {
              const linked = state.placements.filter((p) => p.storyEntityId === e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => placeEntity(e)}
                  className="w-full flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-left hover:border-white/25"
                >
                  <span className="w-2.5 h-2.5 flex-none rounded-full" style={{ background: e.color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium truncate">{e.name}</span>
                    <span className="block text-[11px] text-white/40">
                      {entityKindLabel(e.kind)}
                      {e.role ? ` · ${e.role}` : ""}
                    </span>
                  </span>
                  <span className="text-[11px] text-white/40 whitespace-nowrap">
                    {linked.length > 0 ? `${linked.length} vật` : "chưa đặt"}
                  </span>
                </button>
              );
            })}
            {state.entities.length === 0 && (
              <p className="text-[12px] text-white/40">Chưa có thực thể nào.</p>
            )}
          </div>
          {state.entities.length >= 2 && (
            <div className="mt-4">
              <p className="text-[11px] font-medium text-white/60 mb-2">
                Sơ đồ quan hệ — bấm vào tên để tới vật của thực thể đó
              </p>
              <div className="rounded-xl border border-white/10 bg-black/30 p-2 overflow-x-auto">
                <svg width="232" height="190" viewBox="0 0 232 190">
                  {(() => {
                    const n = state.entities.length;
                    const cx = 116;
                    const cy = 95;
                    const r = Math.min(84, 28 + n * 6);
                    const pos = new Map(
                      state.entities.map((e, i) => {
                        const a = (2 * Math.PI * i) / n - Math.PI / 2;
                        return [e.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }];
                      }),
                    );
                    const edges: React.ReactNode[] = [];
                    state.entities.forEach((e) => {
                      (e.relations ?? []).forEach((rel) => {
                        const from = pos.get(e.id);
                        const to = pos.get(rel.entityId);
                        if (!from || !to) return;
                        edges.push(
                          <g key={`${e.id}-${rel.entityId}`}>
                            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#a78bfa" strokeOpacity="0.45" strokeWidth="1" />
                            <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 3} textAnchor="middle" fontSize="8" fill="#c4b5fd">
                              {rel.label}
                            </text>
                          </g>,
                        );
                      });
                    });
                    return (
                      <>
                        {edges}
                        {state.entities.map((e) => {
                          const pnt = pos.get(e.id)!;
                          return (
                            <g
                              key={e.id}
                              onClick={() => placeEntity(e)}
                              style={{ cursor: "pointer" }}
                            >
                              <circle cx={pnt.x} cy={pnt.y} r="13" fill={e.color} fillOpacity="0.9" />
                              <text x={pnt.x} y={pnt.y + 3} textAnchor="middle" fontSize="9" fill="#fff">
                                {e.name.slice(0, 2)}
                              </text>
                              <title>{e.name}</title>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <p className="text-[10px] text-white/35 mt-1">
                  Vòng tròn = thực thể · Đường nối = quan hệ (ghi nhãn).
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex gap-1.5 mb-2">
            <input
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              placeholder="Tên sự kiện…"
              className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
            />
            <button
              onClick={() => {
                const title = newEventTitle.trim();
                if (!title) return;
                setState((prev) =>
                  prev
                    ? {
                        ...prev,
                        events: addWorldEvent(prev.events ?? [], {
                          title,
                          dateLabel: newEventDate.trim(),
                          entityIds: newEventEntities,
                          description: newEventDesc.trim(),
                        }),
                      }
                    : prev,
                );
                setNewEventTitle("");
                setNewEventDate("");
                setNewEventDesc("");
                setNewEventEntities([]);
              }}
              className="w-9 h-9 flex-none rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 grid place-items-center"
              aria-label="Thêm sự kiện"
            >
              <Plus size={15} />
            </button>
          </div>
          <input
            value={newEventDate}
            onChange={(e) => setNewEventDate(e.target.value)}
            placeholder="Thời gian (VD: Năm 1023, Kỷ nguyên Thứ ba…)"
            className="w-full h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none mb-2"
          />
          <textarea
            value={newEventDesc}
            onChange={(e) => setNewEventDesc(e.target.value)}
            placeholder="Mô tả sự kiện…"
            rows={2}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[12px] outline-none mb-2"
          />
          <p className="text-[11px] text-white/40 mb-1">Thực thể tham gia:</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {state.entities.map((e) => (
              <button
                key={e.id}
                onClick={() =>
                  setNewEventEntities((cur) =>
                    cur.includes(e.id) ? cur.filter((id) => id !== e.id) : [...cur, e.id],
                  )
                }
                className={`text-[11px] px-2 py-1 rounded-full border ${newEventEntities.includes(e.id) ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/60"}`}
              >
                {e.name}
              </button>
            ))}
            {state.entities.length === 0 && (
              <span className="text-[11px] text-white/35">Chưa có thực thể nào.</span>
            )}
          </div>
          <p className="text-[11px] font-medium text-white/60 mb-2">Dòng thời gian</p>
          <div className="space-y-1.5">
            {sortedEvents(state.events ?? []).map((ev) => (
              <div key={ev.id} className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium truncate">{ev.title}</span>
                    {ev.dateLabel && (
                      <span className="block text-[11px] text-white/40">{ev.dateLabel}</span>
                    )}
                  </span>
                  <button
                    onClick={() =>
                      setState((prev) =>
                        prev ? { ...prev, events: removeWorldEvent(prev.events ?? [], ev.id) } : prev,
                      )
                    }
                    aria-label="Xoá sự kiện"
                    className="text-white/35 hover:text-rose-300"
                  >
                    <X size={13} />
                  </button>
                </div>
                {ev.description && (
                  <p className="text-[11.5px] text-white/55 leading-relaxed mt-1">{ev.description}</p>
                )}
                {ev.entityIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ev.entityIds.map((id) => {
                      const ent = state.entities.find((e) => e.id === id);
                      if (!ent) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => placeEntity(ent)}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:border-violet-400/40"
                        >
                          {ent.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {(state.events ?? []).length === 0 && (
              <p className="text-[12px] text-white/40">Chưa có sự kiện nào.</p>
            )}
          </div>
        </>
      )}
    </aside>
  );

  const right = (
    <aside className="w-[320px] flex-none bg-[#100a1f] border-l border-white/5 p-3 overflow-y-auto">
      <h2 className="text-[12px] font-semibold tracking-wide text-white/70 mb-3">
        HỒ SƠ CỦA VẬT ĐANG CHỌN
      </h2>
      {selected ? (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-white/40 mb-1">Tên vật</label>
            <input
              value={selected.name}
              onChange={(e) => updatePlacement(selected.id, { name: e.currentTarget.value })}
              className="w-full h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[13px] outline-none"
            />
            <p className="text-[11px] text-white/40 mt-1">
              {selected.glbAssetId
                ? `Mẫu: ${glbAssets.find((a) => a.id === selected.glbAssetId)?.name ?? "File GLB"} · File GLB của bạn`
                : `Mẫu: ${modelDef(selected.modelId).name} · ${modelDef(selected.modelId).license}`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-white/40">
              Vị trí X
              <input
                type="number"
                step={0.5}
                value={selected.x}
                onChange={(e) =>
                  updatePlacement(selected.id, {
                    x: snapToGrid(clampGround(Number(e.target.value) || 0, placementFootprint(selected))),
                  })
                }
                className="mt-1 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
              />
            </label>
            <label className="block text-[11px] text-white/40">
              Vị trí Z
              <input
                type="number"
                step={0.5}
                value={selected.z}
                onChange={(e) =>
                  updatePlacement(selected.id, {
                    z: snapToGrid(clampGround(Number(e.target.value) || 0, placementFootprint(selected))),
                  })
                }
                className="mt-1 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
              />
            </label>
          </div>
          <label className="block text-[11px] text-white/40">
            Xoay (độ, nấc 45°)
            <input
              type="range"
              min={0}
              max={315}
              step={45}
              value={Math.round(((selected.rotationY * 180) / Math.PI) % 360)}
              onChange={(e) =>
                updatePlacement(selected.id, {
                  rotationY: (Number(e.target.value) * Math.PI) / 180,
                })
              }
              className="mt-1 w-full accent-violet-400"
            />
          </label>
          <label className="block text-[11px] text-white/40">
            Tỉ lệ: {selected.scale.toFixed(1)}×
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={selected.scale}
              onChange={(e) => updatePlacement(selected.id, { scale: Number(e.target.value) })}
              className="mt-1 w-full accent-violet-400"
            />
          </label>
          <button
            onClick={() => updatePlacement(selected.id, { visible: !selected.visible })}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
          >
            {selected.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            {selected.visible ? "Đang hiện" : "Đang ẩn"}
          </button>
          <label className="block text-[11px] text-white/40">
            Trạng thái tài sản
            <select
              value={selected.assetStatus ?? "rough"}
              onChange={(e) =>
                updatePlacement(selected.id, { assetStatus: e.target.value as AssetStatus })
              }
              className="mt-1 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
            >
              {ASSET_STATUSES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </label>
          {selectedEntity ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedEntity.color }} />
                <span className="text-[13px] font-medium">{selectedEntity.name}</span>
                <span className="text-[11px] text-white/40">
                  {entityKindLabel(selectedEntity.kind)}
                </span>
              </div>
              <input
                value={selectedEntity.role}
                onChange={(e) => updateEntity(selectedEntity.id, { role: e.target.value })}
                placeholder="Vai trò (VD: Học sinh năm 2…)"
                className="w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
              />
              <textarea
                value={selectedEntity.description}
                onChange={(e) => updateEntity(selectedEntity.id, { description: e.target.value })}
                placeholder="Tiểu sử / mô tả của thực thể này…"
                rows={4}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-2 py-1.5 text-[12px] outline-none resize-y"
              />
              <div>
                <p className="text-[11px] text-white/40 mb-1">Đặc điểm — bấm × để xoá, gõ thêm ở dưới</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntity.traits.map((t) => (
                    <span key={t} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                      {t}
                      <button
                        onClick={() => updateEntity(selectedEntity.id, removeTrait(selectedEntity, t))}
                        aria-label={`Xoá đặc điểm ${t}`}
                        className="text-white/40 hover:text-rose-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedEntity.traits.length === 0 && (
                    <span className="text-[11px] text-white/35">Chưa có đặc điểm nào.</span>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    value={traitDraft}
                    onChange={(e) => setTraitDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateEntity(selectedEntity.id, addTrait(selectedEntity, traitDraft));
                        setTraitDraft("");
                      }
                    }}
                    placeholder="Đặc điểm mới (VD: Kiên cường…)"
                    className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                  />
                  <button
                    onClick={() => {
                      updateEntity(selectedEntity.id, addTrait(selectedEntity, traitDraft));
                      setTraitDraft("");
                    }}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Thêm
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-white/40">
                Màu nhân vật
                <input
                  type="color"
                  value={selectedEntity.color}
                  onChange={(e) => updateEntity(selectedEntity.id, { color: e.target.value })}
                  aria-label="Màu nhân vật"
                  className="w-8 h-8 rounded bg-transparent cursor-pointer"
                />
                <span className="text-white/60">{selectedEntity.color}</span>
              </label>
              <div>
                <p className="text-[11px] text-white/40 mb-1">Quan hệ với thực thể khác</p>
                {selectedEntity.relations.map((r) => {
                  const target = state.entities.find((e) => e.id === r.entityId);
                  return (
                    <div key={r.entityId} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                      <button
                        onClick={() => {
                          const pl = state.placements.find((pp) => pp.storyEntityId === r.entityId);
                          if (pl) setSelectedId(pl.id);
                        }}
                        title={target ? "Nhảy tới vật của thực thể này" : undefined}
                        className="text-[12px] font-medium hover:text-violet-300 text-left"
                      >
                        {target?.name ?? "Thực thể đã xoá"}
                      </button>
                      <span className="text-[11px] text-white/40">— {r.label}</span>
                      <button
                        onClick={() => updateEntity(selectedEntity.id, removeRelation(selectedEntity, r.entityId))}
                        aria-label="Xoá quan hệ"
                        className="ml-auto text-white/35 hover:text-rose-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
                {selectedEntity.relations.length === 0 && (
                  <p className="text-[11px] text-white/35">Chưa có quan hệ nào.</p>
                )}
                <div className="flex gap-1.5 mt-1.5">
                  <select
                    value={relTargetId}
                    onChange={(e) => setRelTargetId(e.target.value)}
                    aria-label="Thực thể liên quan"
                    className="h-8 rounded-lg bg-black/40 border border-white/10 px-1.5 text-[12px] outline-none"
                  >
                    <option value="">Chọn thực thể…</option>
                    {state.entities
                      .filter((e) => e.id !== selectedEntity.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                  <input
                    value={relLabel}
                    onChange={(e) => setRelLabel(e.target.value)}
                    placeholder="Quan hệ (VD: Bạn thân)"
                    className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!relTargetId) return;
                      updateEntity(selectedEntity.id, addRelation(selectedEntity, relTargetId, relLabel));
                      setRelLabel("");
                    }}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Thêm
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/40 mb-1">Trường tự thêm — gõ tên trường rồi giá trị (VD: Sức mạnh = 90)</p>
                {(selectedEntity.customFields ?? []).map((f) => (
                  <div key={f.key} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                    <span className="text-[12px] text-white/70">{f.key}: {f.value}</span>
                    <button
                      onClick={() => updateEntity(selectedEntity.id, removeCustomField(selectedEntity, f.key))}
                      aria-label={`Xoá trường ${f.key}`}
                      className="ml-auto text-white/35 hover:text-rose-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5 mt-1.5">
                  <input
                    value={fieldKeyDraft}
                    onChange={(e) => setFieldKeyDraft(e.target.value)}
                    placeholder="Tên trường"
                    className="w-24 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                  />
                  <input
                    value={fieldValueDraft}
                    onChange={(e) => setFieldValueDraft(e.target.value)}
                    placeholder="Giá trị"
                    className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!fieldKeyDraft.trim()) return;
                      updateEntity(selectedEntity.id, addCustomField(selectedEntity, fieldKeyDraft, fieldValueDraft));
                      setFieldKeyDraft("");
                      setFieldValueDraft("");
                    }}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Thêm
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/40 mb-1">
                  Thiết kế 2D — vẽ 3 góc nhân vật để làm nguyên liệu cho AI 3D
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["front", "Trước"],
                      ["side", "Nghiêng"],
                      ["back", "Sau"],
                    ] as const
                  ).map(([slot, label]) => {
                    const img = selectedEntity.design2d?.[slot];
                    return (
                      <button
                        key={slot}
                        onClick={() => setDesignDraw({ slot, initial: img ?? null })}
                        className="rounded-lg border border-white/10 bg-black/30 p-1.5 text-center hover:border-violet-400/40"
                      >
                        {img ? (
                          <img src={img} alt={`Bản vẽ ${label}`} className="w-full h-14 object-contain rounded" />
                        ) : (
                          <span className="block h-14 grid place-items-center text-[11px] text-white/40">
                            Vẽ {label}
                          </span>
                        )}
                        <span className="block text-[10px] text-white/50 mt-1">{label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-white/40 mb-1">Bảng màu thiết kế</p>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(selectedEntity.design2d?.palette ?? []).map((c) => (
                      <button
                        key={c}
                        onClick={() => updateEntity(selectedEntity.id, removePaletteColor(selectedEntity, c))}
                        title={`Xoá màu ${c}`}
                        className="w-7 h-7 rounded-full border border-white/20"
                        style={{ background: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={paletteDraft}
                      onChange={(e) => setPaletteDraft(e.target.value)}
                      aria-label="Chọn màu thêm vào bảng"
                      className="w-7 h-7 rounded bg-transparent cursor-pointer"
                    />
                    <button
                      onClick={() => updateEntity(selectedEntity.id, addPaletteColor(selectedEntity, paletteDraft))}
                      className="h-7 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70"
                    >
                      Thêm màu
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-[11px] text-white/40 mb-1">Bảng biểu cảm</p>
                  {(selectedEntity.design2d?.expressions ?? []).map((ex) => (
                    <div key={ex.label} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
                      <img src={ex.dataUrl} alt={ex.label} className="w-8 h-8 object-contain rounded bg-black/40" />
                      <span className="text-[12px] text-white/70">{ex.label}</span>
                      <button
                        onClick={() => updateEntity(selectedEntity.id, removeDesignExpression(selectedEntity, ex.label))}
                        aria-label={`Xoá biểu cảm ${ex.label}`}
                        className="ml-auto text-white/35 hover:text-rose-400"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      value={exprLabelDraft}
                      onChange={(e) => setExprLabelDraft(e.target.value)}
                      placeholder="Tên biểu cảm (VD: Vui)"
                      className="flex-1 min-w-0 h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                    />
                    <button
                      onClick={() => setDesignDraw({ slot: "expr", initial: null })}
                      className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                    >
                      Vẽ
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const d = selectedEntity.design2d ?? { palette: [], expressions: [] };
                    const files = [
                      {
                        name: "prompt.txt",
                        data: new TextEncoder().encode(
                          handoffPromptText({
                            name: selectedEntity.name,
                            role: selectedEntity.role,
                            traits: selectedEntity.traits,
                            description: selectedEntity.description,
                            customFields: selectedEntity.customFields ?? [],
                            palette: d.palette,
                          }),
                        ),
                      },
                      ...(["front", "side", "back"] as const)
                        .filter((slot) => d[slot])
                        .map((slot) => ({ name: `view-${slot}.png`, data: dataUrlToBytes(d[slot]!) })),
                      ...d.expressions.map((ex) => ({
                        name: `expression-${ex.label}.png`,
                        data: dataUrlToBytes(ex.dataUrl),
                      })),
                    ];
                    downloadHandoffZip(
                      `${selectedEntity.name.replace(/[^a-zA-Z0-9-_]+/g, "-")}-handoff.zip`,
                      files,
                    );
                    setNote(`Đã xuất gói bàn giao cho "${selectedEntity.name}" — đưa file ZIP này sang Meshy/Tripo để sinh GLB.`);
                  }}
                  className="mt-3 w-full h-9 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px] font-medium"
                >
                  Xuất gói bàn giao cho AI 3D (ZIP)
                </button>
              </div>
              <p className="text-[11px] text-white/35 leading-relaxed">
                Hồ sơ này sống trong chính vật trên sa bàn — đổi ở đây là
                đổi chung cho mọi nơi dùng thực thể này.
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-white/40 leading-relaxed">
              Vật trang trí — chưa gắn thực thể truyện nào. Muốn gắn, chọn
              một thực thể ở cột trái rồi đặt lại vật này, hoặc đặt nhân
              vật mới từ thực thể đó.
            </p>
          )}
          <button
            onClick={() => {
              setState({
                ...state,
                placements: state.placements.filter((p) => p.id !== selected.id),
              });
              setSelectedId(null);
            }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-[12px]"
          >
            <Trash2 size={13} /> Xoá vật khỏi sa bàn
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-white/50 leading-relaxed">
            Bấm vào một vật trên sa bàn để xem và sửa hồ sơ của nó — tên,
            vị trí, hướng xoay, tỉ lệ và thực thể truyện gắn kèm.
          </p>
          <p className="text-[12.5px] text-white/50 leading-relaxed">
            Chưa có vật nào được chọn. Muốn bày thế giới: chọn mẫu ở cột
            trái rồi bấm vào mặt đất.
          </p>
        </div>
      )}
    </aside>
  );

  return (
    <div className="h-[calc(100dvh-76px)] bg-[#0b0612] text-white overflow-hidden">
      <div className="flex h-full">
        {left}
        {expanded ? (
          <div className="fixed inset-0 z-50 bg-[#0b0612] flex flex-col">
            {center}
          </div>
        ) : (
          center
        )}
        {right}
      </div>
      {designDraw && selectedEntity && (
        <DrawStudioModal
          title={
            designDraw.slot === "expr"
              ? `Vẽ biểu cảm: ${exprLabelDraft.trim() || "Không tên"}`
              : `Vẽ góc ${designDraw.slot === "front" ? "trước" : designDraw.slot === "side" ? "nghiêng" : "sau"} — ${selectedEntity.name}`
          }
          initialDataUrl={designDraw.initial}
          canvasWidth={720}
          canvasHeight={720}
          onSave={(dataUrl) => {
            if (designDraw.slot === "expr") {
              updateEntity(
                selectedEntity.id,
                addDesignExpression(selectedEntity, exprLabelDraft.trim() || "Không tên", dataUrl),
              );
              setExprLabelDraft("");
            } else {
              updateEntity(selectedEntity.id, {
                ...selectedEntity,
                design2d: {
                  ...(selectedEntity.design2d ?? { palette: [], expressions: [] }),
                  [designDraw.slot]: dataUrl,
                },
              });
            }
            setDesignDraw(null);
          }}
          onClose={() => setDesignDraw(null)}
        />
      )}
      {(note || saveError) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] bg-[#1a1226] border border-white/10 text-[12px] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2">
          <span className={saveError ? "text-rose-300" : "text-white/80"}>
            {saveError ?? note}
          </span>
          <button
            onClick={() => {
              setNote(null);
              setSaveError(null);
            }}
            aria-label="Đóng thông báo"
            className="text-white/40 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
