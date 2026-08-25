import { HOT_SEARCHES } from '../data';
import { Search, Sparkles, TrendingUp, X } from 'lucide-react';
import { Dispatch, SetStateAction } from "react";
type HeroSearchProps = {
  handleSearch: (q: string) => void;
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  query: string;
};
const HeroSearch = ({handleSearch,inputValue,setInputValue,query}:HeroSearchProps) => {
  return (
     <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2a0d3a_0%,#0b0612_60%)]" />
        <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,0.03)_3px,rgba(255,255,255,0.03)_4px)]" />
        <div className="relative max-w-[900px] mx-auto px-6">
          <div className="text-center mb-8 animate-fadeInUp">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Khám phá nội dung
            </div>
            <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-4xl md:text-5xl mb-3">
              Tìm kiếm <span className="text-shimmer">nội dung</span>
            </h1>
            <p className="text-white/50">Hơn 100,000 tác phẩm anime, phim, manga và tiểu thuyết</p>
          </div>

          {/* Main search input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(inputValue); }}
            className="relative animate-scaleIn delay-100"
          >
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white/5 border border-white/15 focus-within:border-pink-400/50 focus-within:bg-[#1a0f2e] transition-all shadow-[0_8px_40px_rgba(0,0,0,0.4)] focus-within:shadow-[0_8px_40px_rgba(255,90,150,0.15)]">
              <Search className="w-5 h-5 text-pink-300/70 shrink-0" />
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Tên anime, manga, tác giả, thể loại..."
                className="flex-1 bg-transparent outline-none text-white placeholder:text-white/30 text-base"
                autoFocus
              />
              {inputValue && (
                <button type="button" onClick={() => { setInputValue(""); handleSearch(""); }} className="text-white/40 hover:text-white/70 transition">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button type="submit" className="px-5 h-9 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white text-sm shrink-0 hover:from-pink-400 hover:to-rose-300 transition">
                Tìm
              </button>
            </div>
          </form>

          {/* Hot searches */}
          {!query && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 animate-fadeIn delay-200">
              <span className="text-white/30 text-xs flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Tìm kiếm phổ biến:</span>
              {HOT_SEARCHES.map((h) => (
                <button
                  key={h}
                  onClick={() => { setInputValue(h); handleSearch(h); }}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs hover:bg-white/10 hover:text-white transition"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
  )
}

export default HeroSearch