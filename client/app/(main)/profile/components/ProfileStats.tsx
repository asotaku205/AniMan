import React from 'react'
import { STATS } from '../data'

const ProfileStats = () => {
  return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition"
                >
                  <div className={`${s.color} opacity-80`}>{s.icon}</div>
                  <div>
                    <div className={`text-sm ${s.color}`}>{s.value}</div>
                    <div className="text-white/40 text-xs">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
    
  )
}

export default ProfileStats