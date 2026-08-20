import React from "react";

const SettingPanel = () => {
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-white mb-4">Cài đặt thông báo</div>
      <div className="space-y-3">
        {[
          { label: "Tập mới phát hành", key: "episodes", on: true },
          { label: "Bình luận & trả lời", key: "comments", on: true },
          { label: "Lượt thích & đề cập", key: "likes", on: true },
          { label: "Người theo dõi mới", key: "follows", on: false },
          {
            label: "Sự kiện & thông báo hệ thống",
            key: "system",
            on: true,
          },
        ].map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <span className="text-white/70 text-sm">{item.label}</span>
            <div
              className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${item.on ? "bg-pink-500" : "bg-white/20"}`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.on ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettingPanel;
