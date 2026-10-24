import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type ActivityItem = {
  id: string;
  text: string;
  target: string;
  link: string;
  time: string;
};

/** Hoạt động thật: tác phẩm mới cập nhật + tác phẩm đã đăng. */
const ProfileActivity = ({ items }: { items: ActivityItem[] }) => {
  if (items.length === 0) {
    return (
      <div className="pb-16 text-center py-16">
        <p className="text-white/30 text-sm">Chưa có hoạt động nào.</p>
        <p className="text-white/20 text-xs mt-2">
          Viết, vẽ hoặc đăng tác phẩm — hoạt động sẽ hiện ở đây.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 pb-16">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition"
        >
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-sm">
              {item.text}{" "}
              <Link
                href={item.link}
                className="text-pink-300 hover:text-pink-200 transition"
              >
                {item.target}
              </Link>
            </p>
            <div className="text-white/30 text-xs mt-1">{item.time}</div>
          </div>
          <Link
            href={item.link}
            className="text-white/20 hover:text-white/60 transition shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ))}
    </div>
  );
};

export default ProfileActivity;
