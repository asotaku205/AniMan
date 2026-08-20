import { MediaCard } from "../../../components/MediaCard";
import type { Title } from "../../../components/data/catalog";
import { ALL_GENRES_LABEL } from "../data";

type AnimeGridProps = {
  items: Title[];
  genre: string;
  season: string;
};

export function AnimeGrid({ items, genre, season }: AnimeGridProps) {
  return (
    <section className="py-10 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-white/40 text-xs uppercase tracking-wider mb-1">{genre === ALL_GENRES_LABEL ? ALL_GENRES_LABEL : genre} · {season}</div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl">
              {items.length} anime {genre !== ALL_GENRES_LABEL ? `thể loại ${genre}` : ""}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
          {items.map((a, i) => (
            <div key={a.slug} className={`animate-fadeInUp delay-${Math.min((i % 6) * 100, 500)}`}>
              <MediaCard
                slug={a.slug}
                title={a.t}
                img={a.img}
                score={a.score}
                tags={a.tags}
                meta={`${a.ep} tập`}
                status={a.status}
                isNew={i === 0 || i === 3}
                variant="anime"
                views={["1.2M", "890K", "650K", "2.1M", "430K", "780K"][i % 6]}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
