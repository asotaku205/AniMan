import { findAnime } from '@/app/components/data/catalog';
import { notFound } from 'next/navigation';
import { AnimeDetailPage } from './AnimeDetail'

type PageProps = {
  params: Promise<{ animeName: string }>;
};
const  page = async({params}:PageProps) => {
  const {animeName} = await params
  const anime = findAnime(animeName)

  if (!anime) {
    notFound()
  }

  return (
    <AnimeDetailPage anime = {anime}/>
  )
}

export default page