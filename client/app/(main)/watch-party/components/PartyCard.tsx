import Link from "next/link";
import type { MouseEvent } from "react";
import { Bell, Calendar, Globe, Heart, Lock, Play, Tv2, Users, Headphones, Sparkles } from "lucide-react";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import type { Party } from "../types";

type PartyCardProps = {
  party: Party;
  isFavorite: boolean;
  hasReminder: boolean;
  onFavorite: () => void;
  onReminder: () => void;
};

export default function PartyCard({
  party,
  isFavorite,
  hasReminder,
  onFavorite,
  onReminder,
}: PartyCardProps) {
  const live = party.status === "live";
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Link href={`/watch-party/${party.id}`} className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#0d0817] hover:border-pink-400/40 transition flex flex-col">
      <div className="relative aspect-video overflow-hidden">
        <ImageWithFallback
          src={party.cover}
          alt={party.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-black/40" />

        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {live ? (
            <span className="px-2 py-1 rounded bg-red-500 text-white text-[10px] tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="px-2 py-1 rounded bg-amber-500 text-white text-[10px] tracking-widest flex items-center gap-1">
              <Calendar className="w-3 h-3" /> SẮP TỚI
            </span>
          )}
          <span className="px-2 py-1 rounded bg-black/60 backdrop-blur text-white text-[10px] tracking-widest">{party.mediaType}</span>
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <button
            onClick={(e) => {
              stop(e);
              onFavorite();
            }}
            title={isFavorite ? "Bỏ yêu thích" : "Lưu yêu thích"}
            className={`w-7 h-7 rounded-full backdrop-blur grid place-items-center transition ${
              isFavorite ? "bg-pink-500 text-white" : "bg-black/60 text-white/80 hover:bg-pink-500/80"
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-white" : ""}`} />
          </button>

          {!live && (
            <button
              onClick={(e) => {
                stop(e);
                onReminder();
              }}
              title={hasReminder ? "Hủy nhắc lịch" : "Đặt nhắc"}
              className={`w-7 h-7 rounded-full backdrop-blur grid place-items-center transition ${
                hasReminder ? "bg-amber-400 text-[#0b0612]" : "bg-black/60 text-white/80 hover:bg-amber-400/80 hover:text-[#0b0612]"
              }`}
            >
              <Bell className={`w-3.5 h-3.5 ${hasReminder ? "fill-current" : ""}`} />
            </button>
          )}

          <span
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur grid place-items-center"
            title={party.visibility === "private" ? "Riêng tư" : "Công khai"}
          >
            {party.visibility === "private" ? <Lock className="w-3.5 h-3.5 text-white/80" /> : <Globe className="w-3.5 h-3.5 text-white/80" />}
          </span>
        </div>

        <div className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-pink-500 grid place-items-center opacity-0 group-hover:opacity-100 transition shadow-[0_0_24px_rgba(255,90,150,0.5)]">
          <Play className="w-5 h-5 fill-white" />
        </div>

        {live && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/70 backdrop-blur text-white text-[10px] flex items-center gap-1">
            <Users className="w-3 h-3 text-pink-300" /> {party.viewers}/{party.capacity}
          </div>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="text-sm text-white line-clamp-1">{party.title}</div>
        <div className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{party.media}</div>

        <div className="mt-3 flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full bg-linear-to-br ${party.hostAvatar} ring-1 ring-white/20`} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white/80 truncate">{party.host}</div>
            <div className="text-[10px] text-white/40">Chủ phòng</div>
          </div>
          {!live && party.startingIn && (
            <span className="text-[10px] text-amber-300 tabular-nums">{party.startingIn}</span>
          )}
        </div>

        {live && (
          <div className="mt-3">
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-linear-to-r from-pink-400 to-rose-400" style={{ width: `${(party.viewers / party.capacity) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {party.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
