import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { Edit3 } from 'lucide-react'
import React from 'react'

const CoverPhoto = ({ isOwnProfile }: { isOwnProfile: boolean }) => {
  return (
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1400"
          alt="cover"
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#07040e]" />
        {/* Sakura overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(255,90,150,0.4) 0%, transparent 60%), radial-gradient(ellipse at 80% 30%, rgba(150,50,255,0.3) 0%, transparent 50%)",
          }}
        />
        {isOwnProfile && (
          <button className="absolute top-4 right-4 flex items-center gap-1.5 px-3 h-8 rounded-full bg-black/50 backdrop-blur border border-white/20 text-white/80 text-sm hover:bg-black/70 transition">
            <Edit3 className="w-3.5 h-3.5" /> Sửa bìa
          </button>
        )}
      </div>
  )
}

export default CoverPhoto