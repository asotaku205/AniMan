import Link from "next/link";
import {
  Bell,
  Camera,
  ChevronRight,
  Trash2,
  Upload,
  ArrowLeftRight,
} from "lucide-react";
import type { AppNotification, AppNotifType } from "../lib/notifications";
import { relativeTime } from "../../my-works/lib/myWorks";

const TYPE_ICON: Record<AppNotifType, React.ReactNode> = {
  upload: <Upload className="w-3.5 h-3.5 text-pink-400" />,
  bridge: <ArrowLeftRight className="w-3.5 h-3.5 text-violet-400" />,
  snapshot: <Camera className="w-3.5 h-3.5 text-amber-400" />,
  system: <Bell className="w-3.5 h-3.5 text-white/50" />,
};

const TYPE_BG: Record<AppNotifType, string> = {
  upload: "bg-pink-500/15 border-pink-500/20",
  bridge: "bg-violet-500/15 border-violet-500/20",
  snapshot: "bg-amber-500/15 border-amber-500/20",
  system: "bg-white/5 border-white/10",
};

export default function NotifCard({
  n,
  onRead,
  onDelete,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
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
      {!n.read && (
        <div className="absolute top-4 right-10 w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
      )}
      <div
        className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${TYPE_BG[n.type]}`}
      >
        {TYPE_ICON[n.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm leading-snug ${n.read ? "text-white/70" : "text-white"}`}
        >
          {n.title}
        </div>
        <p className="text-white/40 text-xs mt-1 leading-relaxed line-clamp-2">
          {n.body}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-white/25 text-xs">
            {relativeTime(n.createdAt)}
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
