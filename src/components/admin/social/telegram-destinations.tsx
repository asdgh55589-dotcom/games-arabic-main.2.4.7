'use client'

import { Link2, Send, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SocialStatsData } from '@/hooks/use-social'
import { formatArNumber } from '@/lib/notifications/admin-labels'

/**
 * Section 4 item 24: split from telegram-stats (which statically imports
 * recharts). This summary module is recharts-free so the hub page can import
 * it statically while the chart stays behind next/dynamic.
 */
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
