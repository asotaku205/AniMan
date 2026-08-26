"use client"
import { useState } from "react";
import { Clock, Tv, Film, Sparkles, ChevronRight, Play, CalendarDays, Radio, Users, Plus, Zap } from "lucide-react";
import  Link  from "next/link";
import { weekSchedule, type ScheduleItem } from "./data/schedule";
import { ImageWithFallback } from "./ImageWithFallback";

function ScheduleCard({ item, isUpcoming, isAiring }: { item: ScheduleItem; isUpcoming?: boolean; isAiring?: boolean }) {
  const basePath = item.type === "anime" ? "/anime" : "/film";
  return (
    <Link
      href={`${basePath}/${item.slug}`}
      className={`group relative flex items-center gap-3 p-3 rounded-2xl border transition-all ${
        isAiring
          ? "border-red-400/50 bg-gradient-to-r from-red-500/15 to-pink-500/5 hover:from-red-500/25"
          : isUpcoming
          ? "border-pink-400/40 bg-gradient-to-r from-pink-500/10 to-fuchsia-500/5 hover:from-pink-500/20"
          : "border-white/8 bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0">
        <ImageWithFallback src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <Play className="w-4 h-4 fill-white text-white" />
        </div>
        {isAiring && (
          <div className="absolute top-1 left-1 flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)] animate-pulse" />
          </div>
        )}
        {isUpcoming && !isAiring && (
          <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_6px_rgba(255,90,150,0.8)] animate-pulse" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          {isAiring && (
            <span className="px-1.5 py-px rounded bg-red-500 text-white text-[9px] tracking-wider flex items-center gap-0.5">
              <Radio className="w-2.5 h-2.5" /> LIVE
            </span>
          )}
          {item.isNew && !isAiring && (
            <span className="px-1.5 py-px rounded bg-pink-500 text-white text-[9px] tracking-wider">MỚI</span>
          )}
          {item.isPremiere && (
            <span className="px-1.5 py-px rounded bg-gradient-to-r from-amber-400 to-orange-400 text-black text-[9px] tracking-wider">PREMIERE</span>
          )}
          <span className="text-white/40 text-[10px]">
            {item.type === "anime" ? (
              <span className="flex items-center gap-0.5"><Tv className="w-2.5 h-2.5" /> Tập {item.ep}/{item.totalEp}</span>
            ) : (
              <span className="flex items-center gap-0.5"><Film className="w-2.5 h-2.5" /> Phim</span>
            )}
          </span>
        </div>
        <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{item.title}</div>
        {item.studio && <div className="text-white/40 text-[10px] mt-0.5 truncate">{item.studio}</div>}
      </div>

      {/* Time */}
      <div className={`text-right shrink-0 ${isAiring ? "text-red-300" : isUpcoming ? "text-pink-300" : "text-white/50"}`}>
        <div className="flex items-center gap-1 text-xs justify-end">
          <Clock className="w-3 h-3" />
          {item.time}
        </div>
        {item.tags.slice(0, 1).map((t) => (
          <span key={t} className="text-[10px] text-white/30 block mt-0.5">{t}</span>
        ))}
      </div>
    </Link>
  );
}

export function DailySchedule() {
  const [activeDay, setActiveDay] = useState<string>(
    weekSchedule.find((d) => d.isToday)?.dayKey ?? weekSchedule[0].dayKey
  );

  const currentDay = weekSchedule.find((d) => d.dayKey === activeDay)!;
  const mockCurrentTime = "20:55";
  const isToday = currentDay.isToday;
  const airingNow = currentDay.items.find((item) => isToday && item.time <= mockCurrentTime && item.time >= "20:00");
  const todayItems = weekSchedule[2]?.items ?? [];

  // Watch Party mock data
  const LIVE_ROOMS = [
    {
      id: 1,
      title: "Tokyo Neon Chronicles — Tập 13",
      host: "tsuki_no_kage",
      hostColor: "from-violet-500 to-fuchsia-500",
      viewers: 47,
      maxViewers: 50,
      img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200",
      slug: "tokyo-neon-chronicles",
      ep: 13,
      isLive: true,
      tag: "Simulcast",
    },
    {
      id: 2,
      title: "Hoa Anh Đào Cuối Mùa — Rewatch S1",
      host: "AoiInk",
      hostColor: "from-pink-500 to-rose-400",
      viewers: 23,
      maxViewers: 30,
      img: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=200",
      slug: "hoa-anh-dao-cuoi-mua",
      ep: 1,
      isLive: true,
      tag: "Rewatch",
    },
  ];

  const SCHEDULED_ROOMS = [
    {
      id: 3,
      title: "Premiere Night — Tập 1 mới mùa Xuân 2026",
      host: "ShiroEdit",
      hostColor: "from-sky-500 to-cyan-400",
      scheduledTime: "21:00",
      img: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=200",
      registered: 124,
    },
    {
      id: 4,
      title: "Watch cùng Club Sakura mỗi tuần",
      host: "kyoto_dreamer",
      hostColor: "from-emerald-500 to-teal-400",
      scheduledTime: "22:30",
      img: "https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=200",
      registered: 67,
    },
  ];

  return (
    <section className="py-16 bg-[#090511]">
      <div className="max-w-[1400px] mx-auto px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-pink-300/80 tracking-[0.35em] text-xs uppercase mb-2">
              <CalendarDays className="w-3.5 h-3.5" />
              Lịch phát sóng
            </div>
            <h2 style={{ fontFamily: "Shippori Mincho, serif" }} className="text-white text-3xl md:text-4xl">
              Lịch chiếu <span className="bg-gradient-to-r from-pink-300 to-fuchsia-300 bg-clip-text text-transparent">hàng tuần</span>
            </h2>
            <p className="text-white/50 text-sm mt-2">Hoạt hình & phim bản quyền</p>
          </div>
          <Link href="/anime" className="text-pink-300/70 text-sm hover:text-pink-300 transition flex items-center gap-1">
            Xem toàn bộ <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Day tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {weekSchedule.map((day) => (
            <button
              key={day.dayKey}
              onClick={() => setActiveDay(day.dayKey)}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-2xl border transition-all min-w-[60px] ${
                activeDay === day.dayKey
                  ? "bg-gradient-to-b from-pink-500/30 to-fuchsia-500/10 border-pink-400/50 text-white shadow-[0_0_20px_rgba(255,90,150,0.2)]"
                  : "border-white/8 bg-white/[0.02] text-white/60 hover:text-white/90 hover:border-white/15"
              }`}
            >
              <span className="text-xs mb-1">{day.shortLabel}</span>
              <span className="text-[11px] opacity-60">{day.date}</span>
              {day.isToday && (
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-pink-400 shadow-[0_0_6px_rgba(255,90,150,0.8)]" />
              )}
            </button>
          ))}
        </div>

        {/* Content grid */}
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          {/* Main schedule list */}
          <div className="space-y-4">
            {/* ── Schedule cards ── */}
            <div className="space-y-2.5">
              {currentDay.items.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-10 text-center">
                  <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <div className="text-white/40">Không có lịch chiếu ngày này</div>
                </div>
              ) : (
                currentDay.items.map((item) => (
                  <ScheduleCard
                    key={item.id}
                    item={item}
                    isAiring={isToday && item === airingNow}
                    isUpcoming={isToday && item.time > mockCurrentTime}
                  />
                ))
              )}
            </div>

            {/* ── Watch Party section ── */}
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0d0817]">
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-pink-300" />
                  <span className="text-white text-sm" style={{ fontFamily: "Shippori Mincho, serif" }}>Xem Chung</span>
                  <span className="flex items-center gap-1 text-[11px] text-green-400 ml-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    {LIVE_ROOMS.length} Trực tiếp
                  </span>
                </div>
                <Link
                  href="/watch-party"
                  className="flex items-center gap-1 text-pink-300/70 text-xs hover:text-pink-300 transition"
                >
                  Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Live rooms */}
              <div className="divide-y divide-white/5">
                {LIVE_ROOMS.map((room) => (
                  <Link
                    key={room.id}
                    href="/watch-party"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-16 h-10 rounded-lg overflow-hidden shrink-0">
                      <img src={room.img} alt={room.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      {/* Live badge */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center">
                          <Radio className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs truncate group-hover:text-pink-300 transition">{room.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${room.hostColor} flex items-center justify-center text-white text-[8px] shrink-0`}>
                          {room.host.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-white/40 text-[11px] truncate">@{room.host}</span>
                        <span className="text-[10px] px-1.5 py-px rounded bg-white/5 text-white/30 shrink-0">{room.tag}</span>
                      </div>
                    </div>

                    {/* Viewers + join */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-white/50 text-xs justify-end">
                        <Users className="w-3 h-3" />
                        <span className="text-white/80">{room.viewers}</span>
                        <span className="text-white/30">/{room.maxViewers}</span>
                      </div>
                      {/* Capacity bar */}
                      <div className="mt-1.5 w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full"
                          style={{ width: `${(room.viewers / room.maxViewers) * 100}%` }}
                        />
                      </div>
                      <div className="mt-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-[9px] text-center">
                        LIVE
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Scheduled rooms */}
              <div className="border-t border-white/8 bg-white/[0.015]">
                <div className="px-5 pt-3.5 pb-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-white/30" />
                  <span className="text-white/40 text-xs uppercase tracking-wider">Sắp diễn ra </span>
                </div>
                <div className="divide-y divide-white/5">
                  {SCHEDULED_ROOMS.map((room) => (
                    <Link
                      key={room.id}
                      href="/watch-party"
                      className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition group"
                    >
                      <div className="w-10 h-7 rounded-lg overflow-hidden shrink-0 opacity-70 group-hover:opacity-100 transition">
                        <img src={room.img} alt={room.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white/70 text-xs truncate group-hover:text-white transition">{room.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${room.hostColor} shrink-0`} />
                          <span className="text-white/30 text-[10px]">@{room.host}</span>
                          <span className="text-white/25 text-[10px]">·</span>
                          <span className="text-white/30 text-[10px]">{room.registered} đăng ký</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1 text-pink-300 text-xs">
                          <Clock className="w-3 h-3" />
                          {room.scheduledTime}
                        </div>
                        <span className="text-[9px] px-1.5 py-px rounded bg-pink-500/15 text-pink-400/80">Đăng ký</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Create room CTA */}
              <div className="px-5 py-4 border-t border-white/8 bg-gradient-to-r from-pink-500/[0.08] to-fuchsia-500/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs">Tạo phòng Xem Chung</div>
                    <div className="text-white/40 text-[11px] mt-0.5">Mời bạn bè </div>
                  </div>
                  <Link
                    href="/watch-party"
                    className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white text-black text-xs shrink-0 hover:bg-pink-50 transition"
                  >
                    <Zap className="w-3 h-3" /> Tạo ngay
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* NOW AIRING */}
            {isToday && todayItems[3] && (
              <div className="rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/15 via-pink-500/5 to-transparent p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl" />
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="w-4 h-4 text-red-400" />
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                  <span className="text-white/80 text-xs tracking-widest uppercase">Đang chiếu trực tiếp</span>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-14 h-20 rounded-lg overflow-hidden shrink-0">
                    <ImageWithFallback src={todayItems[3]?.img ?? ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="text-white text-sm">{todayItems[3]?.title}</div>
                    <div className="text-pink-300 text-sm mt-1">Tập {todayItems[3]?.ep}</div>
                    <div className="text-white/50 text-xs mt-1">{todayItems[3]?.studio}</div>
                    <div className="text-red-300 text-xs mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {todayItems[3]?.time}
                    </div>
                    <Link
                      href={`/anime/${todayItems[3]?.slug}/${todayItems[3]?.ep}`}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 h-8 rounded-full bg-white text-black text-xs hover:bg-pink-100 transition"
                    >
                      <Play className="w-3 h-3 fill-black" /> Xem ngay
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming today */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="text-white/80 text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-pink-300" />
                {isToday ? "Sắp chiếu hôm nay" : `Lịch ${currentDay.label}`}
              </div>
              <div className="space-y-3">
                {currentDay.items.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={`/${item.type}/${item.slug}`}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden shrink-0">
                      <ImageWithFallback src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate group-hover:text-pink-300 transition">{item.title}</div>
                      <div className="text-white/40 text-xs mt-0.5">Tập {item.ep} · {item.time}</div>
                    </div>
                    <div className={`text-xs shrink-0 ${
                      isToday && item.time > mockCurrentTime ? "text-pink-300" : "text-white/30"
                    }`}>
                      {item.time}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Premiere this week */}
            <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
              <div className="text-amber-300/80 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Premiere tuần này
              </div>
              <div className="space-y-2">
                {weekSchedule
                  .flatMap((d) => d.items)
                  .filter((item) => item.isPremiere)
                  .slice(0, 3)
                  .map((item) => (
                    <Link
                      key={item.id}
                      href={`/${item.type}/${item.slug}`}
                      className="flex items-center gap-2 group"
                    >
                      <div className="w-8 h-11 rounded overflow-hidden shrink-0">
                        <ImageWithFallback src={item.img} alt={item.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white text-xs truncate group-hover:text-amber-300 transition">{item.title}</div>
                        <div className="text-white/40 text-[10px]">{item.type === "phim" ? "Phim" : `Tập ${item.ep}`}</div>
                      </div>
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 shrink-0">PREMIERE</span>
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}