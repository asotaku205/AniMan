"use client";
import { useMemo, useState } from "react";
import { mangaList } from "../../components/data/mangas";
import { genres, sortOptions, readingModes, NEW_CHAPTERS } from "./data";
import WeeklyRanking from "./components/WeeklyRanking";
import { MangaGrid } from "./components/MangaGrid";
import { FilterBar } from "./components/FilterBar";
import { ChapterUpdate } from "./components/ChapterUpdate";
import HeroSpotlight from "./components/HeroSpotlight";


export default function MangaPageClient() {
  const [genre, setGenre] = useState("Tất cả");
  const [sort, setSort] = useState("new");
  const [readingMode, setReadingMode] = useState("Tất cả");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [spotIdx, setSpotIdx] = useState(0);

  const top = [...mangaList].sort((a, b) => b.score - a.score).slice(0, 3);
  const spotItem = top[spotIdx];

  const filtered = useMemo(() => {
    let list = [...mangaList];
    if (genre !== "Tất cả") list = list.filter((m) => m.tags.includes(genre));
    if (readingMode !== "Tất cả") list = list.filter((m) => m.status === readingMode);
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    if (sort === "chapters") list.sort((a, b) => b.chapters.length - a.chapters.length);
    return list;
  }, [genre, sort, readingMode]);

  return (
    <div className="min-h-screen bg-[#0b0612]">
      {/* Hero spotlight  */}
      <HeroSpotlight
        top={top}
        spotItem={spotItem}
        spotIdx={spotIdx}
        setSpotIdx={setSpotIdx}
      />

      {/* New chapter updates */}
     <ChapterUpdate
      />

      {/* Filter bar */}
      <FilterBar
        readingModes={readingModes}
        sortOptions={sortOptions}
        genres={genres}
        readingMode={readingMode}
        sort={sort}
        view={view}
        genre={genre}
        setReadingMode={setReadingMode}
        setSort={setSort}
        setView={setView}
        setGenre={setGenre}
      />

      {/* Manga grid */}
      <MangaGrid filtered={filtered} genre={genre} view={view} />

      {/* Weekly ranking */}
      <WeeklyRanking />
    </div>
  );
}
