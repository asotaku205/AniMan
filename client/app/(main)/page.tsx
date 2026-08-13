import  Link from "next/link";
import { Hero } from "../components/Hero";
import { DailySchedule } from "../components/DailySchedule";
import { RankingBoard } from "../components/RankingBoard";
import { MediaCard } from "../components/MediaCard";
import { ImageWithFallback } from "../components/ImageWithFallback";
import {
  animeFeatured, animeList, liveFeatured, liveList,
} from "../components/data/catalog";
import { mangaList } from "../components/data/mangas";
import { novelList } from "../components/data/novels";
import {
  Play, BookOpen, Tv, Film, Feather, Wand2, Users, MessageSquare,
  ChevronRight, Star, Bell, Clock, TrendingUp, Zap, Search,
  Bookmark, Eye, Radio
} from "lucide-react";

//  Quick category pills 
const QUICK_CATS = [
  { to: "/anime", icon: <Tv className="w-4 h-4" />, label: "Anime", color: "from-pink-500 to-rose-400", glow: "hover:shadow-[0_0_20px_rgba(255,90,150,0.5)]" },
  { to: "/phim", icon: <Film className="w-4 h-4" />, label: "Phim", color: "from-rose-500 to-orange-400", glow: "hover:shadow-[0_0_20px_rgba(255,100,50,0.5)]" },
  { to: "/manga", icon: <BookOpen className="w-4 h-4" />, label: "Manga", color: "from-violet-500 to-purple-400", glow: "hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]" },
  { to: "/tieu-thuyet", icon: <Feather className="w-4 h-4" />, label: "Tiểu thuyết", color: "from-amber-500 to-yellow-400", glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]" },
  { to: "/studio/manga-ai", icon: <Wand2 className="w-4 h-4" />, label: "Manga AI", color: "from-fuchsia-500 to-pink-400", glow: "hover:shadow-[0_0_20px_rgba(217,70,239,0.5)]" },
  { to: "/watch-party", icon: <Users className="w-4 h-4" />, label: "Watch Party", color: "from-cyan-500 to-blue-400", glow: "hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]" },
  { to: "/forum", icon: <MessageSquare className="w-4 h-4" />, label: "Diễn đàn", color: "from-emerald-500 to-teal-400", glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]" },
  { to: "/tim-kiem", icon: <Search className="w-4 h-4" />, label: "Tìm kiếm", color: "from-slate-500 to-gray-400", glow: "hover:shadow-[0_0_20px_rgba(100,116,139,0.4)]" },
];

// Continue watching (mock)
const CONTINUE_WATCHING = [
  { ...animeList[0], progress: 65, epCurrent: 8, type: "anime", path: `/anime/${animeList[0].slug}/xem/8` },
  { ...animeList[2], progress: 30, epCurrent: 3, type: "anime", path: `/anime/${animeList[2].slug}/xem/3` },
  { ...liveList[0], progress: 80, epCurrent: 1, type: "phim", path: `/phim/${liveList[0].slug}/xem` },
  { ...animeList[6], progress: 15, epCurrent: 2, type: "anime", path: `/anime/${animeList[6].slug}/xem/2` },
];

// Mixed new releases
const NEW_RELEASES = [
  { ...animeList[0], displayPath: `/anime/${animeList[0].slug}`, type: "Anime", meta: "Tập 8 MỚI", color: "text-pink-300", img: animeList[0].img },
  { ...animeList[2], displayPath: `/anime/${animeList[2].slug}`, type: "Anime", meta: "Tập 7 MỚI", color: "text-cyan-300", img: animeList[2].img },
  { ...liveList[0], displayPath: `/phim/${liveList[0].slug}`, type: "Phim", meta: "Vừa ra mắt", color: "text-rose-300", img: liveList[0].img },
  { ...animeList[6], displayPath: `/anime/${animeList[6].slug}`, type: "Anime", meta: "Tập 10 MỚI", color: "text-violet-300", img: animeList[6].img },
  { ...mangaList[0], displayPath: `/manga/${mangaList[0].slug}`, type: "Manga", meta: "Ch.142 MỚI", color: "text-amber-300", img: mangaList[0].cover },
  { ...liveList[6], displayPath: `/phim/${liveList[6].slug}`, type: "Phim", meta: "Premiere hôm nay", color: "text-orange-300", img: liveList[6].img },
];

// Novel feature
const FEATURED_NOVEL = novelList[0];

// Section header component
function SectionHeader({ eyebrow, title, seeAll }: { eyebrow: string; title: React.ReactNode; seeAll?: string }) {
  return (
    <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 text-pink-300/70 tracking-[0.4em] text-xs uppercase mb-2">
          <span className="w-5 h-px bg-pink-400/60" />{eyebrow}
        </div>
        <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">{title}</h2>
      </div>
      {seeAll && (
        <Link href={seeAll} className="flex items-center gap-1 text-pink-300/70 text-sm hover:text-pink-300 transition">
          Xem tất cả <ChevronRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

// Continue watching section
function ContinueWatching() {
  return (
    <section className="py-12 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-white">
            <Play className="w-4 h-4 text-pink-300 fill-pink-300" />
            <span style={{ fontFamily: "Shippori Mincho, serif" }} className="text-xl">Tiếp tục xem</span>
          </div>
          <Link href="/anime" className="text-white/40 text-sm hover:text-pink-300 transition flex items-center gap-1">
            Xem lịch sử <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CONTINUE_WATCHING.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="group relative shrink-0 w-56 rounded-2xl overflow-hidden bg-white/[0.025] border border-white/8 hover:border-pink-400/30 transition-all hover:shadow-[0_8px_30px_rgba(255,90,150,0.1)]"
            >
              <div className="relative aspect-video overflow-hidden">
                <ImageWithFallback src={item.img} alt={item.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                    <Play className="w-5 h-5 fill-white text-white" />
                  </div>
                </div>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px]">
                  {item.type === "phim" ? "Phim" : `Tập ${(item as any).epCurrent}`}
                </div>
                {/* Progress bar */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <div className="h-full bg-gradient-to-r from-pink-400 to-rose-300" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
              <div className="p-3">
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{item.t}</div>
                <div className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {item.progress}% đã xem
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// New releases section
function NewReleasesStrip() {
  return (
    <section className="py-12 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-pink-300/70 tracking-[0.4em] text-xs uppercase mb-2">
              <Bell className="w-3 h-3" /> Cập nhật mới nhất
            </div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">
              Vừa <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">cập nhật</span>
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {NEW_RELEASES.map((item, i) => (
            <Link
              key={item.displayPath}
              href={item.displayPath}
              className={`group flex gap-4 p-4 rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15 transition-all animate-fadeInUp delay-${Math.min(i * 100, 500)}`}
            >
              <div className="relative w-16 shrink-0 rounded-xl overflow-hidden" style={{ height: "88px" }}>
                <ImageWithFallback src={item.img} alt={item.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs ${item.color} mb-1 flex items-center gap-1`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  {item.type} · {item.meta}
                </div>
                <div className="text-white text-sm group-hover:text-pink-300 transition truncate">{item.t}</div>
                <div className="flex items-center gap-1 mt-1.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />
                  {item.score}
                </div>
                <div className="flex items-center gap-1 mt-1 text-white/30 text-[10px]">
                  <Clock className="w-3 h-3" />
                  {["2 giờ trước","5 giờ trước","Vừa xong","1 ngày","3 giờ trước","6 giờ trước"][i]}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

//  Featured dual banner 
function FeaturedBanner({ title, desc, img, tags, href, eyebrow, badge }: {
  title: string; desc: string; img: string; tags: string[]; href: string; eyebrow: string; badge?: string;
}) {
  return (
    <div className="relative rounded-3xl overflow-hidden h-[380px] md:h-[460px] group">
        <ImageWithFallback src={img} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <div className="absolute inset-0 p-8 flex flex-col justify-end">
        <div className="text-pink-300/70 text-xs tracking-[0.4em] uppercase mb-2">{eyebrow}</div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {badge && <span className="px-2 py-1 rounded bg-pink-500 text-white text-[10px] tracking-widest">{badge}</span>}
          {tags.map((t) => (
            <span key={t} className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">{t}</span>
          ))}
        </div>
        <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl leading-tight max-w-xl">{title}</h3>
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

// Novel feature strip
function NovelFeature() {
  return (
    <section className="py-14 bg-gradient-to-b from-[#0b0612] to-[#1a0f06]">
      <div className="max-w-[1400px] mx-auto px-6">
        <SectionHeader eyebrow="Tiểu thuyết" title="Văn học & Tiểu thuyết" seeAll="/tieu-thuyet" />
        <div className="grid md:grid-cols-[260px_1fr] gap-8 items-center">
          {/* Featured book */}
          <Link href={`/tieu-thuyet/${FEATURED_NOVEL.slug}`} className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] block hover:shadow-[0_30px_80px_-20px_rgba(245,158,11,0.3)] transition-all">
            <ImageWithFallback src={FEATURED_NOVEL.cover} alt={FEATURED_NOVEL.t} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 to-transparent" />
          </Link>
          <div>
            <div className="text-amber-300/80 tracking-[0.4em] text-xs uppercase mb-2">Tác phẩm đặc sắc</div>
            <h3 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl">{FEATURED_NOVEL.t}</h3>
            <div className="text-white/50 mt-1">— {FEATURED_NOVEL.author}, {FEATURED_NOVEL.publisher}</div>
            <p className="mt-4 text-white/70 max-w-2xl leading-relaxed italic" style={{ fontFamily: "Caveat, cursive", fontSize: "1.3rem" }}>
              "{FEATURED_NOVEL.excerpt}"
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {FEATURED_NOVEL.tags.map((t) => (
                <span key={t} className="px-3 h-7 leading-7 rounded-full bg-amber-400/10 border border-amber-400/20 text-xs text-amber-300/70">{t}</span>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Link href={`/tieu-thuyet/${FEATURED_NOVEL.slug}/doc/1`} className="px-5 h-11 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-black inline-flex items-center gap-2">
                <Feather className="w-4 h-4" /> Đọc thử
              </Link>
              <Link href={`/tieu-thuyet/${FEATURED_NOVEL.slug}`} className="px-5 h-11 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2 hover:bg-white/10 transition">
                Xem chi tiết
              </Link>
            </div>

            {/* Other novels */}
            <div className="mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {novelList.slice(1, 5).map((n) => (
                <Link key={n.slug} href={`/tieu-thuyet/${n.slug}`} className="group relative shrink-0 w-20">
                  <div className="aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-amber-400/30 transition">
                    <ImageWithFallback src={n.cover} alt={n.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                  </div>
                  <div className="text-white/50 text-[10px] mt-1 truncate group-hover:text-amber-300 transition">{n.t}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Trending horizontal strip
function TrendingStrip() {
  return (
    <section className="py-12 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-pink-300" />
            <span style={{ fontFamily: "Shippori Mincho, serif" }} className="text-xl">Đang xem nhiều nhất</span>
          </div>
          <Link href="/anime" className="text-pink-300/70 text-sm hover:text-pink-300 transition flex items-center gap-1">
            Tất cả <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
          {animeList.slice(0, 7).map((a, i) => (
            <Link
              key={a.slug}
              href={`/anime/${a.slug}`}
              className="group relative shrink-0 w-40 rounded-2xl overflow-hidden"
            >
              <div className="relative h-56">
                <ImageWithFallback src={a.img} alt={a.t} className="w-full h-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-black/60 flex items-center justify-center text-xs text-white/60">{i + 1}</div>
                <div className="absolute top-2 right-2 flex items-center gap-0.5 text-yellow-300 text-xs">
                  <Star className="w-3 h-3 fill-yellow-300" />{a.score}
                </div>
                {i < 2 && (
                  <div className="absolute bottom-14 left-2 flex items-center gap-1 text-rose-300 text-[10px]">
                    <Radio className="w-2.5 h-2.5" />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{a.t}</div>
                <div className="text-white/40 text-xs mt-0.5">{a.ep} tập · {a.studio}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// Catalog section component
function CatalogSection({ eyebrow, title, items, type, seeAllPath }: {
  eyebrow: string;
  title: string;
  items: { slug: string; t: string; img: string; score: number; tags: string[]; ep?: number; year?: number; status?: string; cover?: string }[];
  type: "anime" | "phim" | "manga";
  seeAllPath: string;
}) {
  return (
    <section className="py-14 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <SectionHeader eyebrow={eyebrow} title={title} seeAll={seeAllPath} />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {items.map((item, i) => (
            <MediaCard
              key={item.slug}
              slug={item.slug}
              title={item.t}
              img={type === "manga" ? (item.cover ?? item.img ?? "") : item.img ?? ""}
              score={item.score}
              tags={item.tags}
              meta={
                type === "anime" ? `${item.ep} tập`
                : type === "phim" ? `${item.year}`
                : `${(item as any).chapters?.length ?? "—"} ch.`
              }
              status={item.status}
              isNew={i === 0 || i === 3}
              variant={type}
              views={["1.2M","890K","650K","2.1M","430K","780K"][i % 6]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

//  Studio promo strip 
function StudioPromo() {
  const tools = [
    { href: "/studio/manga-ai", title: "AI Manga ", desc: "Hỗ trợ phác thảo, vẽ truyện tranh với công cụ AI" },
    { href: "/studio/animation", title: "Animation Lab", desc: "Tạo phim hoạt hình với AI hỗ trợ" },
    { href: "/studio/novel", title: "Novel Studio", desc: "Viết tiểu thuyết trên giao diện giấy " },
  ];
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
          <p className="mt-3 text-white/50 max-w-lg mx-auto">Bộ công cụ sáng tác AI — Hoạt hình, truyện tranh đến tiểu thuyết</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {tools.map((t) => (
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

//  Main HomePage 
export default function HomePage() {
  return (
    <>
      {/* 1. Hero */}
      <Hero />

      {/* 2. Quick category pills */}
      <div className="bg-[#0b0612] border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_CATS.map((c) => (
              <Link
                key={c.to}
                href={c.to}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 text-white text-sm bg-gradient-to-r ${c.color} shadow-lg hover:scale-105 transition-all ${c.glow}`}
              >
                {c.icon}
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Stats strip */}
      <div className="bg-[#08050f] border-y border-white/5 py-5">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { k: "12,400+", v: "Anime & Phim", icon: <Tv className="w-4 h-4" /> },
              { k: "85,000+", v: "Manga bản quyền", icon: <BookOpen className="w-4 h-4" /> },
              { k: "320K", v: "Sáng tác viên", icon: <Wand2 className="w-4 h-4" /> },
              { k: "2.4M", v: "Thành viên cộng đồng", icon: <Users className="w-4 h-4" /> },
            ].map((s) => (
              <div key={s.v} className="flex flex-col items-center gap-1">
                <div className="text-pink-300/60 mb-1">{s.icon}</div>
                <div className="text-white text-xl" style={{ fontFamily: "Kaisei Decol, serif" }}>{s.k}</div>
                <div className="text-white/50 text-xs">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Continue watching */}
      <ContinueWatching />

      {/* 8. Featured anime + film */}
      <section className="py-14 bg-[#0b0612]">
        
        <div className="max-w-[1400px] mx-auto px-6">
          
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl">
              Dành <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">cho bạn</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <FeaturedBanner
              eyebrow="Anime · Đang chiếu"
              title={animeFeatured.title}
              desc={animeFeatured.desc}
              img={animeFeatured.img}
              tags={animeFeatured.tags}
              href={animeFeatured.href ?? "/anime"}
              badge="SIMULCAST"
            />
            <FeaturedBanner
              eyebrow="Phim điện ảnh · Premiere"
              title={liveFeatured.title}
              desc={liveFeatured.desc}
              img={liveFeatured.img}
              tags={liveFeatured.tags}
              href={liveFeatured.href ?? "/phim"}
              badge="4K HDR"
            />
          </div>
        </div>
      </section>

      {/* 5. New releases strip */}
      <NewReleasesStrip />  

      {/* 6. Weekly schedule */}
      <DailySchedule />

      {/* 7. Ranking board */}
      <RankingBoard />


      

      {/* 9. Trending strip */}
      <TrendingStrip />

      {/* 10. Anime catalog grid */}
      <CatalogSection
        eyebrow="Anime · Mùa này"
        title="Anime mới nhất"
        items={animeList}
        type="anime"
        seeAllPath="/anime"
      />

      {/* 11. Film catalog */}
      <section className="py-14 bg-[#090511]">
        <div className="max-w-[1400px] mx-auto px-6">
          <SectionHeader eyebrow="Live-Action" title="Phim & J-Drama" seeAll="/phim" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {liveList.map((item, i) => (
              <MediaCard
                key={item.slug}
                slug={item.slug}
                title={item.t}
                img={item.img}
                score={item.score}
                tags={item.tags}
                meta={`${item.year}`}
                status={item.status}
                isNew={i === 0}
                variant="phim"
                views={["2.4M","1.8M","3.1M","890K","1.5M","2.0M","760K","1.1M"][i % 8]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 12. Novel feature */}
      <NovelFeature />

      {/* 13. Manga grid */}
      <section className="py-14 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6">
          <SectionHeader eyebrow="Manga" title="Manga bản quyền" seeAll="/manga" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-3">
            {mangaList.map((m, i) => (
              <MediaCard
                key={m.slug}
                slug={m.slug}
                title={m.t}
                img={m.cover}
                score={m.score}
                tags={m.tags}
                meta={`${m.chapters.length} chương`}
                status={m.status === "Đang ra" ? "Đang chiếu" : "Đã hoàn thành"}
                isNew={i === 0 || i === 4}
                variant="manga"
                views={["3.1M","2.4M","1.8M","890K","2.7M","640K","1.2M","950K"][i % 8]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 14. Studio promo */}
      <StudioPromo />
    </>
  );
}
