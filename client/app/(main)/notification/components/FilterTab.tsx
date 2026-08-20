import React from 'react'
import { FILTER_TABS } from '../data'


const FilterTab = (
{ filter, setFilter, unreadCount }:{ filter: string, setFilter: (filter: string) => void, unreadCount: number }) => {
  return (
    <div className="flex gap-2 mb-6 overflow-x-auto pb-1 [scrollbar-width:none]">
              {FILTER_TABS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-4 h-8 rounded-full text-sm whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                    filter === f.key
                      ? "bg-pink-500/20 border border-pink-400/40 text-pink-300"
                      : "bg-white/5 border border-white/10 text-white/50 hover:text-white"
                  }`}
                >
                  {f.label}
                  {f.key === "all" && unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-pink-500 text-white text-[10px] min-w-[18px] text-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
  )
}

export default FilterTab