import React from "react";
import Link from "next/link";

type ProfileAboutProps = {
  displayName: string;
  username: string;
  roleLabel: string;
  joinedLabel: string;
  isOwnProfile: boolean;
};

/** Giới thiệu thật: thông tin tài khoản, không còn gói Premium bịa. */
const ProfileAbout = ({
  displayName,
  username,
  roleLabel,
  joinedLabel,
  isOwnProfile,
}: ProfileAboutProps) => {
  return (
    <div className="pb-16 max-w-lg">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">
            Thông tin cơ bản
          </div>
          <div className="space-y-3 text-sm">
            {[
              { label: "Tên hiển thị", value: displayName },
              { label: "Tên đăng nhập", value: `@${username}` },
              { label: "Vai trò", value: roleLabel },
              { label: "Tham gia", value: joinedLabel },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <span className="text-white/40">{row.label}</span>
                <span className="text-white/80 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2">
            <Link
              href="/my-works"
              className="flex-1 text-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-400 px-4 py-2.5 text-sm font-medium text-white"
            >
              Sáng tác của tôi
            </Link>
            <Link
              href="/settings"
              className="flex-1 text-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10"
            >
              Cài đặt
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileAbout;
