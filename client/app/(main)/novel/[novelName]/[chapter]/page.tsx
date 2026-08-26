import { findNovel } from "@/app/components/data/novels";
import { notFound } from "next/navigation";
import { NovelReaderPage } from "./NovelReader";

type PageProps = {
  params: Promise<{ novelName: string; chapter: string }>;
};

export default async function NovelChapterPage({ params }: PageProps) {
  const { novelName, chapter: chapterParam } = await params;
  const novel = findNovel(novelName);
  const chapterNum = Number.parseInt(chapterParam, 10) || 1;

  if (!novel) notFound();

  return <NovelReaderPage novel={novel} chapterNum={chapterNum} />;
}
