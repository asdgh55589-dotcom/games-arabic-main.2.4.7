'use client'

import { CalendarClock } from 'lucide-react'
import Link from 'next/link'
import { getAdminSocialPlatform } from '@/components/admin/social/platform-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SocialOverviewScheduledItem } from '@/hooks/use-social'
import { formatArDateTime } from '@/lib/notifications/admin-labels'

/** جدول «أقرب المنشورات المجدولة» في صفحة اللمحة. */
export function OverviewUpcomingPosts({ items }: { items: SocialOverviewScheduledItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          أقرب المنشورات المجدولة
        </CardTitle>
        <Link href="/admin/social/telegram/posts" className="text-xs text-primary hover:underline">
          عرض الكل
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            لا توجد منشورات مجدولة
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4 text-right">العنوان</TableHead>
                <TableHead className="text-right">الموعد</TableHead>
                <TableHead className="pe-4 text-right">المنصة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="ps-4">
                    <Link
                      href={`/admin/social/telegram/posts/${item.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {item.title || 'بدون عنوان'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatArDateTime(item.scheduledFor)}
                  </TableCell>
                  <TableCell className="pe-4 text-muted-foreground">
                    {getAdminSocialPlatform(item.platform)?.labelAr ?? item.platform}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
