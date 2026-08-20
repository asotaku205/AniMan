import { ACTIVITY_FEED } from '../data'
import { ImageWithFallback } from '@/app/components/ImageWithFallback'
import { ChevronRight, Heart, MessageCircle } from 'lucide-react'
import Link from 'next/link'

const ProfileActivity = () => {
  return (
     <div className="space-y-3 pb-16">
            {ACTIVITY_FEED.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition"
              >
                {item.img ? (
                  <div className="w-12 h-8 rounded-lg overflow-hidden shrink-0">
                    <ImageWithFallback src={item.img} alt={item.target} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-8 rounded-lg bg-white/5 shrink-0 flex items-center justify-center">
                    {item.type === "posted" && <MessageCircle className="w-4 h-4 text-blue-400" />}
                    {item.type === "liked" && <Heart className="w-4 h-4 text-rose-400" />}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm">
                    {item.text}{" "}
                    <Link href={item.link} className="text-pink-300 hover:text-pink-200 transition">
                      {item.target}
                    </Link>
                  </p>
                  <div className="text-white/30 text-xs mt-1">{item.time} trước</div>
                </div>
                <Link href={item.link} className="text-white/20 hover:text-white/60 transition shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
  )
}

export default ProfileActivity