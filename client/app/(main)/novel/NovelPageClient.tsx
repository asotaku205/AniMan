"use client"; 
import { useMemo, useState } from "react";
import { novelList } from "../../components/data/novels";
import HeroSection from "./components/HeroSection";
import Stats from "./components/Stats";
import FilterNovel from "./components/FilterNovel";
import NovelList from "./components/NovelList";
import TrendingNovel from "./components/TrendingNovel";

export default function NovelPageClient() {
  const [tag, setTag] = useState("Tất cả");
  const [sort, setSort] = useState("score");
  const [searchQ, setSearchQ] = useState("");
  const filtered = useMemo(() => {
    let list = tag === "Tất cả" ? [...novelList] : novelList.filter((n) => n.tags.includes(tag));
    if (searchQ.trim()) {
      const lq = searchQ.toLowerCase();
      list = list.filter((n) => n.t.toLowerCase().includes(lq) || n.author.toLowerCase().includes(lq));
    }
    if (sort === "score") list.sort((a, b) => b.score - a.score);
    if (sort === "newest") list.sort((a, b) => b.year - a.year);
    if (sort === "words") list.sort((a, b) => parseInt(b.words) - parseInt(a.words));
    return list;
  }, [tag, sort, searchQ]);

 

  return (
    <div className="min-h-screen bg-[#0b0612]">
      {/* Hero */}
      <HeroSection
       
      />

      {/* Stats */}
      <Stats />

      {/* Filter bar */}
      <FilterNovel
      searchQ={searchQ}
      setSearchQ={setSearchQ}
      sort={sort}
      setSort={setSort}
      tag={tag}
      setTag={setTag}
      />

      {/* Novel list */}
      <NovelList filtered={filtered} />
      {/* Trending novels */}
      <TrendingNovel/>
    </div>
  );
}
