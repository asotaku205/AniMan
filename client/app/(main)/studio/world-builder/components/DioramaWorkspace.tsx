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
  addPartToModel,
  createCameraView,
  createCustomModel,
  removePartFromModel,
  updatePartInModel,
  MODEL_DEFS,
  addArticle,
  addCustomField,
  createFaction,
  parseMentions,
  removeArticle,
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
  type CustomModel,
  type ModelPart,
  type DioramaModelId,
  type DioramaPlacement,
  type DioramaState,
  type StoryEntity,
  type WorldEvent,
} from "../lib/diorama";
import { listAnimAssets } from "../../animation/lib/animStorage";
import {
  BIOMES,
  brushTerrain,
  createFlatTerrain,
  paintBiome,
  type TerrainBrushMode,
} from "../lib/terrain";
import type { Model3DAsset } from "../../animation/lib/animAssets";
import { inspectionSummary, inspectGlbDataUrl } from "../../animation/lib/modelInspect";
import { drawTopDownMap } from "../lib/topdownMap";
import { newAssetId } from "../../animation/lib/animAssets";
import { saveAnimAsset } from "../../animation/lib/animStorage";
import {
  dataUrlToBytes,
  downloadHandoffZip,
  handoffPromptText,
} from "../lib/handoffZip";
import {
  deleteWorld,
  getActiveWorldId,
  listWorlds,
  migrateLegacyWorld as migrateLegacyWorldRecord,
  newWorldId,
  saveWorld,
  setActiveWorldId as storeActiveWorldId,
  type WorldRecord,
} from "../lib/dioramaStorage";
import { WORLD_PRESETS, buildPresetWorld, type WorldPresetId } from "../lib/worldPresets";
import {
  entityToCharacterAsset,
  placeToAnimationProject,
  viewToBackgroundAsset,
} from "../lib/worldToAssets";
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
  const [leftTab, setLeftTab] = useState<"models" | "story" | "events" | "terrain" | "factions">("models");
  const [terrainTool, setTerrainTool] = useState<
    | { kind: "brush"; mode: TerrainBrushMode; radius: number; strength: number }
    | { kind: "biome"; biomeId: string; radius: number }
    | null
  >(null);
  const [terrainRadius, setTerrainRadius] = useState(2.5);
  const [terrainStrength, setTerrainStrength] = useState(0.5);
  const [terrainBiome, setTerrainBiome] = useState("grass");
  const [pathMode, setPathMode] = useState(false);
  const [draftPath, setDraftPath] = useState<Array<{ x: number; z: number }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newArticleTitle, setNewArticleTitle] = useState("");
  const [newArticleBody, setNewArticleBody] = useState("");
  const [newFactionName, setNewFactionName] = useState("");
  const [newFactionColor, setNewFactionColor] = useState("#ef4444");
  const [eraFilter, setEraFilter] = useState<string | null>(null);
  const [newEventEra, setNewEventEra] = useState("");
  const [flyTo, setFlyTo] = useState<{ position: [number, number, number]; target: [number, number, number]; nonce: number } | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const canvasApiRef = useRef<{
    capture: () => string | null;
    getCamera: () => { position: [number, number, number]; target: [number, number, number] } | null;
  } | null>(null);
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityKind, setNewEntityKind] = useState("character");
  const [glbAssets, setGlbAssets] = useState<Model3DAsset[]>([]);
  const [placingGlb, setPlacingGlb] = useState<Model3DAsset | null>(null);
  const [placingCustom, setPlacingCustom] = useState<CustomModel | null>(null);
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null);
  const [newCustomName, setNewCustomName] = useState("");
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
  const [worlds, setWorlds] = useState<WorldRecord[]>([]);
  const [activeWorldId, setActiveWorldId] = useState<string | null>(null);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Nạp (W7): nhiều world — danh sách world trước, world đang mở sau;
  // chưa có world nào thì migrate world đơn cũ, rồi tới bản đồ hex cũ.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await listWorlds().catch(() => [] as WorldRecord[]);
      if (cancelled) return;
      if (all.length > 0) {
        const activeId = getActiveWorldId();
        const active = all.find((w) => w.id === activeId) ?? all[0];
        setWorlds(all);
        setActiveWorldId(active.id);
        setState(active.state);
        return;
      }
      const rec = await migrateLegacyWorldRecord().catch(() => null);
      if (cancelled) return;
      if (rec) {
        setWorlds([rec]);
        setActiveWorldId(rec.id);
        storeActiveWorldId(rec.id);
        setState(rec.state);
        setNote("Đã chuyển sa bàn cũ của bạn thành world đầu tiên — giờ có thể tạo thêm world mới.");
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
        groundSize: 40,
        terrain: createFlatTerrain(),
        paths: [],
        customModels: [],
        factions: [],
        sky: { time: 10, weather: "clear", season: "summer" },
        views: [],
      };
      const world: WorldRecord = {
        id: newWorldId(),
        name: "Thế giới đầu tiên",
        updatedAt: Date.now(),
        state: next,
      };
      await saveWorld(world).catch(() => undefined);
      if (cancelled) return;
      setWorlds([world]);
      setActiveWorldId(world.id);
      storeActiveWorldId(world.id);
      setState(next);
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

  // Lưu bền (debounce) theo world đang mở — lỗi lưu hiển thị,
  // không nuốt âm thầm
  useEffect(() => {
    if (!state || !activeWorldId) return;
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    const worldName = worlds.find((w) => w.id === activeWorldId)?.name ?? "World";
    const t = setTimeout(() => {
      saveWorld({ id: activeWorldId, name: worldName, updatedAt: Date.now(), state })
        .then(() => setSaveError(null))
        .catch(() => setSaveError("Không lưu được sa bàn — thay đổi có thể mất khi tải lại trang."));
    }, 400);
    return () => clearTimeout(t);
  }, [state, activeWorldId]);

  // Esc: huỷ đặt vật / thoát mở to
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else if (terrainTool || pathMode) {
        setTerrainTool(null);
        setPathMode(false);
        setDraftPath([]);
      } else if (placingModel || placingGlb || placingCustom) {
        setPlacingModel(null);
        setPlacingGlb(null);
        setPlacingCustom(null);
        setPendingEntityId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, placingModel, placingGlb, placingCustom, terrainTool, pathMode]);

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

  const handleTerrainBrush = useCallback(
    (x: number, z: number) => {
      setState((prev) => {
        if (!prev || !terrainTool) return prev;
        const size = prev.groundSize ?? 40;
        if (terrainTool.kind === "brush") {
          return {
            ...prev,
            terrain: brushTerrain(
              prev.terrain,
              size,
              x,
              z,
              terrainTool.mode,
              terrainTool.radius,
              terrainTool.strength,
            ),
          };
        }
        return {
          ...prev,
          terrain: paintBiome(prev.terrain, size, x, z, terrainTool.radius, terrainTool.biomeId),
        };
      });
    },
    [terrainTool],
  );

  const handlePathPoint = useCallback((x: number, z: number) => {
    setDraftPath((cur) => [...cur, { x: snapToGrid(x), z: snapToGrid(z) }]);
  }, []);

  const handlePlace = useCallback(
    (x: number, z: number) => {
      if (!placingModel && !placingGlb && !placingCustom) return;
      const modelId = placingModel ?? "character";
      const customId = placingCustom?.id ?? null;
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
            : (placingCustom?.name ?? placingGlb?.name ?? undefined),
          placingGlb?.id ?? null,
        );
        if (customId) placement.customModelId = customId;
        return { ...s, placements: [...s.placements, placement] };
      });
      setSelectedId(null);
      // Giữ chế độ đặt để bày nhiều vật liên tiếp; Esc hoặc bấm lại mẫu để dừng
      setPendingEntityId(null);
    },
    [placingModel, placingGlb, placingCustom, pendingEntityId],
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
      articles: [],
      factionId: null,
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
        {(placingModel || placingGlb || placingCustom) && (
          <span className="text-[12px] text-pink-200 bg-pink-500/15 border border-pink-400/30 rounded-full px-2.5 py-1">
            Đang đặt: {placingGlb ? placingGlb.name : placingCustom ? placingCustom.name : placingModel ? modelDef(placingModel).name : ""}
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
          <span className="mx-1 h-5 w-px bg-white/10" />
          <span className="text-[11px] text-white/40 whitespace-nowrap">
            {Math.floor(state.sky.time)}:{state.sky.time % 1 === 0.5 ? "30" : "00"}
          </span>
          <input
            type="range" min={0} max={24} step={0.5}
            value={state.sky.time}
            onChange={(e) => setState({ ...state, sky: { ...state.sky, time: Number(e.target.value) } })}
            className="w-28 accent-amber-400"
            aria-label="Giờ trong ngày"
          />
          <select
            value={state.sky.weather}
            onChange={(e) => setState({ ...state, sky: { ...state.sky, weather: e.target.value as typeof state.sky.weather } })}
            className="h-8 rounded-lg bg-black/40 border border-white/10 px-1.5 text-[12px] outline-none"
            aria-label="Thời tiết"
          >
            <option value="clear">Trong trời</option>
            <option value="fog">Sương mù</option>
            <option value="rain">Mưa</option>
            <option value="snow">Tuyết</option>
          </select>
          <select
            value={state.sky.season}
            onChange={(e) => setState({ ...state, sky: { ...state.sky, season: e.target.value as typeof state.sky.season } })}
            className="h-8 rounded-lg bg-black/40 border border-white/10 px-1.5 text-[12px] outline-none"
            aria-label="Mùa"
          >
            <option value="spring">Xuân</option>
            <option value="summer">Hạ</option>
            <option value="autumn">Thu</option>
            <option value="winter">Đông</option>
          </select>
          <button
            onClick={() => {
              const url = canvasApiRef.current?.capture();
              if (!url) return;
              const a = document.createElement("a");
              a.href = url;
              a.download = "sa-ban.png";
              a.click();
              setNote("Đã chụp ảnh sa bàn (PNG).");
            }}
            className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70 hover:bg-white/10"
          >
            Chụp ảnh PNG
          </button>
          <button
            onClick={() => {
              const url = drawTopDownMap(state, 1024);
              if (!url) return;
              const a = document.createElement("a");
              a.href = url;
              a.download = "ban-do-2d.png";
              a.click();
              setNote("Đã xuất bản đồ 2D nhìn từ trên xuống (PNG 1024×1024).");
            }}
            className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70 hover:bg-white/10"
          >
            Xuất bản đồ 2D
          </button>
        </div>
      </div>
        {(state.views ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            <span className="text-[11px] text-white/40">Góc nhìn đã lưu:</span>
            {(state.views ?? []).map((v) => (
              <span key={v.id} className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 pl-2 pr-1 py-0.5">
                <button
                  onClick={() => setFlyTo({ position: v.position, target: v.target, nonce: Date.now() })}
                  className="text-[11px] text-white/70 hover:text-white"
                >
                  {v.name}
                </button>
                <button
                  onClick={() => setState({ ...state, views: (state.views ?? []).filter((x) => x.id !== v.id) })}
                  aria-label="Xoá góc nhìn"
                  className="text-white/35 hover:text-rose-300"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <input
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="Tên góc nhìn mới (VD: Toàn cảnh làng…)"
            className="w-56 h-8 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
          />
          <button
            onClick={() => {
              const cam = canvasApiRef.current?.getCamera();
              if (!cam) return;
              setState({ ...state, views: [...(state.views ?? []), createCameraView(newViewName || `Góc nhìn ${(state.views ?? []).length + 1}`, cam.position, cam.target)] });
              setNewViewName("");
              setNote("Đã lưu góc nhìn hiện tại — bấm tên góc nhìn để bay tới.");
            }}
            className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70 hover:bg-white/10"
          >
            Lưu góc nhìn hiện tại
          </button>
        </div>
      {/* Khung nhìn 3D */}
      <div className="flex-1 min-h-0 relative">
        <DioramaCanvas
          placements={state.placements}
          entities={state.entities}
          selectedId={selectedId}
          placing={placingModel !== null || placingGlb !== null || placingCustom !== null}
          glbDataUrls={Object.fromEntries(glbAssets.map((a) => [a.id, a.dataUrl]))}
          customModels={state.customModels ?? []}
          factions={state.factions ?? []}
          sky={state.sky}
          flyTo={flyTo}
          canvasApiRef={canvasApiRef}
          terrain={state.terrain}
          groundSize={state.groundSize ?? 40}
          paths={state.paths ?? []}
          draftPath={draftPath}
          terrainTool={terrainTool}
          pathMode={pathMode}
          onTerrainBrush={handleTerrainBrush}
          onPathPoint={handlePathPoint}
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
      <div className="mb-3">
        <label className="block text-[11px] text-white/40 mb-1">World đang mở</label>
        <div className="flex gap-1.5">
          <select
            value={activeWorldId ?? ""}
            onChange={async (e) => {
              const id = e.target.value;
              const target = worlds.find((w) => w.id === id);
              if (!target || !state || !activeWorldId || id === activeWorldId) return;
              const currentName = worlds.find((w) => w.id === activeWorldId)?.name ?? "World";
              await saveWorld({ id: activeWorldId, name: currentName, updatedAt: Date.now(), state }).catch(() => undefined);
              setActiveWorldId(id);
              storeActiveWorldId(id);
              setState(target.state);
              setSelectedId(null);
            }}
            className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowPresetPicker((v) => !v)}
            className="h-9 px-2.5 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px] whitespace-nowrap"
          >
            + Mới
          </button>
        </div>
        {showPresetPicker && (
          <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2.5 space-y-2">
            <input
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              placeholder="Tên world mới…"
              className="w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {WORLD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={async () => {
                    const world: WorldRecord = {
                      id: newWorldId(),
                      name: newWorldName.trim() || preset.name,
                      updatedAt: Date.now(),
                      state: buildPresetWorld(preset.id),
                    };
                    if (state && activeWorldId) {
                      const currentName = worlds.find((w) => w.id === activeWorldId)?.name ?? "World";
                      await saveWorld({ id: activeWorldId, name: currentName, updatedAt: Date.now(), state }).catch(() => undefined);
                    }
                    await saveWorld(world).catch(() => undefined);
                    setWorlds((prev) => [world, ...prev]);
                    setActiveWorldId(world.id);
                    storeActiveWorldId(world.id);
                    setState(world.state);
                    setSelectedId(null);
                    setNewWorldName("");
                    setShowPresetPicker(false);
                    setNote(`Đã tạo world "${world.name}" từ mẫu ${preset.name}.`);
                  }}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-left hover:border-violet-400/40"
                >
                  <span className="block text-[12px] font-medium text-white/85">{preset.name}</span>
                  <span className="block text-[10.5px] text-white/40 leading-snug">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-1.5 mt-2">
          <button
            onClick={() => {
              if (!state || !activeWorldId) return;
              const name = worlds.find((w) => w.id === activeWorldId)?.name ?? "world";
              const blob = new Blob(
                [JSON.stringify({ format: "animan-world", version: 1, name, state }, null, 2)],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${name}.animan-world.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
          >
            Xuất JSON
          </button>
          <label className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70 grid place-items-center cursor-pointer">
            Nhập JSON
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const parsed = JSON.parse(await file.text()) as { name?: string; state?: DioramaState };
                  const st = parsed.state;
                  if (!st || !Array.isArray(st.entities) || !Array.isArray(st.placements)) {
                    throw new Error("bad");
                  }
                  const norm: DioramaState = {
                    entities: st.entities,
                    placements: st.placements,
                    events: st.events ?? [],
                    groundSize: st.groundSize ?? 40,
                    terrain: st.terrain ?? createFlatTerrain(),
                    paths: st.paths ?? [],
                    customModels: st.customModels ?? [],
                    factions: st.factions ?? [],
                    sky: st.sky ?? { time: 10, weather: "clear", season: "summer" },
                    views: st.views ?? [],
                  };
                  const world: WorldRecord = {
                    id: newWorldId(),
                    name: parsed.name || file.name.replace(/\.animan-world\.json$/i, "").replace(/\.json$/i, ""),
                    updatedAt: Date.now(),
                    state: norm,
                  };
                  if (state && activeWorldId) {
                    const currentName = worlds.find((w) => w.id === activeWorldId)?.name ?? "World";
                    await saveWorld({ id: activeWorldId, name: currentName, updatedAt: Date.now(), state }).catch(() => undefined);
                  }
                  await saveWorld(world);
                  setWorlds((prev) => [world, ...prev]);
                  setActiveWorldId(world.id);
                  storeActiveWorldId(world.id);
                  setState(norm);
                  setSelectedId(null);
                  setNote(`Đã nhập world "${world.name}". Lưu ý: file GLB phải có sẵn trong kho tài sản thì vật 3D thật mới hiện lại.`);
                } catch {
                  setNote("File JSON không phải world AniMan — kiểm tra lại file rồi thử lại.");
                }
              }}
            />
          </label>
          <button
            onClick={async () => {
              if (!activeWorldId) return;
              if (confirmDeleteId !== activeWorldId) {
                setConfirmDeleteId(activeWorldId);
                setTimeout(() => setConfirmDeleteId((cur) => (cur === activeWorldId ? null : cur)), 3000);
                return;
              }
              await deleteWorld(activeWorldId).catch(() => undefined);
              const rest = worlds.filter((w) => w.id !== activeWorldId);
              setWorlds(rest);
              setConfirmDeleteId(null);
              if (rest.length > 0) {
                setActiveWorldId(rest[0].id);
                storeActiveWorldId(rest[0].id);
                setState(rest[0].state);
              } else {
                const world: WorldRecord = { id: newWorldId(), name: "Thế giới đầu tiên", updatedAt: Date.now(), state: buildPresetWorld("blank") };
                await saveWorld(world).catch(() => undefined);
                setWorlds([world]);
                setActiveWorldId(world.id);
                storeActiveWorldId(world.id);
                setState(world.state);
              }
              setSelectedId(null);
            }}
            className={`h-8 px-2.5 rounded-lg border text-[12px] ${confirmDeleteId === activeWorldId ? "bg-rose-500/30 border-rose-400/50 text-rose-100" : "bg-white/5 border-white/10 text-white/70"}`}
          >
            {confirmDeleteId === activeWorldId ? "Chắc chắn xoá?" : "Xoá"}
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 mb-3">
        {(
          [
            ["models", "Mẫu 3D"],
            ["story", "Câu chuyện"],
            ["events", "Sự kiện"],
            ["terrain", "Địa hình"],
            ["factions", "Phe phái"],
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
            Vật tự ghép (ghép từ chi tiết, đặt tên rồi dùng lại)
          </p>
          <div className="flex gap-1.5 mb-2">
            <input
              value={newCustomName}
              onChange={(e) => setNewCustomName(e.target.value)}
              placeholder="Tên vật mới (VD: Nhà sàn…)"
              className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
            />
            <button
              onClick={() => {
                const m = createCustomModel(newCustomName);
                setNewCustomName("");
                setEditingModel(m);
              }}
              className="h-9 px-3 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px]"
            >
              Tạo + sửa
            </button>
          </div>
          <div className="space-y-1.5">
            {(state.customModels ?? []).map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-2 rounded-xl border p-2.5 ${placingCustom?.id === m.id ? "bg-violet-500/20 border-violet-400/50" : "bg-black/30 border-white/10"}`}
              >
                <button
                  onClick={() => {
                    setPlacingCustom((cur) => (cur?.id === m.id ? null : m));
                    setPlacingModel(null);
                    setPlacingGlb(null);
                    setPendingEntityId(null);
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="block text-[12px] font-medium text-white/85 truncate">{m.name}</span>
                  <span className="block text-[11px] text-white/40">{m.parts.length} chi tiết · tự tạo</span>
                </button>
                <button
                  onClick={() => setEditingModel({ ...m, parts: m.parts.map((pt) => ({ ...pt })) })}
                  className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70"
                >
                  Sửa
                </button>
                <button
                  onClick={() => {
                    setState((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        customModels: (prev.customModels ?? []).filter((c) => c.id !== m.id),
                        placements: prev.placements.map((pl) =>
                          pl.customModelId === m.id ? { ...pl, customModelId: null } : pl,
                        ),
                      };
                    });
                    if (placingCustom?.id === m.id) setPlacingCustom(null);
                  }}
                  aria-label="Xoá vật tự ghép"
                  className="text-white/35 hover:text-rose-300"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {(state.customModels ?? []).length === 0 && (
              <p className="text-[11px] text-white/40 leading-relaxed">
                Chưa có vật tự ghép nào. Gõ tên rồi bấm "Tạo + sửa" để ghép
                nhà, cổng, giếng… từ chi tiết khối.
              </p>
            )}
          </div>
          <p className="text-[11px] font-medium text-white/60 mt-4 mb-2">
            Mô hình 3D thật (từ thư viện Animation Studio)
          </p>
          <label className="block mb-2">
            <span className="block h-9 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px] font-medium grid place-items-center cursor-pointer">
              Nạp file .glb từ máy (người, nhà, đạo cụ realistic…)
            </span>
            <input
              type="file"
              accept=".glb"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const r = new FileReader();
                    r.onload = () => resolve(String(r.result));
                    r.onerror = () => reject(new Error("read"));
                    r.readAsDataURL(file);
                  });
                  const inspection = await inspectGlbDataUrl(dataUrl);
                  await saveAnimAsset({
                    kind: "model3d",
                    id: newAssetId("model"),
                    name: file.name.replace(/\.glb$/i, ""),
                    dataUrl,
                    createdAt: Date.now(),
                    inspection: inspection ?? undefined,
                  });
                  const all = await listAnimAssets();
                  setGlbAssets(all.filter((a): a is Model3DAsset => a.kind === "model3d"));
                  setNote(`Đã nạp "${file.name}" — bấm vào nó ở danh sách để đặt lên sa bàn.`);
                } catch {
                  setNote("Không nạp được file .glb này — kiểm tra lại file rồi thử lại.");
                }
              }}
            />
          </label>
          <p className="text-[11px] text-white/40 leading-relaxed mb-2">
            Nguồn model realistic miễn phí: Meshy/Tripo sinh từ gói bàn
            giao (tab hồ sơ), Mixamo (người rig sẵn), Ready Player Me,
            Poly Haven (đạo cụ CC0).
          </p>
          {glbAssets.length === 0 ? (
            <p className="text-[11px] text-white/40 leading-relaxed">
              Chưa có file GLB nào. Nạp file ở trên, hoặc sang Animation
              Studio → Thư viện tài sản để nạp.
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
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm trong world: tên, vai trò, đặc điểm, bài viết…"
            className="w-full h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none mb-2"
          />
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
          <button
            onClick={() => {
              const entity: StoryEntity = {
                id: `ent-${Date.now().toString(36)}`,
                kind: "Hệ thống",
                name: "Hệ thống mới",
                role: "Luật lệ / magic của world",
                traits: [],
                description: "",
                color: "#38bdf8",
                relations: [],
                customFields: [
                  { key: "Nguồn gốc", value: "" },
                  { key: "Giới hạn", value: "" },
                  { key: "Cái giá", value: "" },
                ],
                design2d: { palette: [], expressions: [] },
                articles: [],
                factionId: null,
              };
              setState({ ...state, entities: [...state.entities, entity] });
              setNote("Đã tạo thực thể Hệ thống — sửa tên và điền Nguồn gốc / Giới hạn / Cái giá trong hồ sơ.");
            }}
            className="w-full h-8 mb-2 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
          >
            + Tạo hệ thống luật lệ / magic (mẫu sẵn)
          </button>
          <div className="space-y-1.5">
            {state.entities
              .filter((e) => {
                const q = searchQuery.trim().toLowerCase();
                if (!q) return true;
                const hay = [
                  e.name, e.role, e.description, e.kind,
                  ...e.traits,
                  ...(e.articles ?? []).map((a) => `${a.title} ${a.body}`),
                  ...(e.customFields ?? []).map((f) => `${f.key} ${f.value}`),
                ].join(" ").toLowerCase();
                return hay.includes(q);
              })
              .map((e) => {
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
      ) : leftTab === "events" ? (
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
                          era: newEventEra.trim() || undefined,
                          entityIds: newEventEntities,
                          description: newEventDesc.trim(),
                        }),
                      }
                    : prev,
                );
                setNewEventTitle("");
                setNewEventDate("");
                setNewEventEra("");
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
            placeholder="Thời gian (VD: Năm 1023…)"
            className="w-full h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none mb-2"
          />
          <input
            value={newEventEra}
            onChange={(e) => setNewEventEra(e.target.value)}
            placeholder="Kỷ nguyên (VD: Kỷ nguyên Thứ ba — để trống nếu không có)"
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
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              onClick={() => setEraFilter(null)}
              className={`text-[11px] px-2 py-1 rounded-full border ${eraFilter === null ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/60"}`}
            >
              Tất cả
            </button>
            {Array.from(new Set((state.events ?? []).map((e) => e.era).filter((x): x is string => !!x))).map((era) => (
              <button
                key={era}
                onClick={() => setEraFilter(era)}
                className={`text-[11px] px-2 py-1 rounded-full border ${eraFilter === era ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/60"}`}
              >
                {era}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            {sortedEvents(state.events ?? [])
              .filter((ev) => eraFilter === null || ev.era === eraFilter)
              .map((ev) => (
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
      ) : leftTab === "terrain" ? (
        <>
          <p className="text-[11px] text-white/40 leading-relaxed mb-3">
            Bấm/kéo trực tiếp trên sa bàn để nặn địa hình. Vật đặt trên
            đất tự bám theo cao độ — đào hố rồi đặt nhà xuống hố là nhà
            chìm theo, không lơ lửng.
          </p>
          <p className="text-[11px] font-medium text-white/60 mb-1.5">Cọ địa hình</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(
              [
                ["raise", "Nâng đất"],
                ["lower", "Hạ đất"],
                ["flatten", "San phẳng"],
              ] as const
            ).map(([mode, label]) => {
              const active = terrainTool?.kind === "brush" && terrainTool.mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setPathMode(false);
                    setTerrainTool((cur) =>
                      active
                        ? null
                        : { kind: "brush", mode, radius: terrainRadius, strength: terrainStrength },
                    );
                  }}
                  className={`h-8 px-3 rounded-lg border text-[12px] ${active ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="block text-[11px] text-white/40 mb-2">
            Bán kính cọ: {terrainRadius.toFixed(1)}m
            <input
              type="range" min={1} max={5} step={0.5} value={terrainRadius}
              onChange={(e) => {
                const r = Number(e.target.value);
                setTerrainRadius(r);
                setTerrainTool((cur) => (cur ? { ...cur, radius: r } : cur));
              }}
              className="mt-1 w-full accent-violet-400"
            />
          </label>
          <label className="block text-[11px] text-white/40 mb-3">
            Độ mạnh: {terrainStrength.toFixed(1)}
            <input
              type="range" min={0.1} max={1} step={0.1} value={terrainStrength}
              onChange={(e) => {
                const v = Number(e.target.value);
                setTerrainStrength(v);
                setTerrainTool((cur) =>
                  cur?.kind === "brush" ? { ...cur, strength: v } : cur,
                );
              }}
              className="mt-1 w-full accent-violet-400"
            />
          </label>
          <p className="text-[11px] font-medium text-white/60 mb-1.5">Cọ biome (tô vùng đất)</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {BIOMES.map((b) => {
              const active = terrainTool?.kind === "biome" && terrainTool.biomeId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setPathMode(false);
                    setTerrainBiome(b.id);
                    setTerrainTool((cur) =>
                      active ? null : { kind: "biome", biomeId: b.id, radius: terrainRadius },
                    );
                  }}
                  title={b.name}
                  className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] ${active ? "border-violet-400/60 bg-violet-500/20 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: b.color }} />
                  {b.name}
                </button>
              );
            })}
          </div>
          <label className="block text-[11px] text-white/40 mb-3">
            Mực nước: {state.terrain.waterLevel <= -1 ? "Tắt" : `${state.terrain.waterLevel.toFixed(2)}m`}
            <input
              type="range" min={-1} max={3} step={0.25} value={state.terrain.waterLevel}
              onChange={(e) =>
                setState((prev) =>
                  prev ? { ...prev, terrain: { ...prev.terrain, waterLevel: Number(e.target.value) } } : prev,
                )
              }
              className="mt-1 w-full accent-violet-400"
            />
          </label>
          <p className="text-[11px] font-medium text-white/60 mb-1.5">Đường đi</p>
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => {
                setTerrainTool(null);
                setPathMode((v) => !v);
              }}
              className={`h-8 px-3 rounded-lg border text-[12px] ${pathMode ? "bg-violet-500/25 border-violet-400/40 text-violet-100" : "bg-white/5 border-white/10 text-white/70"}`}
            >
              {pathMode ? "Đang vẽ đường…" : "Vẽ đường"}
            </button>
            {draftPath.length > 0 && (
              <>
                <button
                  onClick={() => {
                    setState((prev) =>
                      prev
                        ? { ...prev, paths: [...(prev.paths ?? []), { id: `path-${Date.now().toString(36)}`, points: draftPath }] }
                        : prev,
                    );
                    setDraftPath([]);
                    setPathMode(false);
                  }}
                  className="h-8 px-3 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px]"
                >
                  Xong đường
                </button>
                <button
                  onClick={() => {
                    setDraftPath([]);
                    setPathMode(false);
                  }}
                  className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[12px]"
                >
                  Huỷ
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-white/40 mb-2">
            {pathMode
              ? `Bấm lên sa bàn để thêm điểm (${draftPath.length} điểm) — bấm "Xong đường" để lưu.`
              : "Bấm Vẽ đường rồi bấm từng điểm trên sa bàn để nối thành đường đất."}
          </p>
          <div className="space-y-1.5 mb-4">
            {(state.paths ?? []).map((path) => (
              <div key={path.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2">
                <span className="flex-1 text-[12px] text-white/70">Đường · {path.points.length} điểm</span>
                <button
                  onClick={() =>
                    setState((prev) =>
                      prev ? { ...prev, paths: (prev.paths ?? []).filter((pp) => pp.id !== path.id) } : prev,
                    )
                  }
                  aria-label="Xoá đường"
                  className="text-white/35 hover:text-rose-300"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <label className="block text-[11px] text-white/40">
            Cỡ sa bàn
            <select
              value={state.groundSize ?? 40}
              onChange={(e) => {
                const size = Number(e.target.value);
                setState((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    groundSize: size,
                    placements: prev.placements.map((pl) => ({
                      ...pl,
                      x: clampGround(pl.x, placementFootprint(pl, prev.customModels ?? []), size),
                      z: clampGround(pl.z, placementFootprint(pl, prev.customModels ?? []), size),
                    })),
                  };
                });
              }}
              className="mt-1 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
            >
              <option value={20}>20 × 20m (nhỏ, chi tiết)</option>
              <option value={40}>40 × 40m (mặc định)</option>
              <option value={60}>60 × 60m (rộng, toàn cảnh)</option>
            </select>
          </label>
        </>
      ) : (
        <>
          <p className="text-[11px] text-white/40 leading-relaxed mb-3">
            Phe phái tô màu viền dưới chân vật trên sa bàn — nhìn là
            biết vật thuộc phe nào. Một thực thể chỉ thuộc một phe.
          </p>
          <div className="flex gap-1.5 mb-3">
            <input
              value={newFactionName}
              onChange={(e) => setNewFactionName(e.target.value)}
              placeholder="Tên phe (VD: Hội Pháp sư…)"
              className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[12px] outline-none"
            />
            <input
              type="color"
              value={newFactionColor}
              onChange={(e) => setNewFactionColor(e.target.value)}
              aria-label="Màu phe"
              className="w-9 h-9 rounded bg-transparent cursor-pointer"
            />
            <button
              onClick={() => {
                if (!newFactionName.trim()) return;
                setState((prev) =>
                  prev ? { ...prev, factions: [...(prev.factions ?? []), createFaction(newFactionName, newFactionColor)] } : prev,
                );
                setNewFactionName("");
              }}
              className="w-9 h-9 flex-none rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 grid place-items-center"
              aria-label="Thêm phe"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="space-y-2">
            {(state.factions ?? []).map((f) => (
              <div key={f.id} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: f.color }} />
                  <span className="flex-1 text-[12.5px] font-medium">{f.name}</span>
                  <button
                    onClick={() =>
                      setState((prev) =>
                        prev
                          ? {
                              ...prev,
                              factions: (prev.factions ?? []).filter((x) => x.id !== f.id),
                              entities: prev.entities.map((e) =>
                                e.factionId === f.id ? { ...e, factionId: null } : e,
                              ),
                            }
                          : prev,
                      )
                    }
                    aria-label="Xoá phe"
                    className="text-white/35 hover:text-rose-300"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {state.entities.map((e) => {
                    const inFac = f.memberIds.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        onClick={() =>
                          setState((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              factions: (prev.factions ?? []).map((x) =>
                                x.id === f.id
                                  ? { ...x, memberIds: inFac ? x.memberIds.filter((id) => id !== e.id) : [...x.memberIds, e.id] }
                                  : { ...x, memberIds: x.memberIds.filter((id) => id !== e.id) },
                              ),
                              entities: prev.entities.map((ent) =>
                                ent.id === e.id
                                  ? { ...ent, factionId: inFac ? null : f.id }
                                  : ent,
                              ),
                            };
                          })
                        }
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${inFac ? "text-white border-white/30" : "bg-white/5 border-white/10 text-white/55"}`}
                        style={inFac ? { background: `${f.color}55` } : undefined}
                      >
                        {e.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {(state.factions ?? []).length === 0 && (
              <p className="text-[12px] text-white/40">Chưa có phe nào.</p>
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
                    x: snapToGrid(clampGround(Number(e.target.value) || 0, placementFootprint(selected, state.customModels ?? []))),
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
                    z: snapToGrid(clampGround(Number(e.target.value) || 0, placementFootprint(selected, state.customModels ?? []))),
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
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px] text-white/40">
              Nghiêng X: {Math.round(((selected.rotationX ?? 0) * 180) / Math.PI)}°
              <input
                type="range" min={-90} max={90} step={15}
                value={Math.round(((selected.rotationX ?? 0) * 180) / Math.PI)}
                onChange={(e) => updatePlacement(selected.id, { rotationX: (Number(e.target.value) * Math.PI) / 180 })}
                className="mt-1 w-full accent-violet-400"
              />
            </label>
            <label className="block text-[11px] text-white/40">
              Nghiêng Z: {Math.round(((selected.rotationZ ?? 0) * 180) / Math.PI)}°
              <input
                type="range" min={-90} max={90} step={15}
                value={Math.round(((selected.rotationZ ?? 0) * 180) / Math.PI)}
                onChange={(e) => updatePlacement(selected.id, { rotationZ: (Number(e.target.value) * Math.PI) / 180 })}
                className="mt-1 w-full accent-violet-400"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["scaleX", "Rộng"],
                ["scaleY", "Cao"],
                ["scaleZ", "Sâu"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-[11px] text-white/40">
                {label}: {(selected[key] ?? 1).toFixed(1)}×
                <input
                  type="range" min={0.5} max={2} step={0.1}
                  value={selected[key] ?? 1}
                  onChange={(e) => updatePlacement(selected.id, { [key]: Number(e.target.value) } as Partial<DioramaPlacement>)}
                  className="mt-1 w-full accent-violet-400"
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[11px] text-white/40">
            Màu tổng thể (ghi đè màu gốc)
            <input
              type="color"
              value={selected.tint ?? "#ffffff"}
              onChange={(e) => updatePlacement(selected.id, { tint: e.target.value })}
              className="w-8 h-8 rounded bg-transparent cursor-pointer"
            />
            {selected.tint && (
              <button
                onClick={() => updatePlacement(selected.id, { tint: null })}
                className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70"
              >
                Bỏ màu
              </button>
            )}
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                const copy: DioramaPlacement = {
                  ...selected,
                  id: `pl-${Date.now().toString(36)}`,
                  name: `${selected.name} (bản sao)`,
                  x: snapToGrid(clampGround(selected.x + 1.5, placementFootprint(selected, state.customModels ?? []), state.groundSize ?? 40)),
                };
                setState({ ...state, placements: [...state.placements, copy] });
                setSelectedId(copy.id);
              }}
              className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
            >
              Nhân đôi vật
            </button>
            <button
              onClick={() => updatePlacement(selected.id, { locked: !selected.locked })}
              className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
            >
              {selected.locked ? "Đã khóa (bấm để mở)" : "Khóa vật"}
            </button>
          </div>
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
                <div>
                  <p className="text-[11px] text-white/40 mb-1">Phe phái</p>
                  <select
                    value={selectedEntity.factionId ?? ""}
                    onChange={(e) => {
                      const fid = e.target.value || null;
                      setState((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          factions: (prev.factions ?? []).map((f) => ({
                            ...f,
                            memberIds: fid === f.id
                              ? [...new Set([...f.memberIds, selectedEntity.id])]
                              : f.memberIds.filter((id) => id !== selectedEntity.id),
                          })),
                          entities: prev.entities.map((ent) =>
                            ent.id === selectedEntity.id ? { ...ent, factionId: fid } : ent,
                          ),
                        };
                      });
                    }}
                    className="w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                  >
                    <option value="">Không thuộc phe nào</option>
                    {(state.factions ?? []).map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={async () => {
                      const placement = state.placements.find((p) => p.storyEntityId === selectedEntity.id);
                      if (!placement) {
                        setNote("Thực thể này chưa có vật trên sa bàn — đặt nó lên sa bàn trước rồi mới tạo dự án 3D.");
                        return;
                      }
                      await placeToAnimationProject(placement, state.entities);
                      setNote(`Đã tạo dự án 3D "Địa điểm: ${selectedEntity.name}" — mở Animation Studio để dựng cảnh tiếp.`);
                    }}
                    className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Tạo dự án 3D từ địa điểm này
                  </button>
                  <button
                    onClick={async () => {
                      const id = await entityToCharacterAsset(selectedEntity);
                      setNote(
                        id
                          ? `Đã đưa "${selectedEntity.name}" sang thư viện Animation Studio (nhân vật 2D).`
                          : "Nhân vật chưa có ảnh thiết kế — vẽ mặt trước hoặc biểu cảm trong hồ sơ rồi thử lại.",
                      );
                    }}
                    className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Đưa nhân vật sang Animation Studio
                  </button>
                  <button
                    onClick={async () => {
                      const url = canvasApiRef.current?.capture();
                      if (!url) return;
                      await viewToBackgroundAsset(selectedEntity.name, url);
                      setNote(`Đã lưu góc nhìn hiện tại làm ảnh nền 2D "${selectedEntity.name}" trong thư viện Animation Studio.`);
                    }}
                    className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Chụp góc nhìn làm nền 2D
                  </button>
                </div>
                <div>
                  <p className="text-[11px] text-white/40 mb-1">
                    Bài viết lore — gõ @Tên thực thể trong bài để liên kết tới họ
                  </p>
                  {(selectedEntity.articles ?? []).map((art) => (
                    <div key={art.id} className="rounded-xl border border-white/10 bg-black/30 p-2.5 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-[12.5px] font-medium">{art.title}</span>
                        <button
                          onClick={() => updateEntity(selectedEntity.id, removeArticle(selectedEntity, art.id))}
                          aria-label="Xoá bài viết"
                          className="text-white/35 hover:text-rose-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="text-[12px] text-white/70 leading-relaxed mt-1 whitespace-pre-wrap">
                        {parseMentions(art.body, state.entities).map((seg, si) =>
                          seg.type === "mention" && seg.entityId ? (
                            <button
                              key={si}
                              onClick={() => {
                                const ent = state.entities.find((e) => e.id === seg.entityId);
                                if (ent) placeEntity(ent);
                              }}
                              className="text-violet-300 hover:underline"
                            >
                              {seg.value}
                            </button>
                          ) : (
                            <span key={si}>{seg.value}</span>
                          ),
                        )}
                      </p>
                    </div>
                  ))}
                  <input
                    value={newArticleTitle}
                    onChange={(e) => setNewArticleTitle(e.target.value)}
                    placeholder="Tiêu đề bài viết…"
                    className="w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none mb-1.5"
                  />
                  <textarea
                    value={newArticleBody}
                    onChange={(e) => setNewArticleBody(e.target.value)}
                    placeholder="Nội dung… (VD: @Kira sinh ra ở ngôi đền này.)"
                    rows={3}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-[12px] outline-none mb-1.5"
                  />
                  <button
                    onClick={() => {
                      if (!newArticleTitle.trim() && !newArticleBody.trim()) return;
                      updateEntity(selectedEntity.id, addArticle(selectedEntity, newArticleTitle, newArticleBody));
                      setNewArticleTitle("");
                      setNewArticleBody("");
                    }}
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
                  >
                    Thêm bài viết
                  </button>
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
      {editingModel && (
        <div className="fixed inset-0 z-[70] bg-black/70 grid place-items-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-[#150e24] border border-white/10 p-4 space-y-3 my-auto">
            <div className="flex items-center gap-2">
              <input
                value={editingModel.name}
                onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                placeholder="Tên vật"
                className="flex-1 min-w-0 h-9 rounded-lg bg-black/40 border border-white/10 px-2.5 text-[13px] outline-none"
              />
              <button
                onClick={() => setEditingModel(null)}
                aria-label="Đóng"
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Mỗi chi tiết là một khối (hộp/nón/trụ/cầu) với kích thước,
              vị trí và màu riêng. Kích thước: hộp [rộng, cao, sâu], nón
              [bán kính, cao, số mặt], trụ [bán kính, cao], cầu [bán kính].
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {editingModel.parts.map((part, idx) => (
                <div key={idx} className="rounded-xl border border-white/10 bg-black/30 p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={part.shape}
                      onChange={(e) =>
                        setEditingModel(updatePartInModel(editingModel, idx, { shape: e.target.value as ModelPart["shape"] }))
                      }
                      className="h-8 rounded-lg bg-black/40 border border-white/10 px-1.5 text-[12px] outline-none"
                    >
                      <option value="box">Hộp</option>
                      <option value="cone">Nón</option>
                      <option value="cylinder">Trụ</option>
                      <option value="sphere">Cầu</option>
                    </select>
                    <input
                      type="color"
                      value={part.color}
                      onChange={(e) =>
                        setEditingModel(updatePartInModel(editingModel, idx, { color: e.target.value }))
                      }
                      aria-label="Màu chi tiết"
                      className="w-8 h-8 rounded bg-transparent cursor-pointer"
                    />
                    <button
                      onClick={() => setEditingModel(removePartFromModel(editingModel, idx))}
                      aria-label="Xoá chi tiết"
                      className="ml-auto text-white/35 hover:text-rose-300"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {part.size.map((v, si) => (
                      <label key={si} className="block text-[10px] text-white/40">
                        Kích thước {si + 1}
                        <input
                          type="number" step={0.1}
                          value={v}
                          onChange={(e) => {
                            const size = [...part.size] as [number, number, number];
                            size[si] = Number(e.target.value) || 0;
                            setEditingModel(updatePartInModel(editingModel, idx, { size }));
                          }}
                          className="mt-0.5 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {part.offset.map((v, oi) => (
                      <label key={oi} className="block text-[10px] text-white/40">
                        Vị trí {["X", "Y", "Z"][oi]}
                        <input
                          type="number" step={0.1}
                          value={v}
                          onChange={(e) => {
                            const offset = [...part.offset] as [number, number, number];
                            offset[oi] = Number(e.target.value) || 0;
                            setEditingModel(updatePartInModel(editingModel, idx, { offset }));
                          }}
                          className="mt-0.5 w-full h-8 rounded-lg bg-black/40 border border-white/10 px-2 text-[12px] outline-none"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() =>
                  setEditingModel(
                    addPartToModel(editingModel, { shape: "box", size: [1, 1, 1], offset: [0, 0.5, 0], color: "#b08968" }),
                  )
                }
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] text-white/70"
              >
                + Thêm chi tiết
              </button>
              <button
                onClick={() => {
                  setState((prev) => {
                    if (!prev) return prev;
                    const models = prev.customModels ?? [];
                    const exists = models.some((m) => m.id === editingModel.id);
                    return {
                      ...prev,
                      customModels: exists
                        ? models.map((m) => (m.id === editingModel.id ? editingModel : m))
                        : [...models, editingModel],
                    };
                  });
                  setEditingModel(null);
                }}
                className="h-9 px-3 rounded-lg bg-violet-500/25 border border-violet-400/40 text-violet-100 text-[12px]"
              >
                Lưu vật
              </button>
              <button
                onClick={() => {
                  setState((prev) => {
                    if (!prev) return prev;
                    const models = prev.customModels ?? [];
                    const exists = models.some((m) => m.id === editingModel.id);
                    return {
                      ...prev,
                      customModels: exists
                        ? models.map((m) => (m.id === editingModel.id ? editingModel : m))
                        : [...models, editingModel],
                    };
                  });
                  setPlacingCustom(editingModel);
                  setPlacingModel(null);
                  setPlacingGlb(null);
                  setEditingModel(null);
                }}
                className="flex-1 h-9 rounded-lg bg-violet-500/40 border border-violet-400/50 text-white text-[12px] font-medium"
              >
                Lưu + đặt lên sa bàn
              </button>
            </div>
          </div>
        </div>
      )}
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
