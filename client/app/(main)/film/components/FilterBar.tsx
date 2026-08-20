import { Filter } from "lucide-react";
import type { FilmSortKey, sortOptions } from "../data";

type FilterBarProps = {
  genres: string[];
  types: string[];
  sortOptions: typeof sortOptions;
  genre: string;
  type: string;
  sort: FilmSortKey;
  onGenreChange: (genre: string) => void;
  onTypeChange: (type: string) => void;
  onSortChange: (sort: FilmSortKey) => void;
};

export default function FilterBar({
  genres,
  types,
  sortOptions,
  genre,
  type,
  sort,
  onGenreChange,
  onTypeChange,
  onSortChange,
}: FilterBarProps) {
  return (
    <div className="bg-[#0b0612] border-y border-white/5 sticky top-16 z-30 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 items-center">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            {types.map((tp) => (
              <button
                key={tp}
                onClick={() => onTypeChange(tp)}
                className={`px-3 h-8 rounded-full text-xs transition ${type === tp ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
              >
                {tp}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          {sortOptions.map((s) => (
            <button
              key={s.key}
              onClick={() => onSortChange(s.key)}
              className={`px-3 h-8 rounded-full text-xs transition ${sort === s.key ? "bg-gradient-to-r from-rose-500 to-pink-400 text-white" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => onGenreChange(g)}
              className={`px-3 h-7 rounded-full text-xs whitespace-nowrap transition ${genre === g ? "bg-gradient-to-r from-rose-500 to-pink-400 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
