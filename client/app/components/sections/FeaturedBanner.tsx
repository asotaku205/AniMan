import Link from "next/link";
import { Bookmark, Play } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";

export type FeaturedBannerProps = {
  title: string;
  desc: string;
  img: string;
  tags: string[];
  href: string;
  eyebrow: string;
  badge?: string;
};

export function FeaturedBanner({ title, desc, img, tags, href, eyebrow, badge }: FeaturedBannerProps) {
  return (
    <div className="relative rounded-3xl overflow-hidden h-[380px] md:h-[460px] group">
      <ImageWithFallback src={img} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <div className="absolute inset-0 p-8 flex flex-col justify-end">
        <div className="text-pink-300/70 text-xs tracking-[0.4em] uppercase mb-2">{eyebrow}</div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {badge && (
            <span className="px-2 py-1 rounded bg-pink-500 text-white text-[10px] tracking-widest">{badge}</span>
          )}
          {tags.map((t) => (
            <span key={t} className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">
              {t}
            </span>
          ))}
        </div>
        <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl leading-tight max-w-xl">
          {title}
        </h3>
        <p className="mt-3 text-white/60 max-w-lg text-sm leading-relaxed line-clamp-2">{desc}</p>
        <div className="mt-5 flex gap-3">
          <Link href={href} className="px-5 h-11 rounded-full bg-white text-black flex items-center gap-2 text-sm hover:bg-pink-100 transition">
            <Play className="w-4 h-4 fill-black" /> Xem ngay
          </Link>
          <button className="px-5 h-11 rounded-full bg-white/10 text-white border border-white/20 backdrop-blur text-sm hover:bg-white/15 transition">
            <Bookmark className="w-4 h-4 inline mr-2" /> Lưu lại
          </button>
        </div>
      </div>
    </div>
  );
}
