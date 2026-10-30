"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import CreateRoomModal from "./components/CreateRoomModal";
import PartyCard from "./components/PartyCard";
import WatchPartyFilterBar from "./components/WatchPartyFilterBar";
import WatchPartyHeader from "./components/WatchPartyHeader";
import type { Filter, Party } from "./types";

const PARTIES: Party[] = [
  { id: "p1", title: "Marathon Mưa rào tháng năm", media: "Cơn mưa rào tháng năm", mediaType: "Anime", host: "Hina_94", hostAvatar: "from-pink-500 to-rose-400", cover: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900", viewers: 142, capacity: 200, visibility: "public", status: "live", tags: ["Romance", "Slice of life", "Voice"] },
  { id: "p2", title: "Đêm anh đào · cùng xem & chat", media: "Mùa hoa anh đào", mediaType: "Phim", host: "RenAozora", hostAvatar: "from-violet-500 to-fuchsia-400", cover: "https://images.unsplash.com/photo-1554072675-66db59dba46f?w=900", viewers: 88, capacity: 150, visibility: "public", status: "live", tags: ["Romance", "Subtitle JP→VN"] },
  { id: "p3", title: "Phòng riêng: hội Aoi", media: "Chuyến tàu cuối", mediaType: "Anime", host: "Aoi", hostAvatar: "from-orange-500 to-pink-400", cover: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=900", viewers: 6, capacity: 10, visibility: "private", status: "live", tags: ["Bạn bè"] },
  { id: "p4", title: "Lo-fi vibes & shorts", media: "Tổng hợp clip lo-fi", mediaType: "Live", host: "kyoto_dreamer", hostAvatar: "from-sky-500 to-cyan-400", cover: "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=900", viewers: 312, capacity: 500, visibility: "public", status: "live", tags: ["Chill", "Music"] },
  { id: "p5", title: "Lời nhắn từ Aoi — premiere", media: "Lời nhắn từ Aoi", mediaType: "Anime", host: "SakuraStream Official", hostAvatar: "from-pink-500 to-fuchsia-400", cover: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900", viewers: 0, capacity: 1000, visibility: "public", status: "upcoming", startingIn: "trong 42 phút", tags: ["Premiere", "Official"] },
  { id: "p6", title: "Cuối tuần xem hết season 2", media: "Tokyo Neon", mediaType: "Anime", host: "ShiroNeko", hostAvatar: "from-emerald-500 to-teal-400", cover: "https://images.unsplash.com/photo-1554473675-d0904f3cbf38?w=900", viewers: 0, capacity: 50, visibility: "private", status: "upcoming", startingIn: "20:30 tối nay", tags: ["Marathon", "Action"] },
];

export default function WatchPartyPageClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setToast("Đã bỏ khỏi yêu thích");
      } else {
        next.add(id);
        setToast("Đã lưu vào yêu thích");
      }
      return next;
    });
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setToast("Đã hủy nhắc lịch");
      } else {
        next.add(id);
        setToast("Đã đặt nhắc, chúng tôi sẽ báo trước 5 phút");
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return PARTIES.filter((party) => {
      if (filter === "live" && party.status !== "live") return false;
      if (filter === "upcoming" && party.status !== "upcoming") return false;
      if (filter === "public" && party.visibility !== "public") return false;
      if (filter === "private" && party.visibility !== "private") return false;
      if (filter === "favorites" && !favorites.has(party.id)) return false;
      if (query && !`${party.title} ${party.media} ${party.host}`.toLowerCase().includes(query.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [filter, query, favorites]);

  const liveCount = PARTIES.filter((party) => party.status === "live").length;
  const totalViewers = PARTIES.reduce((sum, party) => sum + party.viewers, 0);

  return (
    <>
      <WatchPartyHeader liveCount={liveCount} totalViewers={totalViewers} onCreate={() => setShowCreate(true)} />

      <section className="relative bg-[#0b0612] py-8 md:py-12">
        <div className="max-w-350 mx-auto px-4 md:px-6">
          <WatchPartyFilterBar
            filter={filter}
            query={query}
            favoritesCount={favorites.size}
            setFilter={setFilter}
            setQuery={setQuery}
          />

          {filtered.length === 0 ? (
            <div className="text-center py-20 text-white/50">Không có phòng nào khớp.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filtered.map((party) => (
                <PartyCard
                  key={party.id}
                  party={party}
                  isFavorite={favorites.has(party.id)}
                  hasReminder={reminders.has(party.id)}
                  onFavorite={() => toggleFavorite(party.id)}
                  onReminder={() => toggleReminder(party.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-10 md:mt-12 rounded-3xl border border-pink-400/20 bg-linear-to-br from-pink-500/10 via-fuchsia-500/5 to-transparent p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <div className="text-[11px] tracking-[0.3em] text-pink-300/70">PHÒNG CỦA BẠN</div>
              <div className="mt-2 text-2xl text-white" style={{ fontFamily: "Shippori Mincho, serif" }}>Tự dựng phòng xem riêng</div>
              
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  { label: "Sync ms-precise", icon: "Tv2" },
                  { label: "Voice room", icon: "Headphones" },
                  { label: "Reaction timeline", icon: "Sparkles" },
                  { label: "Lên lịch trước", icon: "Calendar" },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                    {item.icon === "Tv2" ? "📺" : item.icon === "Headphones" ? "🎧" : item.icon === "Sparkles" ? "✨" : "📅"} {item.label}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-6 h-12 rounded-full bg-white text-[#0b0612] text-sm hover:bg-pink-100 transition justify-self-start md:justify-self-auto"
            >
              + Tạo phòng mới
            </button>
          </div>
        </div>
      </section>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(name) => {
            setShowCreate(false);
            setToast(`Đã tạo phòng "${name}"`);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2.5 rounded-full bg-[#1a0f2e] border border-pink-400/40 text-white text-sm shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-2">
          <Check className="w-4 h-4 text-pink-300" /> {toast}
        </div>
      )}
    </>
  );
}
