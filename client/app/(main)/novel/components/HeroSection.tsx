import { novelList } from "@/app/components/data/novels";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";
import { BookMarked, Crown, Feather, Star } from "lucide-react";
import Link from "next/link";
const HeroSection = () => {
  const featured = novelList[0];
  const topRated = [...novelList].sort((a, b) => b.score - a.score).slice(0, 3);
  return (
    <section className="relative py-16 overflow-hidden">
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,#3a2412_0%,#0b0612_70%)]" />
      <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(90deg,transparent_0_60px,rgba(0,0,0,0.4)_60px_61px)]" />

      <div className="relative max-w-[1400px] mx-auto px-6">
        <div className="text-center mb-12 animate-fadeInUp">
          <div className="flex items-center justify-center gap-2 text-amber-300/70 tracking-[0.4em] text-xs uppercase mb-4">
            <Feather className="w-3.5 h-3.5" /> Văn học & Light Novel Nhật
          </div>
          <h1
            style={{ fontFamily: "Shippori Mincho, serif" }}
            className="text-amber-50 text-4xl md:text-5xl"
          >
            Tủ sách <span className="text-shimmer">bản quyền</span>
          </h1>
          
        </div>

        {/* Featured book + top 3 */}
        <div className="grid md:grid-cols-[240px_1fr] gap-8 items-start">
          {/* Book cover */}
          <Link
            href={`/novel/${featured.slug}`}
            className="relative mx-auto md:mx-0 w-48 md:w-auto block animate-fadeInUp delay-100"
          >
            <div
              className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-amber-200/10 hover:shadow-[0_40px_80px_-20px_rgba(245,158,11,0.3)] transition-all"
              style={{ transform: "perspective(800px) rotateY(-5deg)" }}
            >
              <ImageWithFallback
                src={featured.cover}
                alt={featured.t}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/70 to-transparent" />
            </div>
            <div className="absolute -bottom-3 -right-3 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-black text-xs shadow-lg">
              ✦ Tác phẩm nổi bật
            </div>
          </Link>

          {/* Info + top 3 */}
          <div className="animate-fadeInUp delay-200">
            <div className="text-amber-300/80 tracking-[0.4em] text-xs uppercase mb-2">
              Tác phẩm được yêu thích nhất
            </div>
            <h2
              style={{ fontFamily: "Shippori Mincho, serif" }}
              className="text-amber-50 text-3xl md:text-4xl"
            >
              {featured.t}
            </h2>
            <div className="text-amber-100/60 mt-1">
              — {featured.author} · {featured.publisher}
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-amber-100/60">
              <span className="flex items-center gap-1.5 text-yellow-300">
                <Star className="w-4 h-4 fill-yellow-300" />
                {featured.score}
              </span>
              <span className="flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5" />
                {featured.words}
              </span>
              <span>{featured.status}</span>
            </div>
            <p
              className="mt-4 text-amber-100/70 max-w-2xl leading-relaxed italic"
              style={{ fontFamily: "Caveat, cursive", fontSize: "1.2rem" }}
            >
              "{featured.excerpt}"
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {featured.tags.map((t) => (
                <span
                  key={t}
                  className="px-3 h-7 leading-7 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300/70"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <Link
                href={`/novel/${featured.slug}/1`}
                className="px-5 h-11 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black inline-flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all"
              >
                <Feather className="w-4 h-4" /> Đọc thử
              </Link>
              <Link
                href={`/novel/${featured.slug}`}
                className="px-5 h-11 rounded-full bg-white/5 border border-amber-200/30 text-amber-50 inline-flex items-center gap-2 hover:bg-white/10 transition"
              >
                Chi tiết
              </Link>
            </div>

            {/* Other top books */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              {topRated.slice(0, 3).map((n, i) => (
                <Link
                  key={n.slug}
                  href={`/novel/${n.slug}`}
                  className="group flex gap-2 p-2.5 rounded-xl bg-white/[0.025] border border-white/8 hover:border-amber-400/20 transition"
                >
                  <div
                    className="relative w-10 shrink-0"
                    style={{ aspectRatio: "2/3" }}
                  >
                    <ImageWithFallback
                      src={n.cover}
                      alt={n.t}
                      className="w-full h-full object-cover rounded"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-xs truncate group-hover:text-amber-300 transition">
                      {n.t}
                    </div>
                    <div className="flex items-center gap-1 text-yellow-300 text-[10px] mt-1">
                      <Star className="w-2.5 h-2.5 fill-yellow-300" />
                      {n.score}
                    </div>
                    {i === 0 && (
                      <Crown className="w-3 h-3 text-yellow-400 mt-0.5" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
