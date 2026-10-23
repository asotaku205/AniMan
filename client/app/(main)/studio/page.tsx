import Link from "next/link";
import { PageHeader } from "../../components/PageHeader";
import { Wand2, Layers, Feather, Globe } from "lucide-react";

const studios = [
  { to: "/studio/manga-ai", icon: <Wand2 />, t: "AI Manga Converter", d: "Phác thảo tay → trang manga đạt chuẩn, screentone & bố cục tự động.", color: "from-pink-500 to-fuchsia-500" },
  { to: "/studio/animation", icon: <Layers />, t: "Animation Studio", d: "Editor đa lớp + AI Auto-Sub & Dub đa ngôn ngữ.", color: "from-violet-500 to-pink-500" },
  { to: "/studio/novel", icon: <Feather />, t: "Novel Studio", d: "Quyển sổ da cũ trên giấy washi, font viết tay & tiếng ngòi bút.", color: "from-amber-500 to-rose-400" },
];

// Mini hex grid decoration for WorldBuilder card
function MiniHexPreview() {
  const sample: string[][] = [
    ["#0ea5e9","#0ea5e9","#15803d","#a8a29e","#0ea5e9"],
    ["#0ea5e9","#86efac","#86efac","#a8a29e","#e0f2fe"],
    ["#86efac","#86efac","#fb923c","#15803d","#0ea5e9"],
    ["#0ea5e9","#86efac","#86efac","#0ea5e9","#0ea5e9"],
    ["#0ea5e9","#0ea5e9","#0ea5e9","#fde68a","#0ea5e9"],
  ];
  const r = 13;
  return (
    <svg width={110} height={96} viewBox="0 0 110 96" className="opacity-70">
      {sample.map((row, ri) => row.map((fill, ci) => {
        const cx = ci * r * 1.5 + r;
        const cy = ri * r * Math.sqrt(3) + (ci % 2 === 1 ? r * Math.sqrt(3) / 2 : 0) + r * Math.sqrt(3) / 2;
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i;
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(" ");
        return <polygon key={`${ci}-${ri}`} points={pts} fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />;
      }))}
    </svg>
  );
}

export default function StudioHubPage() {
  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title="Studio sáng tạo"
        desc="Bộ công cụ sản xuất nội dung tích hợp AI cho người sáng tác manga, hoạt hình và tiểu thuyết."
      />
      <section className="py-20 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6 space-y-6">
          {/* 3 studio cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {studios.map((s) => (
              <Link key={s.to} href={s.to} className="group relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8 overflow-hidden hover:border-pink-400/40 transition">
                <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-2xl`} />
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} grid place-items-center text-white mb-5`}>{s.icon}</div>
                <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl">{s.t}</h3>
                <p className="text-white/60 mt-3">{s.d}</p>
                <div className="mt-6 text-pink-300">Mở studio →</div>
              </Link>
            ))}
          </div>

          {/* World Builder — featured full-width card */}
          <Link href="/studio/world-builder"
            className="group relative flex items-center justify-between rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-[#0b0612] p-8 overflow-hidden hover:border-emerald-400/40 transition-all hover:shadow-[0_0_40px_rgba(16,185,129,0.1)]">
            {/* Glow */}
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-emerald-500 opacity-10 blur-3xl" />
            <div className="absolute -bottom-8 right-40 w-32 h-32 rounded-full bg-teal-400 opacity-8 blur-2xl" />

            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 grid place-items-center text-white">
                  <Globe size={20} />
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium tracking-widest">MỚI</span>
              </div>
              <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl mb-2">World Builder 3D</h3>
              <p className="text-white/55 max-w-xl">
                Xây dựng thế giới cho manga & phim: <span className="text-white/80">mô tả bằng văn bản → AI tạo bản đồ địa hình</span>. Thêm nhân vật có tiểu sử, điều chỉnh góc camera, xuất cảnh sang Manga Studio hoặc Animation Studio.
              </p>
              <div className="mt-5 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-400">Bản đồ hex 3D →</span>
                <span className="text-white/30">Nhân vật & lore →</span>
                <span className="text-white/30">Xuất cảnh 2D / Animation</span>
              </div>
            </div>

            {/* Mini hex preview */}
            <div className="relative z-10 flex-shrink-0 ml-8 opacity-80 group-hover:opacity-100 transition-opacity">
              <MiniHexPreview />
            </div>
          </Link>
        </div>
      </section>
    </>
  );
}
