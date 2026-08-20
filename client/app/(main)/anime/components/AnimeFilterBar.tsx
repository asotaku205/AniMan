import { Calendar, Filter } from "lucide-react";
import type { AnimeSortKey, sortOptions } from "../data";

type AnimeFilterBarProps = {
  genres: string[];
  seasons: string[];
  sortOptions: typeof sortOptions;
  genre: string;
  season: string;
  sort: AnimeSortKey;
  showSchedule: boolean;
  onGenreChange: (genre: string) => void;
  onSeasonChange: (season: string) => void;
  onSortChange: (sort: AnimeSortKey) => void;
  onToggleSchedule: () => void;
};

export function AnimeFilterBar({
  genres,
  seasons,
  sortOptions,
  genre,
  season,
  sort,
  showSchedule,
  onGenreChange,
  onSeasonChange,
  onSortChange,
  onToggleSchedule,
}: AnimeFilterBarProps) {
  return (
    <div className="bg-[#0b0612] border-b border-white/5 sticky top-16 z-30 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {seasons.map((s) => (
              <button
                key={s}
                onClick={() => onSeasonChange(s)}
                className={`px-3 h-8 rounded-full text-xs transition ${season === s ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-white/10 hidden sm:block" />
          <div className="flex gap-1.5 items-center">
            <Filter className="w-3.5 h-3.5 text-white/40" />
            {sortOptions.map((s) => (
              <button
                key={s.key}
                onClick={() => onSortChange(s.key)}
                className={`px-3 h-8 rounded-full text-xs transition ${sort === s.key ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <button
              onClick={onToggleSchedule}
              className={`flex items-center gap-2 px-3 h-8 rounded-full text-xs border transition ${showSchedule ? "bg-pink-500/15 border-pink-400/40 text-pink-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white"}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Lịch chiếu
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => onGenreChange(g)}
              className={`px-3 h-7 rounded-full text-xs whitespace-nowrap transition ${genre === g ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
