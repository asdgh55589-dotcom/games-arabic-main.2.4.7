'use client'

import { ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import type { IconType } from 'react-icons'
import { SiFacebook, SiTelegram, SiYoutube } from 'react-icons/si'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SocialPlatformOverview } from '@/hooks/use-social'
import { formatArNumber } from '@/lib/notifications/admin-labels'

/**
 * بطاقة منصة السوشيال ميديا: الشعار + الاسم العربي + شارة الحالة + زر الإدارة.
 *
 * ملاحظة ملكية: سجل المنصات الرسمي هو `src/lib/social/platforms.ts` (W1/A0).
 * ما دام لم يهبط بعد، نُبقي هنا مرآة عرض صغيرة (نفس الحقول) لتفادي حجب الواجهة.
 * عند هبوطه يكفي استيراد `SOCIAL_PLATFORMS` بدل هذه المرآة — لا تغيير في المكوّن.
 */

export type SocialPlatformStatus = 'active' | 'coming_soon'

export interface SocialPlatformView {
  key: string
  labelAr: string
  status: SocialPlatformStatus | string
  href: string | null
  color: string
  capabilities: {
    posts: boolean
    templates: boolean
    notifications: boolean
    scheduling: boolean
  }
}

export const ADMIN_SOCIAL_PLATFORMS: readonly SocialPlatformView[] = [
  {
    key: 'telegram',
    labelAr: 'تليجرام',
    status: 'active',
    href: '/admin/social/telegram',
    color: '#229ED9',
    capabilities: { posts: true, templates: true, notifications: true, scheduling: true },
  },
  {
    key: 'facebook',
    labelAr: 'فيسبوك',
    status: 'coming_soon',
    href: null,
    color: '#1877F2',
    capabilities: { posts: false, templates: false, notifications: false, scheduling: false },
  },
  {
    key: 'youtube',
    labelAr: 'يوتيوب',
    status: 'coming_soon',
    href: null,
    color: '#FF0000',
    capabilities: { posts: false, templates: false, notifications: false, scheduling: false },
  },
]

const PLATFORM_ICONS: Record<string, IconType> = {
  telegram: SiTelegram,
  facebook: SiFacebook,
  youtube: SiYoutube,
}

export function getAdminSocialPlatform(key: string): SocialPlatformView | undefined {
  return ADMIN_SOCIAL_PLATFORMS.find((p) => p.key === key)
}

export function isPlatformActive(platform: SocialPlatformView): boolean {
  return platform.status === 'active' && !!platform.href
}

export function platformStatusLabel(status: string): string {
  return status === 'active' ? 'مفعّل' : 'قريباً'
}

interface PlatformCardProps {
  platform: SocialPlatformView
  /** عدّادات اللمحة (تُعرض عندما لا يكون الوضع إدارة). */
  stats?: SocialPlatformOverview | null
  /** وضع صفحة «القنوات»: يعرض زر الإدارة بدل العدّادات. */
  showManage?: boolean
}

export function PlatformCard({ platform, stats, showManage = false }: PlatformCardProps) {
  const Icon = PLATFORM_ICONS[platform.key]
  const active = isPlatformActive(platform)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${platform.color}1a`, color: platform.color }}
          >
            {Icon ? <Icon className="h-6 w-6" aria-hidden /> : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold text-foreground">
                {platform.labelAr}
              </span>
              {active ? (
                <Badge className="gap-1 bg-green-100 text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  مفعّل
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  قريباً
                </Badge>
              )}
            </div>

            {showManage ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {active ? 'منصة متاحة — إدارة المنشورات والقوالب' : 'قيد التطوير، ستتوفّر قريباً'}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[15px] font-semibold text-foreground">
                    {formatArNumber(stats?.posts.published30d ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">منشور 30ي</div>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-foreground">
                    {formatArNumber(stats?.posts.scheduled ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">مجدول</div>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-foreground">
                    {formatArNumber(stats?.posts.failed ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">فاشل</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showManage && (
          <div className="mt-4">
            {active && platform.href ? (
              <Button asChild size="sm" className="w-full">
                <Link href={platform.href}>
                  إدارة
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              // منصة قادمة: زر معطّل بلا رابط — لا روابط ميتة.
              <Button size="sm" variant="secondary" className="w-full" disabled>
                قريباً
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
