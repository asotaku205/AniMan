import { Search } from "lucide-react";
import type { Filter } from "../types";

type WatchPartyFilterBarProps = {
  filter: Filter;
  query: string;
  favoritesCount: number;
  setFilter: (value: Filter) => void;
  setQuery: (value: string) => void;
};

export default function WatchPartyFilterBar({
  filter,
  query,
  favoritesCount,
  setFilter,
  setQuery,
}: WatchPartyFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6 md:mb-8">
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { k: "all", label: "Tất cả" },
          { k: "live", label: "Đang LIVE" },
          { k: "upcoming", label: "Sắp diễn ra" },
          { k: "public", label: "Công khai" },
          { k: "private", label: "Riêng tư" },
          { k: "favorites", label: `Yêu thích${favoritesCount ? ` (${favoritesCount})` : ""}` },
        ] as const).map((item) => (
          <button
            key={item.k}
            onClick={() => setFilter(item.k)}
            className={`px-3 md:px-4 h-9 rounded-full text-xs transition ${
              filter === item.k ? "bg-linear-to-r from-pink-500 to-rose-400 text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="md:ml-auto relative">
        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm phòng, tác phẩm hoặc host…"
          className="w-full md:w-80 pl-9 pr-3 h-10 rounded-full bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/40"
        />
      </div>
    </div>
  );
}
