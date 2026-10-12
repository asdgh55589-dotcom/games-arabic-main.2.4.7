'use client'

import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import { SiTelegram } from 'react-icons/si'
import { OverviewDemoBanner } from '@/components/admin/social/overview-demo-banner'
import { OverviewStatCard } from '@/components/admin/social/overview-stat-card'
import { TelegramDestinations } from '@/components/admin/social/telegram-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type SocialStatsRange, useSocialStats } from '@/hooks/use-social'
import { formatArNumber } from '@/lib/notifications/admin-labels'

// مخطط recharts يُحمَّل في العميل فقط (مطابق لنمط growth-chart).
const TelegramByDayChart = dynamic(
  () =>
    import('@/components/admin/social/telegram-stats').then((m) => ({
      default: m.TelegramByDayChart,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[380px] w-full rounded-xl" /> },
)

const RANGES: { value: SocialStatsRange; label: string }[] = [
  { value: '7d', label: '7 أيام' },
  { value: '30d', label: '30 يوماً' },
  { value: '90d', label: '90 يوماً' },
]

const QUICK_LINKS = [
  // روابط المنشورات/القوالب تُضاف مع هبوط مسارات W3 (لا روابط ميتة).
  {
    href: '/admin/notifications/history?channel=telegram',
    label: 'سجل إشعارات تيليجرام',
    icon: Bell,
  },
  { href: '/admin/templates?channel=telegram', label: 'قوالب الإشعارات', icon: FileText },
  { href: '/admin/scheduler', label: 'الجدولة', icon: Clock },
]

/** `/admin/social/telegram` — مركز منصة تيليجرام. */
export default function SocialTelegramPage() {
  const [range, setRange] = useState<SocialStatsRange>('30d')
  const { data, loading, isMock, refetch } = useSocialStats(range)

  const kpis = data?.kpis ?? { published: 0, failed: 0, scheduledUpcoming: 0, avgPerDay: 0 }
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? range

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#229ED9]/10 text-[#229ED9]">
            <SiTelegram className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-lg">تيليجرام</h1>
            <p className="text-[13px] text-muted-foreground">
              المنصة النشطة — منشورات وقوالب وإشعارات وقناة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border-light p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRange(r.value)}
                className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors ${
                  range === r.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            تحديث
          </Button>
        </div>
      </div>

      <OverviewDemoBanner show={isMock} />

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewStatCard
            label={`منشور (${rangeLabel})`}
            value={kpis.published}
            icon={CheckCircle2}
            tone="primary"
          />
          <OverviewStatCard
            label="مجدولة قادمة"
            value={kpis.scheduledUpcoming}
            icon={CalendarClock}
            tone="blue"
          />
          <OverviewStatCard label="فاشلة" value={kpis.failed} icon={XCircle} tone="red" />
          <OverviewStatCard
            label="المعدّل اليومي"
            value={kpis.avgPerDay}
            icon={TrendingUp}
            tone="green"
            fractionDigits={1}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {data ? (
            <TelegramByDayChart data={data} />
          ) : (
            <Skeleton className="h-[380px] w-full rounded-xl" />
          )}
        </div>
        {data ? (
          <TelegramDestinations data={data} />
        ) : (
          <Skeleton className="h-[380px] w-full rounded-xl" />
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-[14px]">روابط سريعة</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon
              return (
                <Button key={link.href} asChild variant="outline" size="sm">
                  <Link href={link.href}>
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </Link>
                </Button>
              )
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            إجمالي المنشورات في النطاق: {formatArNumber(kpis.published)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
