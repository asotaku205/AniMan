"use client"
import Link from "next/link"
import { useState } from "react";
import { BookOpen, Star, Bookmark, Share2, Filter, ArrowDown, ArrowUp, Eye } from "lucide-react";
import { mangaList, findManga, Manga } from "../../../components/data/mangas";
import { ImageWithFallback } from "../../../components/ImageWithFallback";

export function MangaDetailPage({manga}:{manga: Manga}) {
  const m = manga;
  const [order, setOrder] = useState<"desc" | "asc">("desc");
  const chapters = order === "desc" ? m.chapters : [...m.chapters].reverse();
  const related = mangaList.filter((x) => x.slug !== m.slug && x.tags.some((t) => m.tags.includes(t))).slice(0, 4);

  return (
    <>
      {/* Banner */}
      <section className="relative h-[420px] overflow-hidden">
        <ImageWithFallback src={m.banner} alt={m.t} className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0612] via-[#0b0612]/70 to-[#0b0612]/30" />
        <div className="absolute bottom-0 inset-x-0">
          <div className="max-w-[1400px] mx-auto px-6 pb-10 grid md:grid-cols-[200px_1fr] gap-8 items-end">
            <div className="w-[200px] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 -mb-20">
              <ImageWithFallback src={m.cover} alt={m.t} className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="px-2 py-1 rounded bg-pink-500 text-white text-[10px] tracking-widest">MANGA</span>
                <span className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">{m.status}</span>
                {m.tags.slice(0, 4).map((t) => <span key={t} className="px-2 py-1 rounded bg-white/10 backdrop-blur border border-white/15 text-[10px] text-white/80">{t}</span>)}
              </div>
              <h1 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-4xl md:text-5xl leading-tight max-w-3xl">{m.t}</h1>
              <div className="mt-3 text-white/60 text-sm">
                Tác giả <span className="text-white">{m.author}</span> · {m.publisher} · {m.year} · <span className="inline-flex items-center gap-1 text-yellow-300"><Star className="w-3 h-3 fill-yellow-300" />{m.score}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0b0612] pt-28">
        <div className="max-w-[1400px] mx-auto px-6 grid lg:grid-cols-[1fr_320px] gap-10">
          <div>
            <p className="text-white/70 max-w-3xl leading-relaxed">{m.synopsis}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/manga/${m.slug}/1`} className="h-11 px-5 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white inline-flex items-center gap-2 hover:shadow-[0_0_20px_rgba(255,90,150,0.4)] transition"><BookOpen className="w-4 h-4" /> Đọc từ đầu</Link>
              <Link href={`/manga/${m.slug}/${m.chapters[0]?.n}`} className="h-11 px-5 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2 hover:bg-white/10 transition"><BookOpen className="w-4 h-4" /> Đọc mới nhất</Link>
              <button className="h-11 px-5 rounded-full bg-white/5 border border-white/15 text-white inline-flex items-center gap-2"><Bookmark className="w-4 h-4" /> Theo dõi</button>
              <button className="h-11 w-11 rounded-full bg-white/5 border border-white/15 text-white grid place-items-center"><Share2 className="w-4 h-4" /></button>
            </div>

            {/* Page preview reader */}
            <div id="read" className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase">Xem thử chương 1</div>
                <span className="text-xs text-white/50 flex items-center gap-1"><Eye className="w-3 h-3" /> 1.2M lượt đọc</span>
              </div>
              <div className="rounded-2xl bg-black p-4 border border-white/10">
                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {m.pagesPreview.map((p, i) => (
                    <div key={i} className="relative aspect-[3/4] bg-white rounded overflow-hidden">
                      <ImageWithFallback src={p} alt={`page ${i + 1}`} className="w-full h-full object-cover grayscale contrast-125" />
                      <div className="absolute inset-0 [background:repeating-linear-gradient(45deg,transparent_0_3px,rgba(0,0,0,0.18)_3px_4px)] mix-blend-multiply opacity-50" />
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black text-white text-[10px]">{i + 1}</div>
                    </div>
                  ))}
                </div>
                <div className="text-center mt-4">
                  <button className="h-10 px-5 rounded-full bg-white text-black text-sm">Đọc tiếp chương 2 →</button>
                </div>
              </div>
            </div>

            {/* Chapter list */}
            <div className="mt-12">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white text-lg" style={{ fontFamily: "Shippori Mincho, serif" }}>Danh sách chương</div>
                <button onClick={() => setOrder(order === "desc" ? "asc" : "desc")} className="h-9 px-3 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 inline-flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  {order === "desc" ? <>Mới nhất <ArrowDown className="w-3 h-3" /></> : <>Cũ nhất <ArrowUp className="w-3 h-3" /></>}
                </button>
              </div>
              <div className="rounded-2xl border border-white/10 divide-y divide-white/5 max-h-[600px] overflow-y-auto bg-white/[0.02]">
                {chapters.map((c) => (
                  <Link key={c.n} href={`/manga/${m.slug}/${c.n}`} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/5 text-left group transition">
                    <span className="w-12 text-pink-300 text-sm">#{c.n}</span>
                    <span className="flex-1 text-white text-sm truncate group-hover:text-pink-300 transition">{c.title}</span>
                    <span className="text-xs text-white/40">{c.pages} trang</span>
                    <span className="text-xs text-white/40 w-20 text-right">{c.date}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-white mb-3">Thông tin</div>
              <Info label="Tác giả" value={m.author} />
              {m.artist && <Info label="Họa sĩ" value={m.artist} />}
              <Info label="Nhà xuất bản" value={m.publisher} />
              <Info label="Trạng thái" value={m.status} />
              <Info label="Năm" value={String(m.year)} />
              <Info label="Số chương" value={String(m.chapters.length)} />
              <Info label="Đánh giá" value={`${m.score} / 10`} />
            </div>
            <div className="rounded-2xl border border-pink-400/30 bg-gradient-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-5">
              <div className="text-white">Đọc cùng bạn bè</div>
              <p className="text-white/60 text-sm mt-2">Tạo phòng đọc nhóm — đồng bộ trang, chat trực tiếp.</p>
              <button className="mt-3 px-4 h-9 rounded-full bg-white text-black text-sm">Tạo phòng</button>
            </div>
            <div>
              <div className="text-pink-300/80 tracking-[0.4em] text-xs uppercase mb-3">Manga tương tự</div>
              <div className="space-y-2">
                {related.map((r) => (
                  <Link key={r.slug} href={`/manga/${r.slug}`} className="flex gap-3 p-2 rounded-xl hover:bg-white/5">
                    <div className="w-12 h-16 rounded overflow-hidden">
                      <ImageWithFallback src={r.cover} alt={r.t} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-sm truncate">{r.t}</div>
                      <div className="text-xs text-white/50 mt-1">{r.author}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
      <div className="h-16" />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5 last:border-0 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white text-right max-w-[60%]">{value}</span>
    </div>
  );
}