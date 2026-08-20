"use client";

import { useMemo, useState } from "react";
import { liveList } from "../../components/data/catalog";
import { ALL_FILM_LABEL, genres, sortOptions, types, type FilmSortKey } from "./data";
import DirectorSpotlight from "./components/DirectorSpotlight";
import FeaturedFilmSection from "./components/FeaturedFilmSection";
import FilmHero from "./components/FilmHero";
import FilmMainGrid from "./components/FilmMainGrid";
import FilterBar from "./components/FilterBar";

export default function FilmPageClient() {
  const [genre, setGenre] = useState(ALL_FILM_LABEL);
  const [type, setType] = useState(ALL_FILM_LABEL);
  const [sort, setSort] = useState<FilmSortKey>("newest");
  const [heroIdx, setHeroIdx] = useState(0);

  const filtered = useMemo(() => {
    let list = [...liveList];
    if (genre !== ALL_FILM_LABEL) list = list.filter((x) => x.tags.includes(genre));
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    if (sort === "newest") list.sort((a, b) => b.year - a.year);
    return list;
  }, [genre, sort]);

  const heroFilms = liveList.slice(0, 3);
  const hero = heroFilms[heroIdx];

  return (
    <div className="min-h-screen bg-[#0b0612]">
      <FilmHero hero={hero} heroFilms={heroFilms} heroIdx={heroIdx} onSelectHero={setHeroIdx} />
      <FeaturedFilmSection films={liveList} />
      <FilterBar
        genres={genres}
        types={types}
        sortOptions={sortOptions}
        genre={genre}
        type={type}
        sort={sort}
        onGenreChange={setGenre}
        onTypeChange={setType}
        onSortChange={setSort}
      />
      <FilmMainGrid filtered={filtered} genre={genre} />
      <DirectorSpotlight />
    </div>
  );
}
