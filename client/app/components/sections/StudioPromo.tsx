import Link from "next/link";
import { ChevronRight, Wand2 } from "lucide-react";

const STUDIO_TOOLS = [
  { href: "/studio/manga-ai",  title: "AI Manga",      desc: "Hỗ trợ phác thảo, vẽ truyện tranh với công cụ AI" },
  { href: "/studio/animation", title: "Animation Lab", desc: "Tạo phim hoạt hình với AI hỗ trợ"                 },
  { href: "/studio/novel",     title: "Novel Studio",  desc: "Viết tiểu thuyết trên giao diện giấy"             },
];

export function StudioPromo() {
  return (
    <section className="py-14 bg-[#08050f] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_70%)]" />
      <div className="relative max-w-[1400px] mx-auto px-6">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 text-fuchsia-300/70 tracking-[0.4em] text-xs uppercase mb-3">
            <Wand2 className="w-3.5 h-3.5" /> Studio sáng tác
          </div>
          <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">
            Biến ý tưởng thành <span className="text-shimmer">tác phẩm</span>
          </h2>
          <p className="mt-3 text-white/50 max-w-lg mx-auto">
            Bộ công cụ sáng tác AI — Hoạt hình, truyện tranh đến tiểu thuyết
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {STUDIO_TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-white/8 bg-white/[0.025] p-6 hover:border-fuchsia-400/30 hover:bg-white/[0.04] hover:shadow-[0_8px_30px_rgba(217,70,239,0.1)] transition-all"
            >
              <div className="text-white group-hover:text-fuchsia-200 transition">{t.title}</div>
              <div className="text-white/50 text-sm mt-2 leading-relaxed">{t.desc}</div>
              <div className="mt-4 flex items-center gap-1 text-fuchsia-300/70 text-xs group-hover:text-fuchsia-300 transition">
                Thử ngay <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
