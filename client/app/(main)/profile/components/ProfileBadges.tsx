import React from "react";

export type ProfileBadge = {
  icon: string;
  label: string;
  color: string;
  unlocked: boolean;
};

/** Huy hiệu tính từ dữ liệu thật — chưa đạt hiện mờ kèm "chưa đạt". */
const ProfileBadges = ({ badges }: { badges: ProfileBadge[] }) => {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 [scrollbar-width:none]">
      {badges.map((b) => (
        <div
          key={b.label}
          title={b.unlocked ? b.label : `${b.label} (chưa đạt)`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${b.color} bg-opacity-15 border border-white/10 shrink-0 ${b.unlocked ? "" : "opacity-40"}`}
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <span>{b.icon}</span>
          <span className="text-white/70 text-xs whitespace-nowrap">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ProfileBadges;
