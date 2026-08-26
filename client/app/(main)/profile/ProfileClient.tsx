"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { animeList, liveList } from "../../components/data/catalog";
import { Tab } from "./data";
import CoverPhoto from "./components/CoverPhoto";
import ProfileHeader from "./components/ProfileHeader";
import ProfileStats from "./components/ProfileStats";
import ProfileBadges from "./components/ProfileBadges";
import ProfileTab from "./components/ProfileTab";
import ProfileActivity from "./components/ProfileActivity";
import ProfileWatchList from "./components/ProfileWatchList";
import ProfileCollection from "./components/ProfileCollection";
import ProfileAbout from "./components/ProfileAbout";


export default function ProfilePageClient() {
  const params = useParams<{ username?: string }>();
  const username = params.username ?? "sakura_dreamer";
  const [tab, setTab] = useState<Tab>("activity");
  const [following, setFollowing] = useState(false);
  const [watchlistView, setWatchlistView] = useState<"grid" | "list">("grid");

  const isOwnProfile = username === "sakura_dreamer";

  // Merge some content for watchlist
  const watchlistItems = [
    ...animeList.slice(0, 3).map((a) => ({ ...a, mediaType: "Anime", link: `/anime/${a.slug}` })),
    ...liveList.slice(0, 2).map((l) => ({ ...l, mediaType: "Phim", link: `/film/${l.slug}` })),
  ];

  const collectionItems = [
    { name: "Yêu thích 2026", count: 23, color: "from-pink-500 to-rose-400", type: "Anime & Phim" },
    { name: "Manga đang đọc", count: 8, color: "from-violet-500 to-fuchsia-400", type: "Manga" },
    { name: "Tiểu thuyết chờ đọc", count: 15, color: "from-amber-500 to-orange-400", type: "Tiểu thuyết" },
    { name: "Đã xem xong", count: 47, color: "from-emerald-500 to-teal-400", type: "Mọi loại" },
  ];

  return (
    <div className="min-h-screen bg-[#07040e]">
      {/* Cover photo */}
      <CoverPhoto
        isOwnProfile={isOwnProfile}
      />

      {/* Profile header */}
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
       <ProfileHeader
          isOwnProfile={isOwnProfile}
          username={username}
          following={following}
          setFollowing={setFollowing}
        />

        {/* Stats strip */}
          <ProfileStats/>
        {/* Badges */}
        <ProfileBadges/>

        {/* Tabs */}
        <ProfileTab tab={tab} setTab={setTab} />

        {/* Tab content */}
        {tab === "activity" && (
          <ProfileActivity />
        )}

        {tab === "watchlist" && (
          <ProfileWatchList
            watchlistItems={watchlistItems}
            watchlistView={watchlistView}
            setWatchlistView={setWatchlistView}
          />
        )}

        {tab === "collections" && (
          <ProfileCollection
            collectionItems={collectionItems}
            isOwnProfile={isOwnProfile}
            animeList={animeList}
          />
        )}

        {tab === "about" && (
          <ProfileAbout/>
        )}
      </div>
    </div>
  );
}
