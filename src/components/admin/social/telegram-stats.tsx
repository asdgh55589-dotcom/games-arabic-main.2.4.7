'use client'

import { Link2, Send, ShieldCheck } from 'lucide-react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartWrapper } from '@/components/admin/charts/chart-wrapper'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { SocialStatsData } from '@/hooks/use-social'
import { formatArNumber } from '@/lib/notifications/admin-labels'

const chartConfig = {
  published: { label: 'منشور', color: 'var(--primary)' },
  failed: { label: 'فاشل', color: 'hsl(0, 72%, 51%)' },
} satisfies ChartConfig

/**
 * مخطط النشر اليومي (تليجرام) — يُحمَّل ديناميكياً بلا SSR من صفحة المركز
 * ليتطابق مع نمط `growth-chart` في لوحة التحكم.
 */
export function TelegramByDayChart({ data }: { data: SocialStatsData }) {
  const points = data.timeSeries.map((p) => ({
    date: p.date,
    published: p.published,
    failed: p.failed,
  }))

  return (
    <ChartWrapper title="النشر اليومي" subtitle="المنشورات الناجحة والفاشلة لكل يوم">
      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} tickMargin={8} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="published"
            fill="var(--color-published)"
            fillOpacity={0.18}
            stroke="var(--color-published)"
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke="var(--color-failed)"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ChartContainer>
    </ChartWrapper>
  )
}

/** ملخّص الوجهات والإشعارات لتليجرام. */
export function TelegramDestinations({ data }: { data: SocialStatsData }) {
  const { destinations, notifications, templates } = data
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">الوجهات والإشعارات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-background-secondary py-3">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> الوجهات
            </div>
            <div className="mt-1 text-[18px] font-semibold text-foreground">
              {formatArNumber(destinations.total)}
            </div>
          </div>
          <div className="rounded-lg bg-background-secondary py-3">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Send className="h-3.5 w-3.5" /> نشطة
            </div>
            <div className="mt-1 text-[18px] font-semibold text-foreground">
              {formatArNumber(destinations.active)}
            </div>
          </div>
          <div className="rounded-lg bg-background-secondary py-3">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> موثّقة
            </div>
            <div className="mt-1 text-[18px] font-semibold text-foreground">
              {formatArNumber(destinations.verified)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-border-light text-[13px]">
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">إشعارات مرسلة</span>
            <span className="font-medium text-foreground">
              {formatArNumber(notifications.sent)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">إشعارات فاشلة</span>
            <span className="font-medium text-red">{formatArNumber(notifications.failed)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">قوالب (إشعار / منشور)</span>
            <span className="font-medium text-foreground">
              {formatArNumber(templates.notification)} / {formatArNumber(templates.post)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
