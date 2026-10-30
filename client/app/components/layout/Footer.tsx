'use client';
import { SakuraMark } from "@/app/components/ui/Logo";

export function Footer() {
  return (
    <footer className="relative border-t border-[#d4a648]/20 bg-[#050309]/95 overflow-hidden">
      <div className="mizuhiki w-full" />
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-30 bg-seigaiha" />
      <div className="relative max-w-[1400px] mx-auto px-6 py-16 grid md:grid-cols-5 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl grid place-items-center" style={{ background: "linear-gradient(135deg, #ff7a8c 0%, #d72638 55%, #b81e2e 100%)" }}>
              <span className="absolute inset-0 rounded-xl ring-1 ring-[#f0c75e]/60" />
              <SakuraMark className="w-5 h-5 relative" />
            </div>
            <div>
              <div className="font-jp-serif text-white text-xl">AniMan</div>
              <div className="font-cinzel text-[9px] tracking-[0.32em] uppercase text-gold">Tinh hoa · 桜 · Việt Nhật</div>
            </div>
          </div>
          
         
        </div>
        {[
          { t: "Khám phá", l: ["Anime mới", "Phim Nhật bản quyền", "Manga thịnh hành", "Tiểu thuyết miễn phí"] },
          { t: "Sáng tạo", l: ["Manga AI Converter", "Animation Lab", "Novel Studio", "Hướng dẫn sáng tác"] },
          { t: "Cộng đồng", l: ["Quảng trường", "Live Watch Party", "Sự kiện", "Bảng xếp hạng"] },
        ].map((c) => (
          <div key={c.t}>
            <div className="text-white mb-3 font-jp-serif">{c.t}</div>
            <ul className="space-y-2 text-sm text-white/55 font-vn-sans">
              {c.l.map((x) => <li key={x} className="hover:text-[#f0c75e] cursor-pointer transition">{x}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="relative border-t border-white/5 py-5 text-center text-xs text-white/40 font-vn-sans">
        © 2026 AniMan. Mọi nội dung bản quyền thuộc về tác giả.
      </div>
    </footer>
  );
}
