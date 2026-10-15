'use client'

import { CheckCircle2 } from 'lucide-react'
import { getAdminSocialPlatform } from '@/components/admin/social/platform-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SocialOverviewPublishedItem } from '@/hooks/use-social'
import { formatArDateTime } from '@/lib/notifications/admin-labels'

/** قائمة «آخر المنشورات المنشورة» في صفحة اللمحة.
 *  بلا روابط لصفحة المنشورات حتى تهبط مسارات W3 (لا روابط ميتة). */
export function OverviewRecentPublished({ items }: { items: SocialOverviewPublishedItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          آخر المنشورات
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            لا توجد منشورات منشورة بعد
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {item.title || 'بدون عنوان'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {getAdminSocialPlatform(item.platform)?.labelAr ?? item.platform}
                    {item.externalId ? ` • رسالة #${item.externalId}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {formatArDateTime(item.publishedAt)}
                  </span>
                  <Badge className="bg-green-100 text-green-700">منشور</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
