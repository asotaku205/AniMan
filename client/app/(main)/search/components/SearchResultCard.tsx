import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import Link from "next/link";
import { ContentType, TYPE_COLORS, TYPE_LABELS, UnifiedItem } from "../data";
import { Star } from "lucide-react";

export function SearchResultCard({ item, index }: { item: UnifiedItem; index: number }) {
  const delayClass = `delay-${Math.min((index % 6) * 100, 500)}`;
  return (
    <Link
      href={item.path}
      className={`group block relative rounded-2xl overflow-hidden bg-white/[0.025] border border-white/8 hover:border-pink-400/30 transition-all hover:shadow-[0_8px_30px_rgba(255,90,150,0.15)] animate-fadeInUp ${delayClass}`}
    >
      {/* Image */}
      <div className="relative aspect-[2/3]">
        <ImageWithFallback src={item.img} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition" />

        {/* Type badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] border ${TYPE_COLORS[item.type] ?? "bg-white/10 text-white/60 border-white/20"}`}>
          {TYPE_LABELS[item.type as ContentType]}
        </div>

        {/* Score */}
        <div className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur">
          <Star className="w-3 h-3 fill-yellow-300 text-yellow-300" />
          <span className="text-yellow-200 text-xs">{item.score}</span>
        </div>

        {/* Hover CTA */}
        <div className="absolute inset-x-3 bottom-12 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-200">
          <div className="flex items-center justify-center h-8 rounded-full bg-white/90 text-black text-xs gap-1.5">
            {item.type === "manga" ? "Đọc ngay" : item.type === "tieu-thuyet" ? "Đọc thử" : "Xem ngay"}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-white text-sm truncate group-hover:text-pink-300 transition" style={{ fontFamily: item.type === "tieu-thuyet" ? "Shippori Mincho, serif" : undefined }}>
          {item.title}
        </div>
        {item.author && <div className="text-white/40 text-xs mt-0.5 truncate">{item.author}</div>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-white/40 text-[10px]">{item.meta}</span>
          {item.tags[0] && <span className="text-white/30 text-[10px] truncate">· {item.tags[0]}</span>}
        </div>
      </div>
    </Link>
  );
}