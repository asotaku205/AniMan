"use client";

/**
 * Thư viện tài sản (Đợt C): kho dùng chung cho mọi dự án phim.
 * - Dự án 3D: nhân vật (có sẵn + tự lưu) chèn vào cảnh; mẫu phong cảnh
 *   (có sẵn + lưu từ cảnh hiện tại) áp vào cảnh, giữ nguyên nhân vật.
 * - Dự án 2D: kho hình nền/nhân vật/đạo cụ — tải lên một lần, chèn thành
 *   layer vào bất kỳ cảnh nào.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ImagePlus, Landmark, Paintbrush, Pencil, Plus, Trash2, User, Users, X } from "lucide-react";
import type { AnimProject, AnimScene } from "../lib/animProject";
import {
  BUILTIN_CHARACTERS,
  BUILTIN_SCENERY,
  IMAGE_CATEGORY_LABEL,
  applyScenery,
  characterObjectFromAsset,
  newAssetId,
  type AnimAsset,
  type Character2DAsset,
  type Character3DAsset,
  type ImageAsset,
  type Model3DAsset,
  type ImageAssetCategory,
  type SceneryAsset,
} from "../lib/animAssets";
import { RigStudioModal } from "./RigStudioModal";
import {
  deleteAnimAsset,
  listAnimAssets,
  saveAnimAsset,
} from "../lib/animStorage";
import { createPrevizObject, createPrevizScene } from "../lib/previz";
import { BUILTIN_IMAGE_PACK } from "../lib/builtinAssets";
import { createSceneLayer, createSceneTimeline } from "../lib/timeline";
import {
  inspectGlbBuffer,
  inspectGlbDataUrl,
  inspectionSummary,
} from "../lib/modelInspect";
import {
  addExpression,
  createCharacter2D,
  expressionProgress,
  removeExpression,
  setExpressionImage,
} from "../lib/characterSheet";
import DrawStudioModal from "./DrawStudioModal";

const ASSET_KIND_LABEL: Record<string, string> = {
  character3d: "Nhân vật 3D",
  scenery: "Phong cảnh",
  image: "Hình 2D",
  model3d: "Mô hình 3D",
  character2d: "Nhân vật 2D tự tạo",
};

/** Mục thư viện thu gọn/mở rộng được — cột trái hẹp nên mọi mục đều có
 * nút gập, người dùng chỉ mở mục đang cần. */
function LibSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-white/10 bg-black/30">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-[12px] font-semibold text-white/70 flex items-center gap-1.5 min-w-0">
          {title}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-none text-white/40 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </section>
  );
}

export function AssetLibrary({
  project,
  scene,
  onUpdateScene,
}: {
  project: AnimProject;
  scene: AnimScene;
  onUpdateScene: (patch: Partial<AnimScene>) => void;
}) {
  const [assets, setAssets] = useState<AnimAsset[]>([]);
  const [note, setNote] = useState("");
  const [charName, setCharName] = useState("");
  const [charColor, setCharColor] = useState("#e8b4a0");
  const [charSize, setCharSize] = useState(1.7);
  const [sceneryName, setSceneryName] = useState("");
  const [imageCategory, setImageCategory] =
    useState<ImageAssetCategory>("background");
  // Quản lý tài sản của tôi (Đ4): tìm kiếm + lọc loại + đổi tên
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKindFilter, setAssetKindFilter] = useState<string>("all");
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [rigAsset, setRigAsset] = useState<Model3DAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [packUrls, setPackUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (project.kind !== "2d") return;
    const urls: Record<string, string> = {};
    for (const item of BUILTIN_IMAGE_PACK) urls[item.id] = item.paint();
    setPackUrls(urls);
  }, [project.kind]);

  const refresh = useCallback(async () => {
    setAssets(await listAnimAssets().catch(() => []));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const characters = assets.filter(
    (a): a is Character3DAsset => a.kind === "character3d",
  );
  const sceneries = assets.filter(
    (a): a is SceneryAsset => a.kind === "scenery",
  );
  const images = assets.filter((a): a is ImageAsset => a.kind === "image");
  const characters2d = assets.filter(
    (a): a is Character2DAsset => a.kind === "character2d",
  );
  const [newCharName, setNewCharName] = useState("");
  const [exprDrafts, setExprDrafts] = useState<Record<string, string>>({});
  const [drawTarget, setDrawTarget] = useState<
    | { type: "free" }
    | { type: "expression"; charId: string; label: string }
    | null
  >(null);
  const models = assets.filter(
    (a): a is Model3DAsset => a.kind === "model3d",
  );

  const uploadModel = async (file: File) => {
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "glb" && extension !== "vrm") {
      setNote("Chỉ nhận model .glb hoặc .vrm. Hãy xuất VRM 1.0 cho nhân vật anime có rig sẵn.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setNote("Mô hình nặng hơn 20MB — hãy dùng bản rút gọn (low-poly) để phim chạy mượt.");
      return;
    }
    try {
      const inspection = inspectGlbBuffer(await file.arrayBuffer());
      if (extension === "vrm" && inspection.format !== "vrm") {
        throw new Error("File .vrm không có metadata VRM hợp lệ.");
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không đọc được file model."));
        reader.readAsDataURL(file);
      });
      await saveAnimAsset({
        kind: "model3d",
        id: newAssetId("model"),
        name: file.name.replace(/\.(glb|vrm)$/i, ""),
        format: inspection.format,
        dataUrl,
        createdAt: Date.now(),
        inspection,
      });
      await refresh();
      setNote(`Đã nạp mô hình "${file.name}" — ${inspectionSummary(inspection)}.`);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Không nạp được model. Hãy kiểm tra lại file .glb/.vrm.");
    }
  };

  const reinspectModel = async (asset: Model3DAsset) => {
    const inspection = inspectGlbDataUrl(asset.dataUrl) ?? undefined;
    if (inspection) {
      await saveAnimAsset({ ...asset, inspection });
      await refresh();
      setNote(`Đã kiểm tra "${asset.name}" — ${inspectionSummary(inspection)}.`);
    } else {
      setNote(`Không đọc được cấu trúc của mô hình "${asset.name}".`);
    }
  };

  const addModelToScene = (asset: Model3DAsset) => {
    const obj = createPrevizObject("model", asset.name);
    obj.modelAssetId = asset.id;
    obj.size = 1.7;
    onUpdateScene({
      previz: { ...previz, objects: [...previz.objects, obj] },
    });
    setNote(`Đã thêm mô hình "${asset.name}" vào cảnh "${scene.name}" — kéo vị trí/đặt key như vật thể thường.`);
  };

  const previz = scene.previz ?? createPrevizScene();

  const addCharacter = (c: { name: string; color: string; size: number }) => {
    const asset: Character3DAsset = {
      kind: "character3d",
      id: "tmp",
      name: c.name,
      color: c.color,
      size: c.size,
      createdAt: 0,
    };
    const chars = previz.objects.filter((o) => o.kind === "character").length;
    onUpdateScene({
      previz: {
        ...previz,
        objects: [
          ...previz.objects,
          characterObjectFromAsset(asset, chars * 1.3 - 0.6, 0.3),
        ],
      },
    });
    setNote(`Đã thêm nhân vật "${c.name}" vào cảnh "${scene.name}".`);
  };

  const saveCharacter = async () => {
    const name = charName.trim();
    if (!name) return;
    await saveAnimAsset({
      kind: "character3d",
      id: newAssetId("char"),
      name,
      color: charColor,
      size: charSize,
      createdAt: Date.now(),
    });
    setCharName("");
    await refresh();
    setNote(`Đã lưu nhân vật "${name}" vào thư viện — dùng được cho mọi dự án.`);
  };

  const applySceneryToScene = (s: { backdrop: string; objects: SceneryAsset["objects"]; name: string }) => {
    const next = applyScenery(previz.objects, s);
    onUpdateScene({ previz: { ...previz, ...next } });
    setNote(
      `Đã áp phong cảnh "${s.name}" vào cảnh "${scene.name}" (nhân vật trong cảnh được giữ nguyên).`,
    );
  };

  const saveCurrentScenery = async () => {
    const name = sceneryName.trim();
    if (!name) return;
    const objects = previz.objects.filter((o) => o.kind !== "character");
    await saveAnimAsset({
      kind: "scenery",
      id: newAssetId("scenery"),
      name,
      backdrop: previz.backdrop,
      objects: JSON.parse(JSON.stringify(objects)) as SceneryAsset["objects"],
      createdAt: Date.now(),
    });
    setSceneryName("");
    await refresh();
    setNote(`Đã lưu phong cảnh "${name}" từ cảnh hiện tại.`);
  };

  const uploadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      await saveAnimAsset({
        kind: "image",
        id: newAssetId("img"),
        name: file.name.replace(/\.[^.]+$/, ""),
        category: imageCategory,
        dataUrl: String(reader.result),
        createdAt: Date.now(),
      });
      await refresh();
      setNote(`Đã thêm hình "${file.name}" vào thư viện.`);
    };
    reader.readAsDataURL(file);
  };

  const addImageDataToScene = (name: string, dataUrl: string) => {
    const timeline = scene.timeline ?? createSceneTimeline();
    const layer = createSceneLayer(name, "#2b2440");
    layer.imageDataUrl = dataUrl;
    onUpdateScene({
      timeline: { ...timeline, layers: [...timeline.layers, layer] },
    });
    setNote(`Đã thêm "${name}" thành một lớp trong cảnh "${scene.name}".`);
  };

  const addImageToScene = (asset: ImageAsset) =>
    addImageDataToScene(asset.name, asset.dataUrl);

  const saveCharacter2D = async (char: Character2DAsset) => {
    await saveAnimAsset(char);
    await refresh();
  };

  const createCharacter = async () => {
    const char = createCharacter2D(newCharName);
    await saveCharacter2D(char);
    setNewCharName("");
    setNote(
      `Đã tạo nhân vật "${char.name}" với ${char.expressions.length} biểu cảm chờ vẽ.`,
    );
  };

  const handleDrawSave = async (dataUrl: string) => {
    if (!drawTarget) return;
    if (drawTarget.type === "free") {
      await saveAnimAsset({
        kind: "image",
        id: newAssetId("image"),
        name: `Hình tự vẽ ${images.length + 1}`,
        category: imageCategory,
        dataUrl,
        createdAt: Date.now(),
      });
      await refresh();
      setNote("Đã lưu hình tự vẽ vào thư viện.");
    } else {
      const char = characters2d.find((c) => c.id === drawTarget.charId);
      if (char) {
        await saveCharacter2D(
          setExpressionImage(char, drawTarget.label, dataUrl),
        );
        setNote(
          `Đã lưu biểu cảm "${drawTarget.label}" cho nhân vật "${char.name}".`,
        );
      }
    }
    setDrawTarget(null);
  };

  const removeAsset = async (asset: AnimAsset) => {
    await deleteAnimAsset(asset.id);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-[13px] font-semibold tracking-wide text-white/80 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-pink-300" />
        THƯ VIỆN TÀI SẢN
      </h2>

      {assets.length > 0 && (
        <LibSection title={`QUẢN LÝ TÀI SẢN CỦA TÔI (${assets.length})`} defaultOpen={false}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.currentTarget.value)}
              placeholder="Tìm tài sản theo tên…"
              className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-[12px] w-full placeholder:text-white/25"
            />
            {["all", "character3d", "scenery", "image", "model3d"].map((k) => (
              <button
                key={k}
                onClick={() => setAssetKindFilter(k)}
                className={`px-2.5 h-8 rounded-lg border text-[11px] transition ${
                  assetKindFilter === k
                    ? "bg-pink-500/25 border-pink-400/50"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                }`}
              >
                {k === "all" ? "Tất cả" : ASSET_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-white/5">
            {assets
              .filter(
                (a) =>
                  (assetKindFilter === "all" || a.kind === assetKindFilter) &&
                  a.name.toLowerCase().includes(assetQuery.trim().toLowerCase()),
              )
              .map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/45 text-[10px] shrink-0">
                    {ASSET_KIND_LABEL[a.kind]}
                  </span>
                  {a.id.startsWith("wb-") && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-300/25 text-purple-200 text-[10px] shrink-0">
                      Từ World Builder
                    </span>
                  )}
                  {editingAssetId === a.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.currentTarget.value)}
                        autoFocus
                        className="h-8 px-2 rounded-lg bg-white/5 border border-pink-400/40 text-[12px] flex-1 min-w-[120px]"
                      />
                      <button
                        onClick={() => {
                          if (editName.trim()) {
                            void saveAnimAsset({ ...a, name: editName.trim() }).then(() => refresh());
                          }
                          setEditingAssetId(null);
                        }}
                        className="text-emerald-300 text-[11px] font-medium"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => setEditingAssetId(null)}
                        className="text-white/40 text-[11px]"
                      >
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-white/75">{a.name}</span>
                      <button
                        onClick={() => {
                          setEditingAssetId(a.id);
                          setEditName(a.name);
                        }}
                        className="text-white/40 hover:text-white text-[11px]"
                      >
                        Đổi tên
                      </button>
                      <button
                        onClick={() => void removeAsset(a)}
                        className="text-white/40 hover:text-rose-400 text-[11px]"
                      >
                        Xoá
                      </button>
                    </>
                  )}
                </li>
              ))}
          </ul>
          <p className="text-[11px] text-white/30">
            Tài sản ở đây dùng chung cho mọi dự án phim. Nhân vật và phong
            cảnh gửi từ World Builder có nhãn riêng — đổi tên ở đây không
            ảnh hưởng bản gốc trong World Builder.
          </p>
        </LibSection>
      )}

      {project.kind === "3d" && (
        <>
          <LibSection title={<><User className="w-3.5 h-3.5" /> NHÂN VẬT</>}>
            <div className="flex flex-wrap gap-2">
              {BUILTIN_CHARACTERS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => addCharacter(c)}
                  className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-white/25"
                    style={{ background: c.color }}
                  />
                  {c.name}
                  <Plus className="w-3 h-3 text-white/40" />
                </button>
              ))}
              {characters.map((c) => (
                <span
                  key={c.id}
                  className="flex items-center gap-1 rounded-lg bg-pink-500/10 border border-pink-300/25 pl-3 pr-1 h-9"
                >
                  <button
                    onClick={() => addCharacter(c)}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/25"
                      style={{ background: c.color }}
                    />
                    {c.name}
                    <Plus className="w-3 h-3 text-white/40" />
                  </button>
                  <button
                    onClick={() => void removeAsset(c)}
                    aria-label={`Xoá nhân vật ${c.name}`}
                    className="p-1.5 text-white/35 hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <input
                value={charName}
                onChange={(e) => setCharName(e.currentTarget.value)}
                placeholder="Tên nhân vật mới…"
                className="h-9 rounded-lg bg-black/40 border border-white/10 px-3 outline-none w-44"
              />
              <input
                type="color"
                value={charColor}
                onChange={(e) => setCharColor(e.currentTarget.value)}
                aria-label="Màu nhân vật"
                className="w-9 h-9 bg-transparent cursor-pointer"
              />
              <label className="flex items-center gap-1 text-white/45">
                Cao
                <input
                  type="number"
                  min={0.8}
                  max={2.4}
                  step={0.02}
                  value={charSize}
                  onChange={(e) => setCharSize(Number(e.currentTarget.value))}
                  className="w-16 h-9 rounded-lg bg-black/40 border border-white/10 px-2 text-white"
                />
                m
              </label>
              <button
                onClick={() => void saveCharacter()}
                disabled={!charName.trim()}
                className="px-3 h-9 rounded-lg bg-pink-500/25 border border-pink-300/35 text-[12px] hover:bg-pink-500/35 disabled:opacity-40"
              >
                Lưu nhân vật vào thư viện
              </button>
            </div>
          </LibSection>

          <LibSection title={<>PHONG CẢNH</>} defaultOpen={false}>
          <p className="text-[11px] text-white/35">
            Áp vào cảnh đang chọn — giữ nguyên nhân vật trong cảnh.
          </p>
            <div className="flex flex-wrap gap-2">
              {BUILTIN_SCENERY.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    applySceneryToScene({
                      name: s.name,
                      backdrop: s.backdrop,
                      objects: s.build(),
                    })
                  }
                  className="flex items-center gap-2 px-3 h-9 rounded-lg bg-white/5 border border-white/10 text-[12px] hover:bg-white/10"
                >
                  <span
                    className="w-3.5 h-3.5 rounded border border-white/25"
                    style={{ background: s.backdrop }}
                  />
                  {s.name}
                </button>
              ))}
              {sceneries.map((s) => (
                <span
                  key={s.id}
                  className="flex items-center gap-1 rounded-lg bg-sky-500/10 border border-sky-300/25 pl-3 pr-1 h-9"
                >
                  <button
                    onClick={() => applySceneryToScene(s)}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded border border-white/25"
                      style={{ background: s.backdrop }}
                    />
                    {s.name}
                  </button>
                  <button
                    onClick={() => void removeAsset(s)}
                    aria-label={`Xoá phong cảnh ${s.name}`}
                    className="p-1.5 text-white/35 hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <input
                value={sceneryName}
                onChange={(e) => setSceneryName(e.currentTarget.value)}
                placeholder="Tên phong cảnh từ cảnh hiện tại…"
                className="h-9 rounded-lg bg-black/40 border border-white/10 px-3 outline-none w-full min-w-0"
              />
              <button
                onClick={() => void saveCurrentScenery()}
                disabled={!sceneryName.trim()}
                className="px-3 h-9 rounded-lg bg-sky-500/25 border border-sky-300/35 text-[12px] hover:bg-sky-500/35 disabled:opacity-40"
              >
                Lưu cảnh hiện tại thành phong cảnh
              </button>
            </div>
          </LibSection>
          <LibSection title={<>MODEL 3D (GLB / VRM)</>} defaultOpen={false}>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <label className="px-3 py-2 leading-snug rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Nạp model .glb hoặc .vrm
                <input
                  type="file"
                  accept=".glb,.vrm,model/gltf-binary,model/vrm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) uploadModel(file);
                  }}
                />
              </label>
              <span className="text-white/35">
                Nhân vật anime: dùng model .vrm đã rig. Model 3D khác: dùng .glb.
                File được kiểm tra cấu trúc trước khi lưu.
              </span>
            </div>
            {models.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <span
                    key={m.id}
                    className="flex items-center gap-1 rounded-lg bg-violet-500/10 border border-violet-300/25 pl-3 pr-1 h-9"
                  >
                    <button
                      onClick={() => addModelToScene(m)}
                      className="flex items-center gap-2 text-[12px]"
                    >
                      {m.name}
                      <Plus className="w-3 h-3 text-white/40" />
                    </button>
                    <button
                      onClick={() => void removeAsset(m)}
                      aria-label={`Xoá mô hình ${m.name}`}
                      className="p-1.5 text-white/35 hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {models.length > 0 && (
              <ul className="space-y-1.5">
                {models.map((m) => (
                  <li
                    key={m.id}
                    className="text-[11px] leading-relaxed rounded-lg bg-black/30 border border-white/5 px-2.5 py-2"
                  >
                    <span className="text-white/70 font-medium">{m.name}: </span>
                    {m.inspection ? (
                      <>
                        <span className="text-white/50">
                          {inspectionSummary(m.inspection)}
                        </span>
                        {m.inspection.animations.length > 0 && (
                          <span className="block text-white/40">
                            Thời lượng clip:{" "}
                            {m.inspection.animations
                              .map((a) => `${a.name} ${a.durationSec.toFixed(1)}s`)
                              .join(" · ")}
                          </span>
                        )}
                        {m.inspection.warnings.map((w) => (
                          <span key={w} className="block text-amber-300/85">
                            Lưu ý: {w}
                          </span>
                        ))}
                      </>
                    ) : (
                      <button
                        onClick={() => void reinspectModel(m)}
                        className="text-sky-300 underline underline-offset-2"
                      >
                        Kiểm tra model (xương · clip · tam giác)
                      </button>
                    )}
                    {m.inspection && !m.inspection.hasSkeleton && (
                      <button
                        onClick={() => setRigAsset(m)}
                        className="mt-1 block text-violet-300 underline underline-offset-2"
                      >
                        Thử gắn xương nhanh (model tĩnh)
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </LibSection>
        </>
      )}

      {rigAsset && (
        <RigStudioModal
          asset={rigAsset}
          onClose={() => setRigAsset(null)}
          onSaved={() => void refresh()}
        />
      )}

      {project.kind === "2d" && (
        <>
        <LibSection title={<><Users className="w-3.5 h-3.5" /> NHÂN VẬT TỰ TẠO — BỘ BIỂU CẢM</>}>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <input
              value={newCharName}
              onChange={(e) => setNewCharName(e.currentTarget.value)}
              placeholder="Tên nhân vật mới…"
              className="h-9 flex-1 min-w-28 rounded-lg bg-black/40 border border-white/10 px-2.5 outline-none"
            />
            <button
              onClick={() => void createCharacter()}
              className="px-3 py-2 leading-snug rounded-lg bg-pink-500/25 border border-pink-300/35 hover:bg-pink-500/35"
            >
              Tạo nhân vật
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-white/40">
            Tự vẽ nhân vật một lần với nhiều biểu cảm (nền trong suốt), rồi
            thêm vào từng cảnh với biểu cảm phù hợp — đổi nét mặt giữa các
            cảnh là cách làm phim kể chuyện kinh điển.
          </p>
          {characters2d.map((char) => {
            const prog = expressionProgress(char);
            return (
              <div
                key={char.id}
                className="rounded-xl border border-white/8 bg-black/25 p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="font-medium text-white/85">{char.name}</span>
                  <span className="text-white/40">
                    đã vẽ {prog.drawn}/{prog.total} biểu cảm
                  </span>
                  <button
                    onClick={() => void removeAsset(char)}
                    title="Xoá nhân vật khỏi thư viện"
                    className="ml-auto text-white/35 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {char.expressions.map((expr) => (
                    <div key={expr.label} className="w-[76px] space-y-1">
                      <div className="aspect-square rounded-lg overflow-hidden border border-white/10 [background:repeating-conic-gradient(#2a2a2e_0%_25%,#1c1c1f_0%_50%)_0_0/12px_12px] flex items-center justify-center">
                        {expr.dataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={expr.dataUrl}
                            alt={`${char.name} — ${expr.label}`}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[10px] text-white/35 px-1 text-center">
                            Chưa vẽ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/60 truncate">
                        {expr.label}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setDrawTarget({
                              type: "expression",
                              charId: char.id,
                              label: expr.label,
                            })
                          }
                          title={expr.dataUrl ? "Vẽ lại biểu cảm này" : "Vẽ biểu cảm này"}
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-pink-300 hover:text-pink-100"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {expr.dataUrl && (
                          <button
                            onClick={() =>
                              addImageDataToScene(
                                `${char.name} – ${expr.label}`,
                                expr.dataUrl!,
                              )
                            }
                            title="Thêm vào cảnh đang chọn với biểu cảm này"
                            className="p-1.5 rounded bg-white/5 border border-white/10 text-emerald-300 hover:text-emerald-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            void saveCharacter2D(removeExpression(char, expr.label))
                          }
                          title="Xoá biểu cảm này"
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-white/40 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[12px]">
                  <input
                    value={exprDrafts[char.id] ?? ""}
                    onChange={(e) =>
                      setExprDrafts((d) => ({
                        ...d,
                        [char.id]: e.currentTarget.value,
                      }))
                    }
                    placeholder="Biểu cảm mới (VD: Cười lớn, Suy tư…)"
                    className="h-8 flex-1 min-w-24 rounded-lg bg-black/40 border border-white/10 px-2 outline-none text-[11px]"
                  />
                  <button
                    onClick={() => {
                      void saveCharacter2D(
                        addExpression(char, exprDrafts[char.id] ?? ""),
                      );
                      setExprDrafts((d) => ({ ...d, [char.id]: "" }));
                    }}
                    className="px-2.5 py-1.5 leading-snug rounded-lg bg-white/5 border border-white/10 text-white/70"
                  >
                    Thêm biểu cảm
                  </button>
                </div>
              </div>
            );
          })}
        </LibSection>
        <LibSection title={<><ImagePlus className="w-3.5 h-3.5" /> HÌNH DÙNG CHUNG</>}>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <select
              value={imageCategory}
              onChange={(e) =>
                setImageCategory(e.currentTarget.value as ImageAssetCategory)
              }
              aria-label="Nhóm hình"
              className="h-9 rounded-lg bg-black/40 border border-white/10 px-2 outline-none"
            >
              {(
                Object.keys(IMAGE_CATEGORY_LABEL) as ImageAssetCategory[]
              ).map((c) => (
                <option key={c} value={c}>
                  {IMAGE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDrawTarget({ type: "free" })}
              className="flex items-center gap-1.5 px-3 py-2 leading-snug rounded-lg bg-sky-500/25 border border-sky-300/35 hover:bg-sky-500/35"
            >
              <Paintbrush className="w-3.5 h-3.5" /> Vẽ hình mới
            </button>
            <label className="px-3 py-2 leading-snug rounded-lg bg-pink-500/25 border border-pink-300/35 hover:bg-pink-500/35 cursor-pointer">
              Tải hình lên thư viện
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file) uploadImage(file);
                }}
              />
            </label>
            <span className="text-white/35">
              Tải một lần — chèn vào mọi cảnh, không phải tải lại.
            </span>
          </div>
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-white/50">
              GÓI HÌNH CÓ SẴN — NHÂN VẬT CÓ BIỂU CẢM & NỀN CHI TIẾT
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {BUILTIN_IMAGE_PACK.map((item) => (
                <div
                  key={item.id}
                  className="relative rounded-lg overflow-hidden border border-white/10"
                >
                  {packUrls[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={packUrls[item.id]}
                      alt={item.name}
                      className="w-full aspect-video object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-white/5" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 flex items-center gap-1">
                    <span className="flex-1 text-[10px] truncate">{item.name}</span>
                    <button
                      onClick={() =>
                        addImageToScene({
                          kind: "image",
                          id: item.id,
                          name: item.name,
                          category: item.category,
                          dataUrl: packUrls[item.id],
                          createdAt: 0,
                        })
                      }
                      title="Thêm thẳng vào cảnh đang chọn"
                      className="text-pink-300 hover:text-pink-100 text-[10px] font-medium"
                    >
                      + Cảnh
                    </button>
                    <button
                      onClick={() => {
                        void saveAnimAsset({
                          kind: "image",
                          id: newAssetId("img"),
                          name: item.name,
                          category: item.category,
                          dataUrl: packUrls[item.id],
                          createdAt: Date.now(),
                        }).then(() => refresh());
                      }}
                      title="Lưu vào thư viện của tôi"
                      className="text-white/50 hover:text-white text-[10px]"
                    >
                      + Thư viện
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {images.length === 0 ? (
            <p className="text-[12px] text-white/35">
              Thư viện chưa có hình nào. Vẽ nền/nhân vật ở Manga Studio rồi
              xuất hình, hoặc tải hình có sẵn lên đây.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-lg overflow-hidden border border-white/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 flex items-center gap-1">
                    <span className="flex-1 text-[10px] truncate">
                      {img.name} · {IMAGE_CATEGORY_LABEL[img.category]}
                    </span>
                    <button
                      onClick={() => addImageToScene(img)}
                      title="Thêm vào cảnh đang chọn"
                      className="text-pink-300 hover:text-pink-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void removeAsset(img)}
                      title="Xoá khỏi thư viện"
                      className="text-white/40 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LibSection>
        </>
      )}

      {drawTarget && (
        <DrawStudioModal
          title={
            drawTarget.type === "free"
              ? "Vẽ hình mới cho thư viện"
              : `Vẽ biểu cảm "${drawTarget.label}" — ${
                  characters2d.find((c) => c.id === drawTarget.charId)?.name ??
                  "nhân vật"
                }`
          }
          initialDataUrl={
            drawTarget.type === "expression"
              ? (characters2d
                  .find((c) => c.id === drawTarget.charId)
                  ?.expressions.find((e) => e.label === drawTarget.label)
                  ?.dataUrl ?? null)
              : null
          }
          canvasWidth={drawTarget.type === "free" ? 960 : 720}
          canvasHeight={drawTarget.type === "free" ? 540 : 720}
          onClose={() => setDrawTarget(null)}
          onSave={(dataUrl) => void handleDrawSave(dataUrl)}
        />
      )}

      {note && <p className="text-[12px] text-emerald-300/85">{note}</p>}
    </div>
  );
}
