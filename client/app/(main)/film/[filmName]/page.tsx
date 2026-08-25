
import { findFilm } from '@/app/components/data/catalog';
import { FilmDetailPage } from './FilmDetail'
import { notFound } from 'next/navigation';
type PageProps = {
    params: Promise<{filmName:string}>
}
const page = async({params}:PageProps) => {
    const { filmName } = await params;
    const film = findFilm(filmName)
    if(!film ){
        notFound()
    }
  return (
    <FilmDetailPage film ={film}/>
  )
}

export default page