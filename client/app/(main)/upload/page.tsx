"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, FileText, Globe, ImageIcon, Lock, Palette, Upload, X, BookOpen, Film } from "lucide-react";
const UploadPage = () => {
  const router = useRouter();
    const WORK_TYPES = [
  { k: "manga", label: "Manga", icon: <BookOpen className="w-4 h-4" />, desc: "Truyện tranh " },
  { k: "novel", label: "Tiểu thuyết", icon: <FileText className="w-4 h-4" />, desc: "Tiểu Thuyết" },
  { k: "animation", label: "Hoạt hình", icon: <Film className="w-4 h-4" />, desc: "Phim hoạt hình" },
  { k: "fanart", label: "Fan Art", icon: <Palette className="w-4 h-4" />, desc: "Ảnh, tranh" },
] as const;

  const [type, setType] = useState<typeof WORK_TYPES[number]["k"]>("manga");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private" | "unlisted">("public");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); };
  }, [router]);

  const onFile = (f?: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCoverPreview(url);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim() || "Tác phẩm không tên";
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sakura:published", { detail: { title: t } }));
    }
    router.push("/ho-so");
  };
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-12">
      <form onSubmit={submit} className="w-full bg-[#130d20] border border-white/10 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-white/8">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-pink-300/70">ĐĂNG TÁC PHẨM</div>
            <div className="text-lg text-white mt-0.5 font-jp-serif">Chia sẻ sáng tác của bạn</div>
          </div>
          <button type="button" onClick={() => router.back()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/70">
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
          {/* Type picker */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Loại tác phẩm</label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WORK_TYPES.map((w) => (
                <button type="button" key={w.k} onClick={() => setType(w.k)}
                  className={`text-left p-3 rounded-xl border transition ${type === w.k ? "bg-pink-500/10 border-pink-400/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                  <div className="flex items-center gap-1.5 text-white">{w.icon}<span className="text-sm">{w.label}</span></div>
                  <div className="text-[11px] text-white/45 mt-1 leading-snug">{w.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cover */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Ảnh bìa</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`mt-1.5 w-full h-56 rounded-xl border-2 border-dashed transition overflow-hidden grid place-items-center ${coverPreview ? "border-pink-400/40" : "border-white/15 hover:border-pink-400/40 bg-white/[0.02]"}`}>
              {coverPreview ? (
                <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-white/50">
                  <ImageIcon className="w-7 h-7 mx-auto mb-2 text-pink-300/70" />
                  <div className="text-sm">Chọn ảnh bìa</div>
                  <div className="text-[11px] text-white/30 mt-0.5">PNG · JPG · tỉ lệ 3:4 cho manga / novel</div>
                </div>
              )}
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Tiêu đề</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Lời nhắn từ mùa hạ"
              className="mt-1.5 w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Mô tả</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={6}
              placeholder="Tóm tắt nội dung, thể loại, cảm hứng…"
              className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-pink-400/50 resize-none" />
          </div>

          {/* Visibility */}
          <div>
            <label className="text-[11px] tracking-widest uppercase text-white/40">Hiển thị</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {([
                { k: "public", icon: <Globe className="w-4 h-4" />, t: "Công khai" },
                { k: "unlisted", icon: <FileText className="w-4 h-4" />, t: "Có link" },
                { k: "private", icon: <Lock className="w-4 h-4" />, t: "Riêng tư" },
              ] as const).map((v) => (
                <button type="button" key={v.k} onClick={() => setVisibility(v.k)}
                  className={`p-3 rounded-xl border transition flex flex-col items-start gap-1 ${visibility === v.k ? "bg-pink-500/10 border-pink-400/50" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                  <span className="text-white flex items-center gap-1.5 text-sm">{v.icon}{v.t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Where will it show */}
          <div className="rounded-xl border border-[#d4a648]/30 bg-gradient-to-br from-[#d72638]/[0.08] to-[#d4a648]/[0.06] p-4">
            <div className="text-[11px] tracking-[0.25em] uppercase text-[#f0c75e]/80 mb-2">Sau khi đăng, tác phẩm sẽ xuất hiện ở</div>
            <Link href="/tac-pham" className="flex items-start gap-3 p-3 rounded-lg bg-[#d72638]/10 border border-[#d72638]/30 hover:border-[#d72638]/60 transition group mb-2">
              <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d72638] to-[#b81e2e] grid place-items-center text-white shrink-0 ring-1 ring-[#f0c75e]/40">
                <Palette className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-white text-sm flex items-center gap-1.5">
                  Sáng tác cộng đồng
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0c75e]/20 text-[#f0c75e] tracking-wider">CHÍNH</span>
                </div>
                <div className="text-white/55 text-[11px] mt-0.5">Nơi mọi người xem, thả tim, lưu & góp ý chi tiết cho tác phẩm của bạn</div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-[#f0c75e] transition self-center" />
            </Link>
            <ul className="space-y-1.5 text-sm text-white/70 pt-1">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#f0c75e]" /> Tab <b className="text-white/90">"Tác phẩm của tôi"</b> trên hồ sơ <Link href="/ho-so" className="text-pink-300 hover:underline">/ho-so</Link></li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#f0c75e]" /> Bảng tin Cộng đồng <Link href="/forum" className="text-pink-300 hover:underline">/forum</Link> (nếu Công khai)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-[#f0c75e]" /> Studio Hub <Link href="/studio" className="text-pink-300 hover:underline">/studio</Link> — "Dự án của bạn"</li>
            </ul>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 px-6 py-4 border-t border-white/10">
          <Link href="/studio" className="text-xs text-white/50 hover:text-pink-300 transition">
            Hoặc tạo trực tiếp trong Studio
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.back()} className="px-4 h-10 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/80 transition">Hủy</button>
            <button type="submit" className="inline-flex items-center gap-1.5 px-5 h-10 rounded-full btn-son text-sm">
              <Upload className="w-4 h-4" /> Đăng tác phẩm
            </button>
          </div>
        </div>
      </form>
    </main>
    
  );
}

export default UploadPage