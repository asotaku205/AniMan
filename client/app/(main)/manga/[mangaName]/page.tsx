import { findManga } from '@/app/components/data/mangas';
import { MangaDetailPage } from './MangaDetail'
import { notFound } from 'next/navigation';

type PageProps={
    params: Promise<{mangaName:string}>;
}
const page = async({params}:PageProps) => {
    const {mangaName} = await params
    const manga = findManga(mangaName)
    if(!manga){
        notFound()
    }
  return (
    <MangaDetailPage manga ={manga}/>
  )
}

export default page