import React from 'react'
import { NovelDetailPage } from './NovelDetail'
import { findNovel } from '@/app/components/data/novels'
import { notFound } from 'next/navigation'
type PageProps={
    params: Promise<{novelName:string}>
}
const page = async({params}:PageProps) => {
    const {novelName} = await params
    const novel = findNovel(novelName)
    if(!novel){
        notFound()
    }
  return (
    <NovelDetailPage novel = {novel}/>
  )
}

export default page