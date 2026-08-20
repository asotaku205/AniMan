import { MediaCard } from "@/app/components/MediaCard";
import type { Title } from "../../../components/data/catalog";
import { ALL_FILM_LABEL } from "../data";

type FilmMainGridProps = {
  filtered: Title[];
  genre: string;
};

export default function FilmMainGrid({ filtered, genre }: FilmMainGridProps) {
  return (
    <section className="py-10 bg-[#0b0612]">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-2xl">
            {filtered.length} phim {genre !== ALL_FILM_LABEL ? `thể loại ${genre}` : ""}
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {filtered.map((f, i) => (
            <div key={f.slug} className={`animate-fadeInUp delay-${Math.min((i % 5) * 100, 400)}`}>
              <MediaCard
                slug={f.slug}
                title={f.t}
                img={f.img}
                score={f.score}
                tags={f.tags}
                meta={`${f.year}`}
                status={f.status}
                isNew={i === 0}
                variant="phim"
                views={["2.4M", "1.8M", "3.1M", "890K", "1.5M"][i % 5]}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
