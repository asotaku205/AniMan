import { ArrowRight, Filter, Layers } from "lucide-react";
import React from "react";
type FilterBarProps = {
  readingModes: string[];
  sortOptions: { key: string; label: string }[];
  genres: string[];
  readingMode: string;
  sort: string;
  view: "grid" | "list";
  genre: string;
  setReadingMode: (mode: string) => void;
  setSort: (sort: string) => void;
  setView: (view: "grid" | "list") => void;
  setGenre: (genre: string) => void;
};
export const FilterBar = ({
  readingModes,
  sortOptions,
  genres,
  readingMode,
  sort,
  view,
  genre,
  setReadingMode,
  setSort,
  setView,
  setGenre,
}: FilterBarProps) => {
  return (
    <div className="bg-[#0b0612] border-b border-white/5 sticky top-16 z-30 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 items-center">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            {readingModes.map((m) => (
              <button
                key={m}
                onClick={() => setReadingMode(m)}
                className={`px-3 h-8 rounded-full text-xs transition ${readingMode === m ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          {sortOptions.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 h-8 rounded-full text-xs transition ${sort === s.key ? "bg-gradient-to-r from-violet-500 to-purple-400 text-white" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
            >
              {s.label}
            </button>
          ))}
          {/* View toggle */}
          <div className="ml-auto flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-1.5 rounded-lg text-xs transition ${view === "grid" ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-lg text-xs transition ${view === "list" ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className={`px-3 h-7 rounded-full text-xs whitespace-nowrap transition ${genre === g ? "bg-gradient-to-r from-violet-500 to-purple-400 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
