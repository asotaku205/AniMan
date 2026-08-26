import { MediaPlayer } from "@/app/components/MediaPlayer";
import { findFilm } from "@/app/components/data/catalog";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ filmName: string; ep: string }>;
};

export default async function FilmWatchPage({ params }: PageProps) {
  const { filmName, ep: episodeParam } = await params;
  const film = findFilm(filmName);
  const currentEp = Number.parseInt(episodeParam, 10) || 1;

  if (!film) notFound();

  return <MediaPlayer content={film} currentEp={currentEp} type="film" basePath="film" />;
}
