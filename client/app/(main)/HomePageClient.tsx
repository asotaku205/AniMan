import Link from "next/link";
import { Hero } from "../components/Hero";
import { DailySchedule } from "../components/DailySchedule";
import { RankingBoard } from "../components/RankingBoard";
import { QUICK_CATS, animeFeatured, liveFeatured, animeList, liveList, mangaList } from "./data";
import { StatsStrip }        from "../components/sections/StatsStrip";
import { ContinueWatching }  from "../components/sections/ContinueWatching";
import { FeaturedBanner }    from "../components/sections/FeaturedBanner";
import { NewReleasesStrip }  from "../components/sections/NewReleasesStrip";
import { NovelFeature }      from "../components/sections/NovelFeature";
import { TrendingStrip }     from "../components/sections/TrendingStrip";
import { CatalogSection }    from "../components/sections/CatalogSection";
import { StudioPromo }       from "../components/sections/StudioPromo";

export default function HomePageClient() {
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

      {/* 3. Stats */}
      <StatsStrip />

      {/* 4. Continue watching */}
      <ContinueWatching />

      {/* 5. Featured anime + film */}
      <section className="py-14 bg-[#0b0612]">
        <div className="max-w-[1400px] mx-auto px-6">
          <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl md:text-3xl mb-6">
            Dành <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">cho bạn</span>
          </h2>
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

      {/* 6. New releases */}
      <NewReleasesStrip />

      {/* 7. Weekly schedule */}
      <DailySchedule />

      {/* 8. Ranking board */}
      <RankingBoard />

      {/* 9. Trending */}
      <TrendingStrip />

      {/* 10. Anime catalog */}
      <CatalogSection
        eyebrow="Anime · Mùa này"
        title="Anime mới nhất"
        items={animeList}
        type="anime"
        seeAllPath="/anime"
      />

      {/* 11. Film catalog */}
      <CatalogSection
        eyebrow="Live-Action"
        title="Phim & J-Drama"
        items={liveList}
        type="phim"
        seeAllPath="/phim"
        bg="bg-[#090511]"
        cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        views={["2.4M", "1.8M", "3.1M", "890K", "1.5M", "2.0M", "760K", "1.1M"]}
      />

      {/* 12. Novel feature */}
      <NovelFeature />

      {/* 13. Manga catalog */}
      <CatalogSection
        eyebrow="Manga"
        title="Manga bản quyền"
        items={mangaList.map((m) => ({ ...m, img: m.cover }))}
        type="manga"
        seeAllPath="/manga"
        cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8"
        views={["3.1M", "2.4M", "1.8M", "890K", "2.7M", "640K", "1.2M", "950K"]}
      />

      {/* 14. Studio promo */}
      <StudioPromo />
    </>
  );
}
