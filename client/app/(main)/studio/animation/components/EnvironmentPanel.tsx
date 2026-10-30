/**
 * Panel Phong cảnh trong sidebar previz 3D (giai đoạn B): bầu trời,
 * thời tiết, sương, mặt nước, cọ địa hình, rải vật, set mẫu, nhập sa
 * bàn World Builder. Toàn text product, không thuật ngữ dev.
 */

"use client";

import { useEffect, useState } from "react";
import type { PrevizScene } from "../lib/previz";
import { createPrevizObject } from "../lib/previz";
import {
  PRESET_SET_META,
  WEATHER_OPTIONS,
  buildPreset,
  weatherConsequence,
  type PresetSetId,
  type SceneEnvironment,
} from "../lib/sceneEnvironment";
import {
  createTerrainGrid,
  heightAtGrid,
  type TerrainBrushMode,
} from "../lib/terrainBrush";
import { scatterPlacements } from "../lib/scatter";
import { listAnimAssets } from "../lib/animStorage";
import type { Model3DAsset } from "../lib/animAssets";
import {
  loadDiorama,
  normalizeState,
} from "../../world-builder/lib/dioramaStorage";
import {
  dioramaToEnvironment,
  dioramaToObjects,
} from "../lib/dioramaToScene";

export interface TerrainBrushTool {
  mode: "off" | TerrainBrushMode;
  radius: number;
  strength: number;
}

const BRUSH_MODES: Array<{ id: TerrainBrushTool["mode"]; label: string }> = [
  { id: "off", label: "Tắt cọ" },
  { id: "raise", label: "Nâng đất" },
  { id: "lower", label: "Hạ đất" },
  { id: "flatten", label: "San phẳng" },
  { id: "smooth", label: "Làm mịn" },
];

function formatHour(t: number): string {
  const h = Math.floor(t) % 24;
  const m = Math.round((t - Math.floor(t)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function EnvironmentPanel({
  previz,
  onPrevizChange,
  environment,
  onEnvironmentChange,
  brushTool,
  onBrushToolChange,
}: {
  previz: PrevizScene;
  onPrevizChange: (previz: PrevizScene) => void;
  environment: SceneEnvironment;
  onEnvironmentChange: (environment: SceneEnvironment) => void;
  brushTool: TerrainBrushTool;
  onBrushToolChange: (tool: TerrainBrushTool) => void;
}) {
  const [models, setModels] = useState<Model3DAsset[]>([]);
  const [scatterModelId, setScatterModelId] = useState("");
  const [scatterCount, setScatterCount] = useState(12);
  const [scatterHalf, setScatterHalf] = useState(10);
  const [scatterSeed, setScatterSeed] = useState(7);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void listAnimAssets()
      .then((assets) => {
        const ms = assets.filter(
          (a): a is Model3DAsset => a.kind === "model3d",
        );
        setModels(ms);
        if (ms.length > 0) setScatterModelId((prev) => prev || ms[0].id);
      })
      .catch(() => undefined);
  }, []);

  const setEnv = (patch: Partial<SceneEnvironment>) =>
    onEnvironmentChange({ ...environment, ...patch });

  const applyPreset = (id: PresetSetId) => {
    const preset = buildPreset(id);
    onEnvironmentChange(preset.environment);
    onPrevizChange({ ...previz, objects: [...previz.objects, ...preset.objects] });
    setNote(
      `Đã thêm set "${preset.name}" vào cảnh (giờ, trời, đất và ${preset.objects.length} vật) — sửa thoải mái, vật cũ vẫn giữ nguyên.`,
    );
  };

  const doScatter = () => {
    const asset = models.find((m) => m.id === scatterModelId);
    if (!asset) {
      setNote("Chưa chọn mẫu 3D để rải — nạp mẫu ở Thư viện tài sản trước.");
      return;
    }
    const placements = scatterPlacements({
      count: Math.max(1, Math.min(100, scatterCount)),
      half: scatterHalf,
      seed: scatterSeed,
    });
    const objects = placements.map((p, i) => {
      const obj = createPrevizObject("model", `${asset.name} ${i + 1}`);
      obj.modelAssetId = asset.id;
      obj.size = p.scale;
      obj.keys[0] = {
        ...obj.keys[0],
        position: {
          x: p.x,
          y: heightAtGrid(environment.terrain, p.x, p.z),
          z: p.z,
        },
        rotationY: p.rotationY,
      };
      return obj;
    });
    onPrevizChange({ ...previz, objects: [...previz.objects, ...objects] });
    setNote(
      `Đã rải ${objects.length} "${asset.name}" — mỗi vật vẫn riêng lẻ, bấm vào để kéo/sửa/xoá từng cái.`,
    );
  };

  const importDiorama = async () => {
    setNote("Đang đọc sa bàn…");
    try {
      const raw = await loadDiorama();
      if (!raw) {
        setNote("Chưa có sa bàn nào được lưu trong World Builder.");
        return;
      }
      const state = normalizeState(raw);
      const env = dioramaToEnvironment(state);
      const objects = dioramaToObjects(state, env);
      onEnvironmentChange(env);
      onPrevizChange({ ...previz, objects: [...previz.objects, ...objects] });
      setNote(
        `Đã nhập sa bàn: địa hình + bầu trời + ${objects.length} vật (vật ngoài sân 30m và vật đã ẩn thì bỏ). Sửa tiếp thoải mái.`,
      );
    } catch {
      setNote("Không đọc được sa bàn — thử mở World Builder lưu lại rồi nhập lại.");
    }
  };

  void previz;

  return (
    <section className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
      <h3 className="text-[12px] font-semibold text-white/70">
        PHONG CẢNH — BẦU TRỜI & MẶT ĐẤT
      </h3>
      {note && <p className="text-[11px] text-emerald-300 leading-relaxed">{note}</p>}

      <label className="flex items-center gap-2 text-[11px] text-white/45">
        <span className="w-20">Giờ trong ngày</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.5}
          value={environment.time}
          onChange={(e) => setEnv({ time: Number(e.currentTarget.value) })}
          className="flex-1 accent-amber-400"
        />
        <span className="w-11 text-right tabular-nums text-white/70">
          {formatHour(environment.time)}
        </span>
      </label>

      <label className="flex items-center gap-2 text-[11px] text-white/45">
        <span className="w-20">Thời tiết</span>
        <select
          value={environment.weather}
          onChange={(e) =>
            setEnv({ weather: e.currentTarget.value as SceneEnvironment["weather"] })
          }
          className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-[12px] text-white outline-none"
        >
          {WEATHER_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-white/40 leading-relaxed">
        {weatherConsequence(environment.weather)} — trời đổi thì nắng, mây,
        sương và tầm nhìn đổi theo. Muốn thêm hạt mưa/tuyết rơi thì bật ở
        mục Thời tiết &amp; Không khí bên dưới.
      </p>

      <label className="flex items-center gap-2 text-[11px] text-white/45">
        <span className="w-20">Sương mù</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={environment.fogDensity}
          onChange={(e) => setEnv({ fogDensity: Number(e.currentTarget.value) })}
          className="flex-1 accent-sky-400"
        />
        <span className="w-9 text-right tabular-nums text-white/70">
          {Math.round(environment.fogDensity * 100)}%
        </span>
      </label>

      <div className="flex items-center gap-2 text-[11px] text-white/45">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={environment.waterLevel >= 0}
            onChange={(e) =>
              setEnv({ waterLevel: e.currentTarget.checked ? 0.1 : -1 })
            }
          />
          Mặt nước
        </label>
        {environment.waterLevel >= 0 && (
          <>
            <input
              type="range"
              min={-0.5}
              max={1.5}
              step={0.1}
              value={environment.waterLevel}
              onChange={(e) => setEnv({ waterLevel: Number(e.currentTarget.value) })}
              className="flex-1 accent-sky-400"
            />
            <span className="w-11 text-right tabular-nums text-white/70">
              {environment.waterLevel.toFixed(1)}m
            </span>
          </>
        )}
      </div>

      <div className="pt-1 border-t border-white/5 space-y-2">
        <div className="text-[11px] text-white/50 pt-1">Cọ địa hình</div>
        <div className="flex flex-wrap gap-1.5">
          {BRUSH_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onBrushToolChange({ ...brushTool, mode: m.id })}
              className={`px-2 h-7 rounded-lg border text-[11px] ${
                brushTool.mode === m.id
                  ? "bg-amber-500/25 border-amber-400/50 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {brushTool.mode !== "off" && (
          <>
            <label className="flex items-center gap-2 text-[11px] text-white/45">
              <span className="w-20">Bán kính cọ</span>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={brushTool.radius}
                onChange={(e) =>
                  onBrushToolChange({ ...brushTool, radius: Number(e.currentTarget.value) })
                }
                className="flex-1 accent-amber-400"
              />
              <span className="w-9 text-right tabular-nums text-white/70">
                {brushTool.radius}m
              </span>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-white/45">
              <span className="w-20">Độ mạnh</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={brushTool.strength}
                onChange={(e) =>
                  onBrushToolChange({ ...brushTool, strength: Number(e.currentTarget.value) })
                }
                className="flex-1 accent-amber-400"
              />
              <span className="w-9 text-right tabular-nums text-white/70">
                {Math.round(brushTool.strength * 100)}%
              </span>
            </label>
          </>
        )}
        
        <button
          onClick={() => setEnv({ terrain: createTerrainGrid() })}
          className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
        >
          Làm phẳng lại mặt đất
        </button>
      </div>

      <div className="pt-1 border-t border-white/5 space-y-2">
        <div className="text-[11px] text-white/50 pt-1">Rải vật</div>
        {models.length === 0 ? (
          <p className="text-[11px] text-white/40 leading-relaxed">
            Chưa có mẫu 3D nào — nạp mẫu ở Thư viện tài sản rồi quay lại rải.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-[11px] text-white/45">
              <span className="w-20">Mẫu vật</span>
              <select
                value={scatterModelId}
                onChange={(e) => setScatterModelId(e.currentTarget.value)}
                className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 px-2 text-[12px] text-white outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <label className="flex-1 text-[11px] text-white/45">
                Số lượng
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={scatterCount}
                  onChange={(e) => setScatterCount(Number(e.currentTarget.value) || 1)}
                  className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                />
              </label>
              <label className="flex-1 text-[11px] text-white/45">
                Vùng rải (nửa cạnh)
                <input
                  type="number"
                  min={2}
                  max={14}
                  step={1}
                  value={scatterHalf}
                  onChange={(e) => setScatterHalf(Number(e.currentTarget.value) || 10)}
                  className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                />
              </label>
              <label className="flex-1 text-[11px] text-white/45">
                Seed
                <input
                  type="number"
                  value={scatterSeed}
                  onChange={(e) => setScatterSeed(Number(e.currentTarget.value) || 0)}
                  className="mt-0.5 w-full h-8 rounded-lg bg-black/50 border border-white/10 px-2 text-[12px] text-white outline-none"
                />
              </label>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setScatterSeed(Math.floor(Math.random() * 10000))}
                className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] hover:bg-white/10"
              >
                Đổi seed
              </button>
              <button
                onClick={doScatter}
                className="flex-1 h-8 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-[12px] font-medium hover:bg-emerald-500/35"
              >
                Rải vật
              </button>
            </div>
            <p className="text-[10.5px] text-white/30 leading-relaxed">
              Cùng seed cho cùng cách rải — rải lại được đúng cảnh cũ, đổi
              seed lấy cách rải khác.
            </p>
          </>
        )}
      </div>

      <div className="pt-1 border-t border-white/5 space-y-2">
        <div className="text-[11px] text-white/50 pt-1">Set mẫu</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_SET_META.map((p) => (
            <button
              key={p.id}
              title={p.desc}
              onClick={() => applyPreset(p.id)}
              className="px-2.5 h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
            >
              {p.name}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => void importDiorama()}
          className="w-full h-8 rounded-lg bg-violet-500/25 border border-violet-400/40 text-[12px] font-medium hover:bg-violet-500/35"
        >
          Nhập sa bàn từ World Builder
        </button>
        
      </div>
    </section>
  );
}
