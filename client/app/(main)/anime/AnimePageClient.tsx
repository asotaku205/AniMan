"use client";

import { useMemo, useState } from "react";
import { DailySchedule } from "../../components/DailySchedule";
import { animeList } from "../../components/data/catalog";
import { AnimeFilterBar } from "./components/AnimeFilterBar";
import { AnimeGrid } from "./components/AnimeGrid";
import { AnimeSpotlight } from "./components/AnimeSpotlight";
import { CompletedAnime } from "./components/CompletedAnime";
import { FeaturedAnimeBanner } from "./components/FeaturedAnimeBanner";
import { NewEpisodesStrip } from "./components/NewEpisodesStrip";
import { TopRatedAnime } from "./components/TopRatedAnime";
import { ALL_GENRES_LABEL, genres, NEW_EPS, seasons, sortOptions, SPOTLIGHTS, type AnimeSortKey } from "./data";

export default function AnimePageClient() {
  const [genre, setGenre] = useState(ALL_GENRES_LABEL);
  const [season, setSeason] = useState(seasons[0]);
  const [sort, setSort] = useState<AnimeSortKey>("newest");
  const [activeSpot, setActiveSpot] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);

  const filtered = useMemo(() => {
    let list = [...animeList];
    if (genre !== ALL_GENRES_LABEL) list = list.filter((x) => x.tags.includes(genre));
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    if (sort === "newest") list.sort((a, b) => b.year - a.year);
    return list;
  }, [genre, sort]);

  const spot = SPOTLIGHTS[activeSpot];

  return (
    <div className="min-h-screen bg-[#0b0612]">
      <AnimeSpotlight
        spot={spot}
        spotlights={SPOTLIGHTS}
        activeSpot={activeSpot}
        onSelectSpot={setActiveSpot}
      />
      <NewEpisodesStrip episodes={NEW_EPS} />
      <AnimeFilterBar
        genres={genres}
        seasons={seasons}
        sortOptions={sortOptions}
        genre={genre}
        season={season}
        sort={sort}
        showSchedule={showSchedule}
        onGenreChange={setGenre}
        onSeasonChange={setSeason}
        onSortChange={setSort}
        onToggleSchedule={() => setShowSchedule((value) => !value)}
      />
      {showSchedule && <DailySchedule />}
      <FeaturedAnimeBanner />
      <AnimeGrid items={filtered} genre={genre} season={season} />
      <TopRatedAnime items={animeList} />
      <CompletedAnime items={animeList} />
    </div>
  );
}
