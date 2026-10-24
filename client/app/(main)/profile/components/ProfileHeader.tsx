import { Edit3, PenLine, Settings } from "lucide-react";
import Link from "next/link";
import React from "react";

type ProfileHeaderProps = {
  isOwnProfile: boolean;
  displayName: string;
  username: string;
  roleLabel: string;
  joinedLabel: string;
};

/**
 * Đầu hồ sơ với danh tính thật từ tài khoản (không còn tên giả,
 * không còn số người theo dõi hay nhãn Premium bịa).
 */
const ProfileHeader = ({
  isOwnProfile,
  displayName,
  username,
  roleLabel,
  joinedLabel,
}: ProfileHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-14 sm:-mt-16 mb-6 relative z-10">
      <div className="relative shrink-0">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-violet-500 via-pink-500 to-rose-400 ring-4 ring-[#07040e] overflow-hidden">
          <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
        </div>
        {isOwnProfile && (
          <Link
            href="/settings"
            aria-label="Cài đặt"
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#07040e] border border-white/20 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="flex-1 min-w-0 sm:pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1
              className="text-white text-xl sm:text-2xl truncate"
              style={{ fontFamily: "Shippori Mincho, serif" }}
            >
              {displayName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/40 text-sm">@{username}</span>
              <span className="px-2 py-0.5 rounded bg-pink-500/20 border border-pink-400/30 text-pink-300 text-[11px]">
                {roleLabel}
              </span>
            </div>
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <Link
                href="/my-works"
                className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-gradient-to-r from-sky-500 to-indigo-400 text-white text-sm transition shadow-[0_0_20px_rgba(56,189,248,0.3)]"
              >
                <PenLine className="w-3.5 h-3.5" /> Sáng tác của tôi
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-4 h-9 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm transition hover:bg-white/10"
              >
                <Settings className="w-3.5 h-3.5" /> Chỉnh sửa
              </Link>
            </div>
          )}
        </div>

        <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-xl">
          {joinedLabel}
        </p>
      </div>
    </div>
  );
};

export default ProfileHeader;
