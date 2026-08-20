import React from 'react'
import { BADGES } from '../data'

const ProfileBadges = () => {
  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 [scrollbar-width:none]">
          {BADGES.map((b) => (
            <div
              key={b.label}
              title={b.label}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${b.color} bg-opacity-15 border border-white/10 shrink-0`}
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <span>{b.icon}</span>
              <span className="text-white/70 text-xs whitespace-nowrap">{b.label}</span>
            </div>
          ))}
        </div>
  )
}

export default ProfileBadges