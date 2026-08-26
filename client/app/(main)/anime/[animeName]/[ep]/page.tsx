import { findAnime } from "@/app/components/data/catalog";
import { notFound } from "next/navigation";
import { MediaPlayer } from "@/app/components/MediaPlayer";

type PageProps = {
  params: Promise<{ animeName: string; ep: string }>;
};

export default async function AnimeEpisodePage({ params }: PageProps) {
  const { animeName, ep: episodeParam } = await params;
  const anime = findAnime(animeName);
  const currentEp = Number.parseInt(episodeParam, 10) || 1;

  if (!anime) notFound();

  return <MediaPlayer content={anime} currentEp={currentEp} type="anime" basePath="anime" />;
}
