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
import {
  MODEL_DEFS,
  clampGround,
  createPlacement,
  migrateLegacyWorld,
  modelDef,
  rotatePlacement,
  snapToGrid,
  starterPlacements,
  type DioramaModelId,
  type DioramaPlacement,
  type DioramaState,
  type StoryEntity,
} from "../lib/diorama";
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
  const [leftTab, setLeftTab] = useState<"models" | "story">("models");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityKind, setNewEntityKind] = useState<StoryEntity["kind"]>("character");
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
      else if (placingModel) {
        setPlacingModel(null);
        setPendingEntityId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, placingModel]);

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
      if (!placingModel) return;
      const def = modelDef(placingModel);
      setState((s) => {
        if (!s) return s;
        const placement = createPlacement(
          placingModel,
          x,
          z,
          pendingEntityId,
          pendingEntityId
            ? (s.entities.find((e) => e.id === pendingEntityId)?.name ?? def.name)
            : undefined,
        );
        return { ...s, placements: [...s.placements, placement] };
      });
      setSelectedId(null);
      // Giữ chế độ đặt để bày nhiều vật liên tiếp; Esc hoặc bấm lại mẫu để dừng
      setPendingEntityId(null);
    },
    [placingModel, pendingEntityId],
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
      kind: newEntityKind,
      name,
      role: "",
      traits: [],
      description: "",
      color: "#8b5cf6",
    };
    setState({ ...state, entities: [...state.entities, entity] });
    setNewEntityName("");
    setNote(`Đã tạo thực thể "${name}" — bấm vào tên nó để đặt lên sa bàn.`);
  };

  if (!state) {
    return (
      <div className="h-screen grid place-items-center bg-[#0b0612] text-white/50 text-sm">
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
        {placingModel && (
          <span className="text-[12px] text-pink-200 bg-pink-500/15 border border-pink-400/30 rounded-full px-2.5 py-1">
            Đang đặt: {modelDef(placingModel).name}
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
          placing={placingModel !== null}
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
        </>
      ) : (
        <>
          <div className="flex gap-1.5 mb-2">
            <input
              value={newEntityName}
              onChange={(e) => setNewEntityName(e.currentTarget.value)}
              placeholder="Tên nhân vật / địa điểm / sự kiện…"
              className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
            />
            <select
              value={newEntityKind}
              onChange={(e) => setNewEntityKind(e.currentTarget.value as StoryEntity["kind"])}
              aria-label="Loại thực thể"
              className="h-9 rounded-lg bg-black/40 border border-white/10 px-1.5 text-[12px] outline-none"
            >
              <option value="character">Nhân vật</option>
              <option value="place">Địa điểm</option>
              <option value="event">Sự kiện</option>
            </select>
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
                      {e.kind === "character" ? "Nhân vật" : e.kind === "place" ? "Địa điểm" : "Sự kiện"}
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
              Mẫu: {modelDef(selected.modelId).name} · {modelDef(selected.modelId).license}
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
                    x: snapToGrid(clampGround(Number(e.target.value) || 0, modelDef(selected.modelId).footprint)),
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
                    z: snapToGrid(clampGround(Number(e.target.value) || 0, modelDef(selected.modelId).footprint)),
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
          {selectedEntity ? (
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: selectedEntity.color }} />
                <span className="text-[13px] font-medium">{selectedEntity.name}</span>
                <span className="text-[11px] text-white/40">
                  {selectedEntity.kind === "character" ? "Nhân vật" : selectedEntity.kind === "place" ? "Địa điểm" : "Sự kiện"}
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
              <div className="flex flex-wrap gap-1.5">
                {selectedEntity.traits.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                    {t}
                  </span>
                ))}
                {selectedEntity.traits.length === 0 && (
                  <span className="text-[11px] text-white/35">Chưa có đặc điểm nào.</span>
                )}
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
    <div className="h-screen bg-[#0b0612] text-white overflow-hidden">
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
