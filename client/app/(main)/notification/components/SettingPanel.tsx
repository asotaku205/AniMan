"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NOTIF_SETTINGS,
  loadNotifSettings,
  saveNotifSettings,
  type NotifSettings,
} from "../lib/notifications";

/**
 * Toggle loại thông báo được ghi — lưu bền localStorage. Tắt một loại
 * thì app không ghi thêm loại đó nữa (thông báo cũ vẫn còn cho đến
 * khi Sơn xoá tay).
 */
const ITEMS: { key: keyof NotifSettings; label: string }[] = [
  { key: "uploads", label: "Tác phẩm mới đăng" },
  { key: "bridges", label: "Dự án tạo từ cầu nối" },
  { key: "snapshots", label: "Snapshot tiểu thuyết" },
  { key: "system", label: "Thông báo hệ thống" },
];

export default function SettingPanel() {
  const [settings, setSettings] = useState<NotifSettings>(
    DEFAULT_NOTIF_SETTINGS,
  );

  useEffect(() => {
    setSettings(loadNotifSettings());
  }, []);

  const toggle = (key: keyof NotifSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifSettings(next);
      return next;
    });
  };

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-white mb-4">Cài đặt thông báo</div>
      <div className="space-y-3">
        {ITEMS.map((item) => {
          const on = settings[item.key];
          return (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-white/70 text-sm">{item.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={item.label}
                onClick={() => toggle(item.key)}
                className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${on ? "bg-pink-500" : "bg-white/20"}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
