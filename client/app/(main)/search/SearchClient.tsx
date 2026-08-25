"use client"
import { useState, useMemo, useEffect } from "react";
import { useSearchParams,useRouter } from "next/navigation";
import {allItems, ContentType, SortType} from "./data"
import HeroSearch from "./components/HeroSearch";
import SearchContent from "./components/SearchContent";


export function SearchPageClient() {
  const searchParams= useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get("q") ?? "");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [sort, setSort] = useState<SortType>("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState(0);
 const router = useRouter();

  const query = searchParams.get("q") ?? "";

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  function handleSearch(q: string) {
    const params: Record<string, string> = {};
    if (q.trim()) params.q = q.trim();
      router.push(`/search?${params.toString()}`);
  }

  function toggleGenre(g: string) {
    setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  function clearFilters() {
    setContentType("all");
    setSelectedGenres([]);
    setSort("relevance");
    setMinScore(0);
  }

  const results = useMemo(() => {
    let list = [...allItems];

    // Filter by query
    if (query.trim()) {
      const lq = query.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(lq) ||
          item.tags.some((t) => t.toLowerCase().includes(lq)) ||
          (item.author ?? "").toLowerCase().includes(lq)
      );
    }

    // Filter by type
    if (contentType !== "all") list = list.filter((item) => item.type === contentType);

    // Filter by genre
    if (selectedGenres.length > 0) list = list.filter((item) => selectedGenres.some((g) => item.tags.includes(g)));

    // Filter by score
    if (minScore > 0) list = list.filter((item) => item.score >= minScore);

    // Sort
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    else if (sort === "newest") list.sort((a, b) => b.year - a.year);
    else if (sort === "oldest") list.sort((a, b) => a.year - b.year);

    return list;
  }, [query, contentType, selectedGenres, sort, minScore]);

  const hasActiveFilters = contentType !== "all" || selectedGenres.length > 0 || minScore > 0 || sort !== "relevance";

  return (
    <div className="min-h-screen bg-[#0b0612]">
      {/* Hero search area */}
     
      <HeroSearch
      setInputValue={setInputValue}
      handleSearch={handleSearch}
      inputValue={inputValue}
      query={query}
  
      />
      {/* Filters + Results */}
      <SearchContent
        query={query}
        results={results}
        contentType={contentType}
        setContentType={setContentType}
        selectedGenres={selectedGenres}
        sort={sort}
        setSort={setSort}
        minScore={minScore}
        setMinScore={setMinScore}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        hasActiveFilters={hasActiveFilters}
        toggleGenre={toggleGenre}
        clearFilters={clearFilters}
        handleSearch={handleSearch}
      />
    </div>
  );
}
