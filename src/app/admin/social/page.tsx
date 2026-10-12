'use client'

import { CalendarClock, CheckCircle2, Link2, Send, Share2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { OverviewDemoBanner } from '@/components/admin/social/overview-demo-banner'
import { OverviewRecentPublished } from '@/components/admin/social/overview-recent-published'
import { OverviewStatCard } from '@/components/admin/social/overview-stat-card'
import { OverviewUpcomingPosts } from '@/components/admin/social/overview-upcoming-posts'
import { ADMIN_SOCIAL_PLATFORMS, PlatformCard } from '@/components/admin/social/platform-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSocialOverview } from '@/hooks/use-social'

/** `/admin/social` — لمحة مركز السوشيال ميديا. */
export default function SocialOverviewPage() {
  const { data, loading, isMock, refetch } = useSocialOverview()

  if (loading && !data) {
    return (
      <div className="space-y-5" dir="rtl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const platformStats = new Map((data?.platforms ?? []).map((p) => [p.key, p]))
  const totals = data?.totals ?? { published30d: 0, scheduled: 0, failed: 0 }
  const destinations = (data?.platforms ?? []).reduce(
    (sum, p) => sum + (typeof p.destinations === 'number' ? p.destinations : 0),
    0,
  )

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-lg">ادارة السوشيال ميديا</h1>
            <p className="text-[13px] text-muted-foreground">
              نظرة عامة على المنصات والمنشورات المجدولة والمنشورة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refetch}>
            تحديث
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/social/channels">القنوات</Link>
          </Button>
        </div>
      </div>

      <OverviewDemoBanner show={isMock} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewStatCard
          label="منشورات (30 يوماً)"
          value={totals.published30d}
          icon={CheckCircle2}
          tone="primary"
        />
        <OverviewStatCard
          label="مجدولة"
          value={totals.scheduled}
          icon={CalendarClock}
          tone="blue"
        />
        <OverviewStatCard label="فاشلة" value={totals.failed} icon={XCircle} tone="red" />
        <OverviewStatCard
          label="الوجهات"
          value={destinations}
          icon={Link2}
          tone="green"
          hint="إجمالي وجهات تيليجرام"
        />
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-foreground text-[15px]">المنصات</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SOCIAL_PLATFORMS.map((platform) => (
            <PlatformCard
              key={platform.key}
              platform={platform}
              stats={platformStats.get(platform.key) ?? null}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <OverviewUpcomingPosts items={data?.nextScheduled ?? []} />
        <OverviewRecentPublished items={data?.recentPublished ?? []} />
      </div>

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Send className="h-3.5 w-3.5" />
        <span>تليجرام هي المنصة النشطة حالياً؛ فيسبوك ويوتيوب ضمن خارطة الطريق.</span>
      </div>
    </div>
  )
}
