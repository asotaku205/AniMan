import Link from "next/link";
import { Award, Star } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import { DIRECTORS } from "../data";

export default function DirectorSpotlight() {
  return (
    <section className="py-10 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center gap-2 mb-5">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-xl">Đạo diễn nổi bật</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DIRECTORS.map((d) => (
            <Link
              key={d.slug}
              href={`/film/${d.slug}`}
              className="group rounded-2xl overflow-hidden bg-white/[0.025] border border-white/8 hover:border-rose-400/30 transition"
            >
              <div className="relative aspect-video overflow-hidden">
                <ImageWithFallback src={d.img} alt={d.film} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
              </div>
              <div className="p-3">
                <div className="text-white/50 text-xs">Đạo diễn</div>
                <div className="text-white text-sm group-hover:text-rose-300 transition">{d.name}</div>
                <div className="text-white/40 text-xs mt-0.5 truncate">{d.film}</div>
                <div className="flex items-center gap-1 mt-1.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />{d.score}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
