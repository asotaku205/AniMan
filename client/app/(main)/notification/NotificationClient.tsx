"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import NotifCard from "./components/NotifCard";
import Header from "./components/Header";
import SettingPanel from "./components/SettingPanel";
import FilterTab from "./components/FilterTab";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyNotificationsChanged,
  type AppNotification,
} from "./lib/notifications";

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function NotificationPageClient() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void listNotifications().then((all) => {
      if (alive) {
        setNotifications(all);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((p) => p.map((n) => ({ ...n, read: true })));
    notifyNotificationsChanged();
  };
  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((p) =>
      p.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    notifyNotificationsChanged();
  };
  const deleteNotif = async (id: string) => {
    await deleteNotification(id);
    setNotifications((p) => p.filter((n) => n.id !== id));
    notifyNotificationsChanged();
  };

  const today = filtered.filter((n) => isToday(n.createdAt));
  const older = filtered.filter((n) => !isToday(n.createdAt));

  return (
    <div className="min-h-screen bg-[#07040e] pt-8 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Header
          unreadCount={unreadCount}
          markAllRead={() => void markAllRead()}
          setSettingsOpen={setSettingsOpen}
          settingsOpen={settingsOpen}
        />

        {settingsOpen && <SettingPanel />}

        <FilterTab
          filter={filter}
          setFilter={setFilter}
          unreadCount={unreadCount}
        />

        {!loaded ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 h-24 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-white/30 uppercase tracking-widest mb-2 px-1">
                  Hôm nay
                </div>
                <div className="space-y-2">
                  {today.map((n) => (
                    <NotifCard
                      key={n.id}
                      n={n}
                      onRead={(id) => void markRead(id)}
                      onDelete={(id) => void deleteNotif(id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {older.length > 0 && (
              <div className="mt-5">
                <div className="text-xs text-white/30 uppercase tracking-widest mb-2 px-1">
                  Trước đó
                </div>
                <div className="space-y-2">
                  {older.map((n) => (
                    <NotifCard
                      key={n.id}
                      n={n}
                      onRead={(id) => void markRead(id)}
                      onDelete={(id) => void deleteNotif(id)}
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
                <p className="text-white/30 text-sm">
                  Không có thông báo nào
                </p>
                <p className="text-white/20 text-xs mt-2">
                  Thông báo sẽ xuất hiện khi Sơn đăng tác phẩm, tạo dự án
                  từ cầu nối hoặc chụp snapshot.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
