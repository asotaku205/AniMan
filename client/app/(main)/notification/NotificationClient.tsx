"use client";
import { useState } from "react";
import {
  Bell,
  Heart,
  MessageCircle,
  PlayCircle,
  Star,
  Users,
  Sparkles,

} from "lucide-react";
import {
  INIT_NOTIFICATIONS,
  NotifType,
} from "./data";
import NotifCard from "./components/NotifCard";
import Header from "./components/Header";
import SettingPanel from "./components/SettingPanel";
import FilterTab from "./components/FilterTab";

export function getTypeIcon(type: NotifType) {
  switch (type) {
    case "episode":
      return <PlayCircle className="w-3.5 h-3.5 text-pink-400" />;
    case "chapter":
      return <Star className="w-3.5 h-3.5 text-amber-400" />;
    case "reply":
      return <MessageCircle className="w-3.5 h-3.5 text-blue-400" />;
    case "like":
      return <Heart className="w-3.5 h-3.5 text-rose-400" />;
    case "follow":
      return <Users className="w-3.5 h-3.5 text-violet-400" />;
    case "event":
      return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    case "system":
      return <Bell className="w-3.5 h-3.5 text-white/50" />;
  }
}

export function getTypeBg(type: NotifType) {
  switch (type) {
    case "episode":
      return "bg-pink-500/15 border-pink-500/20";
    case "chapter":
      return "bg-amber-500/15 border-amber-500/20";
    case "reply":
      return "bg-blue-500/15 border-blue-500/20";
    case "like":
      return "bg-rose-500/15 border-rose-500/20";
    case "follow":
      return "bg-violet-500/15 border-violet-500/20";
    case "event":
      return "bg-amber-500/15 border-amber-500/20";
    case "system":
      return "bg-white/5 border-white/10";
  }
}
export default function NotificationPageClient() {
  const [notifications, setNotifications] = useState(INIT_NOTIFICATIONS);
  const [filter, setFilter] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "update") return ["episode", "chapter"].includes(n.type);
    if (filter === "social")
      return ["reply", "like", "follow", "event"].includes(n.type);
    if (filter === "system") return n.type === "system";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
  const markRead = (id: number) =>
    setNotifications((p) =>
      p.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  const deleteNotif = (id: number) =>
    setNotifications((p) => p.filter((n) => n.id !== id));

  return (
    <div className="min-h-screen bg-[#07040e] pt-8 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <Header
          unreadCount={unreadCount}
          markAllRead={markAllRead}
          setSettingsOpen={setSettingsOpen}
          settingsOpen={settingsOpen}
        />

        {/* Settings panel */}
        {settingsOpen && (
          <SettingPanel />
        )}

        {/* Filter tabs */}
        <FilterTab
          filter={filter}
          setFilter={setFilter}
          unreadCount={unreadCount}
        />

        {/* Today section */}
        {filtered.some((n) =>
          ["5 phút", "32 phút", "1 giờ", "2 giờ", "3 giờ"].includes(n.time),
        ) && (
          <div className="mb-3">
            <div className="text-xs text-white/30 uppercase tracking-widest mb-2 px-1">
              Hôm nay
            </div>
            <div className="space-y-2">
              {filtered
                .filter((n) =>
                  ["5 phút", "32 phút", "1 giờ", "2 giờ", "3 giờ"].includes(
                    n.time,
                  ),
                )
                .map((n) => (
                  <NotifCard
                    key={n.id}
                    n={n}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Older section */}
        {filtered.some(
          (n) =>
            !["5 phút", "32 phút", "1 giờ", "2 giờ", "3 giờ"].includes(n.time),
        ) && (
          <div className="mt-5">
            <div className="text-xs text-white/30 uppercase tracking-widest mb-2 px-1">
              Trước đó
            </div>
            <div className="space-y-2">
              {filtered
                .filter(
                  (n) =>
                    !["5 phút", "32 phút", "1 giờ", "2 giờ", "3 giờ"].includes(
                      n.time,
                    ),
                )
                .map((n) => (
                  <NotifCard
                    key={n.id}
                    n={n}
                    onRead={markRead}
                    onDelete={deleteNotif}
                  />
                ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/30 text-sm">Không có thông báo nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
