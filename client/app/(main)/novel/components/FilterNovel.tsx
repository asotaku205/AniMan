import { Filter, Search } from 'lucide-react'
import React from 'react'
import { sortOptions, tags } from '../data';
type FilterNovelProps = {
    searchQ: string;
    setSearchQ: (q: string) => void;
    sort: string;
    setSort: (s: string) => void;
    tag: string;
    setTag: (t: string) => void;
}
const FilterNovel = ({searchQ, setSearchQ, sort, setSort, tag, setTag}: FilterNovelProps) => {
  return (
     <div className="bg-[#0b0612] border-b border-white/5 sticky top-16 z-30 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-6 py-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 focus-within:border-amber-400/40 transition flex-1 sm:flex-none sm:w-56">
              <Search className="w-3.5 h-3.5 text-white/40 shrink-0" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Tìm tên sách, tác giả..."
                className="bg-transparent outline-none text-xs text-white placeholder:text-white/30 w-full"
              />
            </div>
            <div className="flex gap-1.5 items-center">
              <Filter className="w-3.5 h-3.5 text-white/40" />
              {sortOptions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-3 h-8 rounded-full text-xs transition ${sort === s.key ? "bg-gradient-to-r from-amber-400 to-orange-400 text-black" : "bg-white/5 border border-white/10 text-white/60 hover:text-white"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`px-3 h-7 rounded-full text-xs whitespace-nowrap transition ${tag === t ? "bg-gradient-to-r from-amber-400 to-orange-400 text-black" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
  )
}

export default FilterNovel