import { findManga } from "@/app/components/data/mangas";
import { notFound } from "next/navigation";
import { MangaReaderPage } from "./MangaReader";


type PageProps = {
  params: Promise<{ mangaName: string; chapter: string }>;
};

export default async function MangaEpisodePage({ params }: PageProps) {
  const { mangaName, chapter: episodeParam } = await params;
  const manga = findManga(mangaName);
  const chapterNum = Number.parseInt(episodeParam, 10) || 1;

  if (!manga) notFound();

  return <MangaReaderPage manga={manga} chapterNum={chapterNum} />;
}
