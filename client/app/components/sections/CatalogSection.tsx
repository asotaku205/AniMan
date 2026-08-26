import { MediaCard } from "../MediaCard";
import { SectionHeader } from "./SectionHeader";

type CatalogItem = {
  slug: string;
  t: string;
  img: string;
  score: number;
  tags: string[];
  ep?: number;
  year?: number;
  status?: string;
  cover?: string;
  chapters?: unknown[];
};

type Props = {
  eyebrow: string;
  title: string;
  items: CatalogItem[];
  type: "anime" | "film" | "manga";
  seeAllPath: string;
  bg?: string;
  cols?: string;
  views?: string[];
};

const DEFAULT_VIEWS_6  = ["1.2M", "890K", "650K", "2.1M", "430K", "780K"];
const DEFAULT_VIEWS_8  = ["2.4M", "1.8M", "3.1M", "890K", "1.5M", "2.0M", "760K", "1.1M"];

function getMeta(item: CatalogItem, type: Props["type"]): string {
  if (type === "anime") return `${item.ep} tập`;
  if (type === "film")  return `${item.year}`;
  return `${(item.chapters as unknown[])?.length ?? "—"} ch.`;
}

export function CatalogSection({
  eyebrow, title, items, type, seeAllPath,
  bg = "bg-[#0b0612]",
  cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
  views,
}: Props) {
  const viewList = views ?? (cols.includes("xl:grid-cols-8") ? DEFAULT_VIEWS_8 : DEFAULT_VIEWS_6);

  return (
    <section className={`py-14 ${bg}`}>
      <div className="max-w-[1400px] mx-auto px-6">
        <SectionHeader eyebrow={eyebrow} title={title} seeAll={seeAllPath} />
        <div className={`grid ${cols} gap-3 md:gap-4`}>
          {items.map((item, i) => (
            <MediaCard
              key={item.slug}
              slug={item.slug}
              title={item.t}
              img={type === "manga" ? (item.cover ?? item.img ?? "") : item.img ?? ""}
              score={item.score}
              tags={item.tags}
              meta={getMeta(item, type)}
              status={item.status}
              isNew={i === 0 || i === 3}
              variant={type}
              views={viewList[i % viewList.length]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
