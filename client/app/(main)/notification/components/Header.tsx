import { Check, Settings } from "lucide-react";
import React from "react";

const Header = ({ unreadCount, markAllRead, setSettingsOpen, settingsOpen }:{ unreadCount: number; markAllRead: () => void; setSettingsOpen: (open: boolean) => void; settingsOpen: boolean }) => {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1
          className="text-white text-2xl sm:text-3xl"
          style={{ fontFamily: "Shippori Mincho, serif" }}
        >
          Thông báo
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {unreadCount > 0
            ? `${unreadCount} thông báo chưa đọc`
            : "Tất cả đã được đọc"}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm hover:text-white hover:bg-white/10 transition"
          >
            <Check className="w-3.5 h-3.5" /> Đọc tất cả
          </button>
        )}
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={`p-2 rounded-full transition text-white/50 hover:text-white ${settingsOpen ? "bg-white/10" : "hover:bg-white/5"}`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Header;
