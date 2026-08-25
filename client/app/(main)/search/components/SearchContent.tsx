import { Filter, Search, X } from "lucide-react";
import { ALL_GENRES, ContentType, SORT_LABELS, SortType, TYPE_LABELS, UnifiedItem } from "../data";
import { SearchResultCard } from "./SearchResultCard";
import type { Dispatch, SetStateAction } from "react";

type SearchContentProps = {
  query: string;
  results: UnifiedItem[];
  contentType: ContentType;
  setContentType: Dispatch<SetStateAction<ContentType>>;
  selectedGenres: string[];
  sort: SortType;
  setSort: Dispatch<SetStateAction<SortType>>;
  minScore: number;
  setMinScore: Dispatch<SetStateAction<number>>;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  hasActiveFilters: boolean;
  toggleGenre: (genre: string) => void;
  clearFilters: () => void;
  handleSearch: (query: string) => void;
};

const SearchContent = ({
  query,
  results,
  contentType,
  setContentType,
  selectedGenres,
  sort,
  setSort,
  minScore,
  setMinScore,
  showFilters,
  setShowFilters,
  hasActiveFilters,
  toggleGenre,
  clearFilters,
  handleSearch,
}: SearchContentProps) => {
  return (
     <section className="max-w-[1400px] mx-auto px-6 pb-16">
        {/* Type tabs */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {(Object.keys(TYPE_LABELS) as ContentType[]).map((t) => (
            <button
              key={t}
              onClick={() => setContentType(t)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${contentType === t ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-[0_0_20px_rgba(255,90,150,0.3)]" : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/20"}`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${showFilters || hasActiveFilters ? "bg-pink-500/15 border-pink-400/40 text-pink-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white"}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Bộ lọc
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-pink-400" />}
          </button>
        </div>

        {/* Expandable filters */}
        {showFilters && (
          <div className="mb-6 p-5 rounded-2xl bg-white/[0.025] border border-white/8 space-y-5 animate-fadeInUp">
            {/* Genres */}
            <div>
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Thể loại</div>
              <div className="flex flex-wrap gap-2">
                {ALL_GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`px-3 h-7 rounded-full text-xs transition ${selectedGenres.includes(g) ? "bg-gradient-to-r from-pink-500 to-rose-400 text-white" : "bg-white/5 border border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort + Score */}
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Sắp xếp</div>
                <div className="flex gap-2">
                  {(Object.keys(SORT_LABELS) as SortType[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`px-3 h-8 rounded-full text-xs transition ${sort === s ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
                    >
                      {SORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-white/50 text-xs uppercase tracking-wider mb-2">Điểm tối thiểu: {minScore > 0 ? minScore.toFixed(1) : "Tất cả"}</div>
                <div className="flex gap-2">
                  {[0, 7, 8, 9].map((v) => (
                    <button
                      key={v}
                      onClick={() => setMinScore(v)}
                      className={`px-3 h-8 rounded-full text-xs transition ${minScore === v ? "bg-white text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
                    >
                      {v === 0 ? "Tất cả" : `${v}+`}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition ml-auto"
                >
                  <X className="w-3 h-3" /> Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-white/60 text-sm">
            {query ? (
              <>Tìm thấy <span className="text-white">{results.length}</span> kết quả cho &quot;<span className="text-pink-300">{query}</span>&quot;</>
            ) : (
              <>Tất cả nội dung — <span className="text-white">{results.length}</span> tác phẩm</>
            )}
          </div>
          {!showFilters && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className="bg-white/5 border border-white/10 text-white/60 text-xs rounded-lg px-3 py-1.5 outline-none hover:border-white/20 transition"
            >
              {(Object.keys(SORT_LABELS) as SortType[]).map((s) => (
                <option key={s} value={s}>{SORT_LABELS[s]}</option>
              ))}
            </select>
          )}
        </div>

        {/* Results grid */}
        {results.length === 0 ? (
          <div className="py-24 text-center">
            <Search className="w-12 h-12 text-white/15 mx-auto mb-4" />
            <div className="text-white/50 text-lg">Không tìm thấy kết quả</div>
            <div className="text-white/30 text-sm mt-2">Thử tìm với từ khóa khác hoặc bỏ bộ lọc</div>
            <button
              onClick={() => { clearFilters(); handleSearch(""); }}
              className="mt-6 px-5 h-10 rounded-full bg-white/5 border border-white/15 text-white/70 text-sm hover:bg-white/10 transition"
            >
              Xóa bộ lọc & tìm lại
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {results.map((item, i) => (
              <SearchResultCard key={`${item.type}-${item.slug}`} item={item} index={i} />
            ))}
          </div>
        )}
      </section>
  )
}

export default SearchContent