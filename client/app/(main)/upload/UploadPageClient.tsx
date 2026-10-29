"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Upload, X } from "lucide-react";
import UploadCoverField from "./components/UploadCoverField";
import UploadPublishInfo from "./components/UploadPublishInfo";
import UploadTypePicker from "./components/UploadTypePicker";
import UploadVisibilityPicker from "./components/UploadVisibilityPicker";
import { type VisibilityMode, type WorkType } from "./types";
import {
  COVER_MAX_BYTES,
  formatBytes,
  workFileAccept,
  type UploadSourceRef,
} from "./lib/uploadStorage";
import {
  WORK_FILE_MAX_BYTES,
  checkWorkUploadLimits,
  submitWork,
  WorksApiError,
  type WorkType as ApiWorkType,
} from "@/lib/works-api";
import { useAuth } from "@/app/auth/AuthProvider";
import { listNovels } from "../studio/novel/lib/novelStorage";
import { getAllProjectsFromDB } from "../studio/manga-ai/lib/mangaStorage";
import { listAnimProjects } from "../studio/animation/lib/animStorage";
import { recordNotification } from "../notification/lib/notifications";

interface StudioOption {
  value: string;
  label: string;
  title: string;
  desc: string;
  ref: UploadSourceRef;
}

const inputCls =
  "mt-1.5 w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50";
const labelCls =
  "text-[11px] tracking-widest uppercase text-white/40";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function UploadPageClient() {
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const [type, setType] = useState<WorkType>("manga");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [genre, setGenre] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<VisibilityMode>("public");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [workFile, setWorkFile] = useState<{
    name: string;
    size: number;
    file: File;
  } | null>(null);
  const [studioOptions, setStudioOptions] = useState<StudioOption[]>([]);
  const [studioValue, setStudioValue] = useState("");
  const [titleError, setTitleError] = useState("");
  const [fileError, setFileError] = useState("");
  const [coverError, setCoverError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const workFileRef = useRef<HTMLInputElement>(null);

  // Dự án studio có sẵn để gắn vào form (tự điền tiêu đề + mô tả).
  useEffect(() => {
    (async () => {
      try {
        const [novels, mangas, anims] = await Promise.all([
          listNovels(),
          getAllProjectsFromDB(),
          listAnimProjects(),
        ]);
        const opts: StudioOption[] = [
          ...novels.map((n) => ({
            value: `novel:${n.id}`,
            label: `Tiểu thuyết — ${n.title}`,
            title: n.title,
            desc: [n.premise, n.summary].filter(Boolean).join("\n\n"),
            ref: { kind: "novel" as const, id: n.id, label: n.title },
          })),
          ...mangas.map((m) => ({
            value: `manga:${m.id}`,
            label: `Manga — ${m.title}`,
            title: m.title,
            desc: m.description,
            ref: { kind: "manga" as const, id: m.id, label: m.title },
          })),
          ...anims.map((a) => ({
            value: `anim:${a.id}`,
            label: `Hoạt hình — ${a.name}`,
            title: a.name,
            desc: a.sourceNote ?? "",
            ref: { kind: "anim" as const, id: a.id, label: a.name },
          })),
        ];
        setStudioOptions(opts);
      } catch {
        setStudioOptions([]);
      }
    })();
  }, []);

  const onCoverFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > COVER_MAX_BYTES) {
      setCoverError(
        `Ảnh bìa quá lớn (${formatBytes(file.size)}). Tối đa ${formatBytes(COVER_MAX_BYTES)}.`,
      );
      return;
    }
    setCoverError("");
    setCoverFile(file);
    setCoverPreview(await readAsDataUrl(file));
  };

  const onWorkFile = async (file?: File | null) => {
    if (!file) return;
    const limitError = checkWorkUploadLimits(
      type as ApiWorkType,
      file,
      coverFile,
    );
    if (limitError) {
      setFileError(limitError);
      setWorkFile(null);
      return;
    }
    setFileError("");
    setWorkFile({
      name: file.name,
      size: file.size,
      file,
    });
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t || tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Nhập tiêu đề trước khi đăng.");
      return;
    }
    setTitleError("");
    if (!workFile) {
      setFileError("Chưa chọn file tác phẩm.");
      return;
    }
    const limitError = checkWorkUploadLimits(
      type as ApiWorkType,
      workFile.file,
      coverFile,
    );
    if (limitError) {
      setFileError(limitError);
      return;
    }
    setSubmitError("");
    setSaving(true);
    setUploadProgress(null);
    try {
      const source =
        studioOptions.find((o) => o.value === studioValue)?.ref ?? null;
      const formData = new FormData();
      formData.set("type", type);
      formData.set("title", title.trim());
      formData.set("description", desc.trim());
      formData.set("genre", genre.trim());
      formData.set("tags", JSON.stringify(tags));
      formData.set("visibility", visibility);
      if (source) {
        formData.set("sourceRef", JSON.stringify(source));
      }
      formData.set("file", workFile.file);
      if (coverFile) {
        formData.set("cover", coverFile);
      }
      await submitWork({ getAccessToken }, formData, (loaded, total) => {
        setUploadProgress({ loaded, total });
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sakura:published", {
            detail: { title: title.trim() },
          }),
        );
      }
      await recordNotification(
        "upload",
        `Đã gửi duyệt “${title.trim()}”`,
        "Tác phẩm đang chờ quản trị viên duyệt.",
        "/my-works",
      );
      router.push("/my-works");
    } catch (error) {
      setSubmitError(
        error instanceof WorksApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Không gửi được tác phẩm. Hãy thử lại.",
      );
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <main className="bg-[#0b0612] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
        <Link
          href="/my-works"
          className="text-sm text-pink-300/80 hover:text-pink-300"
        >
          ← Sáng tác của tôi
        </Link>
        <div className="mt-4 mb-6">
          <div className="text-[10px] tracking-[0.3em] text-pink-300/70">
            ĐĂNG TÁC PHẨM
          </div>
          <h1
            style={{ fontFamily: "Shippori Mincho, serif" }}
            className="text-white text-3xl mt-1"
          >
            Chia sẻ sáng tác của bạn
          </h1>
          <p className="text-white/55 text-sm mt-2">
            Tác phẩm gửi lên sẽ được quản trị viên duyệt trước khi hiện
            công khai. Bạn theo dõi trạng thái duyệt trong trang Sáng tác
            của tôi.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="w-full bg-[#130d20] border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
        >
          <div className="flex-1 px-6 py-6 space-y-6">
            <UploadTypePicker type={type} setType={setType} />

            {studioOptions.length > 0 && (
              <div>
                <label className={labelCls}>
                  Từ dự án studio có sẵn (tuỳ chọn)
                </label>
                <select
                  className={`${inputCls} [&>option]:text-black`}
                  value={studioValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStudioValue(v);
                    const opt = studioOptions.find((o) => o.value === v);
                    if (opt) {
                      setTitle(opt.title);
                      setDesc(opt.desc);
                    }
                  }}
                >
                  <option value="">Tự nhập tay…</option>
                  {studioOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-white/40 mt-1">
                  Chọn dự án sẽ tự điền tiêu đề + mô tả, Sơn sửa lại được.
                </p>
              </div>
            )}

            <div>
              <UploadCoverField
                coverPreview={coverPreview}
                onFile={onCoverFile}
                inputRef={fileRef}
              />
              {coverError && (
                <p className="text-xs text-red-300 mt-1">{coverError}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Tiêu đề *</label>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError("");
                }}
                placeholder="Ví dụ: Lời nhắn từ mùa hạ"
                className={inputCls}
              />
              {titleError && (
                <p className="text-xs text-red-300 mt-1">{titleError}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Mô tả</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={6}
                placeholder="Tóm tắt nội dung, thể loại, cảm hứng…"
                className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50 resize-none"
              />
            </div>

            <div>
              <label className={labelCls}>Thể loại</label>
              <input
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Ví dụ: Lãng mạn, Hành động…"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Tags</label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-500/20 text-pink-200 text-xs"
                  >
                    #{t}
                    <button
                      type="button"
                      aria-label={`Xoá tag ${t}`}
                      onClick={() =>
                        setTags((prev) => prev.filter((x) => x !== t))
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  onBlur={addTag}
                  placeholder="Gõ tag rồi Enter…"
                  className="flex-1 min-w-32 bg-transparent outline-none text-white placeholder:text-white/30 text-sm h-8"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>File tác phẩm</label>
              <input
                ref={workFileRef}
                type="file"
                accept={workFileAccept(type)}
                className="hidden"
                onChange={(e) => void onWorkFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => workFileRef.current?.click()}
                className="mt-1.5 w-full h-16 rounded-xl border-2 border-dashed border-white/15 hover:border-pink-400/40 transition grid place-items-center text-white/60 text-sm"
              >
                <span className="flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-pink-300/70" />
                  {workFile
                    ? `${workFile.name} (${formatBytes(workFile.size)})`
                    : "Chọn file tác phẩm"}
                </span>
              </button>
              <p className="text-xs text-white/40 mt-1">
                {type === "novel"
                  ? "PDF, Word hoặc text cho tiểu thuyết."
                  : type === "animation"
                    ? "Video cho hoạt hình."
                    : type === "manga"
                      ? "Ảnh hoặc file CBZ cho manga."
                      : "Ảnh cho fanart."}{" "}
                Tối đa {formatBytes(WORK_FILE_MAX_BYTES[type as ApiWorkType])}. File gửi lên
                máy chủ để duyệt, không lưu trên máy này.
              </p>
              {fileError && (
                <p className="text-xs text-red-300 mt-1">{fileError}</p>
              )}
              {saving && uploadProgress && uploadProgress.total > 0 && (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-pink-400 transition-all"
                      style={{
                        width: `${Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-white/50 mt-1">
                    Đang tải lên {formatBytes(uploadProgress.loaded)} /{" "}
                    {formatBytes(uploadProgress.total)} (
                    {Math.min(
                      100,
                      Math.round(
                        (uploadProgress.loaded / uploadProgress.total) * 100,
                      ),
                    )}
                    %)
                  </p>
                </div>
              )}
            </div>

            <UploadVisibilityPicker
              visibility={visibility}
              setVisibility={setVisibility}
            />

            <UploadPublishInfo />

            {submitError && (
              <p role="alert" className="text-sm text-red-300">
                {submitError}
              </p>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-t border-white/10">
            <Link
              href="/studio"
              className="text-xs text-white/50 hover:text-pink-300 transition"
            >
              Hoặc tạo trực tiếp trong Studio
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/my-works"
                className="px-4 h-10 leading-10 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/80 transition"
              >
                Hủy
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full btn-son text-sm disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {saving ? "Đang tải lên…" : "Gửi duyệt"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
