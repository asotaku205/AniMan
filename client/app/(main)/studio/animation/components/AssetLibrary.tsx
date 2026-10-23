"use client";

/**
 * Thư viện tài sản (Đợt C): kho dùng chung cho mọi dự án phim.
 * - Dự án 3D: nhân vật (có sẵn + tự lưu) chèn vào cảnh; mẫu phong cảnh
 *   (có sẵn + lưu từ cảnh hiện tại) áp vào cảnh, giữ nguyên nhân vật.
 * - Dự án 2D: kho hình nền/nhân vật/đạo cụ — tải lên một lần, chèn thành
 *   layer vào bất kỳ cảnh nào.
 */

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Landmark, Plus, Trash2, User, X } from "lucide-react";
import type { AnimProject, AnimScene } from "../lib/animProject";
import {
  BUILTIN_CHARACTERS,
  BUILTIN_SCENERY,
  IMAGE_CATEGORY_LABEL,
  applyScenery,
  characterObjectFromAsset,
  newAssetId,
  type AnimAsset,
  type Character3DAsset,
  type ImageAsset,
  type Model3DAsset,
  type ImageAssetCategory,
  type SceneryAsset,
} from "../lib/animAssets";
import {
  deleteAnimAsset,
  listAnimAssets,
  saveAnimAsset,
} from "../lib/animStorage";
import { createPrevizObject, createPrevizScene } from "../lib/previz";
import { BUILTIN_IMAGE_PACK } from "../lib/builtinAssets";
import { createSceneLayer, createSceneTimeline } from "../lib/timeline";

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
  const models = assets.filter(
    (a): a is Model3DAsset => a.kind === "model3d",
  );

  const uploadModel = (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setNote("Mô hình nặng hơn 20MB — hãy dùng bản rút gọn (low-poly) để phim chạy mượt.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await saveAnimAsset({
        kind: "model3d",
        id: newAssetId("model"),
        name: file.name.replace(/\.glb$/i, ""),
        dataUrl: String(reader.result),
        createdAt: Date.now(),
      });
      await refresh();
      setNote(`Đã nạp mô hình "${file.name}" vào thư viện.`);
    };
    reader.readAsDataURL(file);
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

  const addImageToScene = (asset: ImageAsset) => {
    const timeline = scene.timeline ?? createSceneTimeline();
    const layer = createSceneLayer(asset.name, "#2b2440");
    layer.imageDataUrl = asset.dataUrl;
    onUpdateScene({
      timeline: { ...timeline, layers: [...timeline.layers, layer] },
    });
    setNote(`Đã thêm hình "${asset.name}" thành một lớp trong cảnh "${scene.name}".`);
  };

  const removeAsset = async (asset: AnimAsset) => {
    await deleteAnimAsset(asset.id);
    await refresh();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d0817] p-4 space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-white/80 flex items-center gap-2">
        <Landmark className="w-4 h-4 text-pink-300" />
        THƯ VIỆN TÀI SẢN — PHONG CẢNH & NHÂN VẬT
      </h2>

      {project.kind === "3d" && (
        <>
          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold text-white/60 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> NHÂN VẬT
            </h3>
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
          </section>

          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold text-white/60">
              PHONG CẢNH (áp vào cảnh đang chọn — giữ nguyên nhân vật)
            </h3>
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
                className="h-9 rounded-lg bg-black/40 border border-white/10 px-3 outline-none w-60"
              />
              <button
                onClick={() => void saveCurrentScenery()}
                disabled={!sceneryName.trim()}
                className="px-3 h-9 rounded-lg bg-sky-500/25 border border-sky-300/35 text-[12px] hover:bg-sky-500/35 disabled:opacity-40"
              >
                Lưu cảnh hiện tại thành phong cảnh
              </button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold text-white/60">
              MÔ HÌNH 3D CÓ SẴN (FILE .GLB)
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <label className="px-3 h-9 leading-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Nạp mô hình .glb vào thư viện
                <input
                  type="file"
                  accept=".glb,model/gltf-binary"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) uploadModel(file);
                  }}
                />
              </label>
              <span className="text-white/35">
                Mô hình đẹp có sẵn miễn phí ở các kho như Kenney, Quaternius
                (giấy phép CC0) — tải file .glb về rồi nạp vào đây.
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
          </section>
        </>
      )}

      {project.kind === "2d" && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-semibold text-white/60 flex items-center gap-1.5">
            <ImagePlus className="w-3.5 h-3.5" /> HÌNH DÙNG CHUNG (NỀN · NHÂN VẬT · ĐẠO CỤ)
          </h3>
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
            <label className="px-3 h-9 leading-9 rounded-lg bg-pink-500/25 border border-pink-300/35 hover:bg-pink-500/35 cursor-pointer">
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
        </section>
      )}

      {note && <p className="text-[12px] text-emerald-300/85">{note}</p>}
    </div>
  );
}
