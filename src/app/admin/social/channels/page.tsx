'use client'

import { Radio } from 'lucide-react'

/**
 * `/admin/social/channels` — قنوات السوشيال ميديا.
 * هيكل B0: سيُبنى في B2 مع بطاقات المنصات وأزرار الإدارة.
 */
export default function SocialChannelsPage() {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <Radio className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground text-lg">قنوات</h1>
          <p className="text-[13px] text-muted-foreground">كل منصات السوشيال المدعومة والقادمة</p>
        </div>
      </div>
    </div>
  )
}
