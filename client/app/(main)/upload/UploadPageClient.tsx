"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import UploadCoverField from "./components/UploadCoverField";
import UploadPublishInfo from "./components/UploadPublishInfo";
import UploadTypePicker from "./components/UploadTypePicker";
import UploadVisibilityPicker from "./components/UploadVisibilityPicker";
import { type VisibilityMode, type WorkType } from "./types";

export default function UploadPageClient() {
  const router = useRouter();
  const [type, setType] = useState<WorkType>("manga");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<VisibilityMode>("public");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const onFile = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeTitle = title.trim() || "Tác phẩm không tên";

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sakura:published", { detail: { title: safeTitle } }));
    }

    router.push("/profile");
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full bg-[#130d20] border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-pink-300/70">ĐĂNG TÁC PHẨM</div>
            <div className="text-lg text-white mt-0.5 font-jp-serif">Chia sẻ sáng tác của bạn</div>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/70"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
          <UploadTypePicker type={type} setType={setType} />

          <UploadCoverField coverPreview={coverPreview} onFile={onFile} inputRef={fileRef} />

          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Tiêu đề</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Lời nhắn từ mùa hạ"
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Mô tả</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={6}
              placeholder="Tóm tắt nội dung, thể loại, cảm hứng…"
              className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50 resize-none"
            />
          </div>

          <UploadVisibilityPicker visibility={visibility} setVisibility={setVisibility} />

          <UploadPublishInfo />
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-t border-white/10">
          <Link href="/studio" className="text-xs text-white/50 hover:text-pink-300 transition">
            Hoặc tạo trực tiếp trong Studio
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 h-10 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/80 transition"
            >
              Hủy
            </button>
            <button type="submit" className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full btn-son text-sm">
              <Upload className="w-4 h-4" /> Đăng tác phẩm
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
