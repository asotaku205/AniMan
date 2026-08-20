import Link from "next/link";
import { ImageWithFallback } from "../../../components/ImageWithFallback";
import {Notification } from "../data";
import { getTypeBg, getTypeIcon } from "../NotificationClient";
import { Calendar, ChevronRight, Trash2 } from "lucide-react";

export default function NotifCard({
  n,
  onRead,
  onDelete,
}: {
  n: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      className={`relative group flex gap-3.5 p-4 rounded-2xl border transition cursor-pointer ${
        n.read
          ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
          : "bg-white/[0.06] border-white/10 hover:bg-white/[0.08]"
      }`}
      onClick={() => onRead(n.id)}
    >
      {/* Unread dot */}
      {!n.read && (
        <div className="absolute top-4 right-10 w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
      )}

      {/* Icon/Avatar */}
      <div className="shrink-0 mt-0.5 relative">
        {n.user ? (
          <>
            <div
              className={`w-10 h-10 rounded-full bg-gradient-to-br ${n.userColor} flex items-center justify-center text-white text-xs`}
            >
              {n.user.slice(0, 2).toUpperCase()}
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#07040e] flex items-center justify-center ${getTypeBg(n.type)}`}
            >
              {getTypeIcon(n.type)}
            </div>
          </>
        ) : n.img ? (
          <>
            <div className="w-10 h-10 rounded-xl overflow-hidden">
              <ImageWithFallback src={n.img} alt={n.title} className="w-full h-full object-cover" />
            </div>
            <div
              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#07040e] flex items-center justify-center ${getTypeBg(n.type)}`}
            >
              {getTypeIcon(n.type)}
            </div>
          </>
        ) : (
          <div
            className={`w-10 h-10 rounded-full border flex items-center justify-center ${getTypeBg(n.type)}`}
          >
            {getTypeIcon(n.type)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-snug ${n.read ? "text-white/70" : "text-white"}`}>
          {n.title}
        </div>
        <p className="text-white/40 text-xs mt-1 leading-relaxed line-clamp-2">{n.body}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-white/25 text-xs">
            <Calendar className="w-3 h-3" />
            {n.time} trước
          </span>
          {n.link && (
            <Link
              href={n.link}
              className="text-pink-400/70 text-xs hover:text-pink-300 transition flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              Xem <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(n.id);
        }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-rose-400 self-start"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
