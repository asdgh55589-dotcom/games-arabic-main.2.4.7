'use client'

import { Radio } from 'lucide-react'
import { ADMIN_SOCIAL_PLATFORMS, PlatformCard } from '@/components/admin/social/platform-card'

/** `/admin/social/channels` — كل منصات السوشيال المدمجة والقادمة. */
export default function SocialChannelsPage() {
  const activeCount = ADMIN_SOCIAL_PLATFORMS.filter((p) => p.status === 'active').length

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <Radio className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground text-lg">قنوات</h1>
          <p className="text-[13px] text-muted-foreground">
            كل منصات السوشيال المدعومة والقادمة — {activeCount} متاحة الآن
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_SOCIAL_PLATFORMS.map((platform) => (
          <PlatformCard key={platform.key} platform={platform} showManage />
        ))}
      </div>
    </div>
  )
}
