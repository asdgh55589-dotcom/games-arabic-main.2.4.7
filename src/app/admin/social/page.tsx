'use client'

import { Share2 } from 'lucide-react'

/**
 * `/admin/social` — لمحة مركز السوشيال ميديا.
 * هيكل B0: سيُوصَل ببيانات `/api/admin/social/overview` عبر `useSocialOverview`.
 */
export default function SocialOverviewPage() {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <Share2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-foreground text-lg">ادارة السوشيال ميديا</h1>
          <p className="text-[13px] text-muted-foreground">نظرة عامة على المنصات والمنشورات</p>
        </div>
      </div>
    </div>
  )
}
