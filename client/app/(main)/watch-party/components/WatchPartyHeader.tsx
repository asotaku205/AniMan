import { Plus, Users } from "lucide-react";
import { PageHeader } from "../../../components/PageHeader";

type WatchPartyHeaderProps = {
  liveCount: number;
  totalViewers: number;
  onCreate: () => void;
};

export default function WatchPartyHeader({ liveCount, totalViewers, onCreate }: WatchPartyHeaderProps) {
  return (
    <PageHeader
      eyebrow="Watch Party"
      title="Tìm phòng xem cùng nhau"
    >
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 h-11 rounded-full bg-white/5 border border-white/10 backdrop-blur">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm text-white/80">{liveCount} phòng đang LIVE</span>
          <span className="w-px h-4 bg-white/15 mx-1 hidden sm:block" />
          <Users className="w-3.5 h-3.5 text-pink-300 hidden sm:block" />
          <span className="text-sm text-white/80 tabular-nums hidden sm:block">{totalViewers} người đang xem</span>
        </div>

        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-full bg-linear-to-r from-pink-500 to-rose-400 text-white text-sm shadow-[0_0_24px_rgba(255,90,150,0.4)] hover:from-pink-400 hover:to-rose-300 transition"
        >
          <Plus className="w-4 h-4" /> Tạo phòng mới
        </button>
      </div>
    </PageHeader>
  );
}
