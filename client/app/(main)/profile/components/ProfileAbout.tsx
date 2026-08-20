import React from 'react'

const ProfileAbout = () => {
  return (
    <div className="pb-16 max-w-lg">
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Thông tin cơ bản</div>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Tham gia từ", value: "Tháng 3, 2024" },
                    { label: "Vị trí", value: "Hà Nội, Việt Nam" },
                    { label: "Gói", value: "Premium" },
                    { label: "Ngôn ngữ", value: "Tiếng Việt, English" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <span className="text-white/40">{row.label}</span>
                      <span className="text-white/80">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Thể loại yêu thích</div>
                <div className="flex flex-wrap gap-2">
                  {["Slice of Life", "Romance", "Drama", "Mystery", "Psychological"].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-pink-500/10 border border-pink-400/20 text-pink-300 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Thành tích xem</div>
                <div className="space-y-3">
                  {[
                    { label: "Tổng số tập anime đã xem", value: "2.847 tập", pct: 75 },
                    { label: "Manga đã hoàn thành", value: "34 bộ", pct: 60 },
                    { label: "Tiểu thuyết đã đọc", value: "12 cuốn", pct: 40 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/50">{item.label}</span>
                        <span className="text-white/70">{item.value}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
  )
}

export default ProfileAbout