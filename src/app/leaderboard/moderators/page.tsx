import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getTierLabel } from '@/lib/tiers'
import { TierBadge } from '@/components/tier-badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Trophy, Medal, Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'لوحة صدارة المشرفين | Games Arabic',
  description: 'أكثر المشرفين نشاطاً في المراجعة والإشراف',
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Trophy className="h-6 w-6 text-yellow-500" />,
  2: <Medal className="h-6 w-6 text-gray-400" />,
  3: <Medal className="h-6 w-6 text-amber-600" />,
}

export default async function ModeratorsLeaderboard() {
  const moderators = await db.user.findMany({
    where: { role: { in: ['moderator', 'admin', 'manager', 'owner'] } },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      role: true,
      tier: true,
      specialRoles: true,
      joinedAt: true,
      _count: { select: { workflowChanges: true } },
    },
    orderBy: { tier: 'desc' },
    take: 50,
  })

  const ranked = moderators
    .map((u) => ({
      user: u,
      reviewsCount: (u as unknown as { _count: { workflowChanges: number } })._count.workflowChanges,
      monthsActive: Math.floor((Date.now() - new Date(u.joinedAt).getTime()) / (1000 * 60 * 60 * 24 * 30)),
    }))
    .sort((a, b) => {
      if (b.user.tier !== a.user.tier) return b.user.tier - a.user.tier
      if (b.reviewsCount !== a.reviewsCount) return b.reviewsCount - a.reviewsCount
      return b.monthsActive - a.monthsActive
    })
    .filter((c) => c.reviewsCount > 0 || c.user.tier > 1)

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🛡️ لوحة صدارة المشرفين</h1>
        <p className="text-muted-foreground">أكثر المشرفين نشاطاً حسب المراجعات والخبرة</p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState icon="users" title="لا يوجد مشرفون بعد" description="كن أول مشرف ينضم للمنصة!" action={{ label: 'لوحة التحكم', href: '/admin' }} />
      ) : (
        <div className="space-y-4">
          {ranked.map((item, index) => (
            <Card key={item.user.id} className={index < 3 ? 'border-yellow-500/50' : ''}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-12 text-center shrink-0">{index < 3 ? RANK_ICONS[index + 1] : <span className="text-xl font-bold text-muted-foreground">{index + 1}</span>}</div>
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={item.user.avatarUrl || undefined} />
                  <AvatarFallback>{item.user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${encodeURIComponent(item.user.username)}`} className="flex items-center gap-2 flex-wrap hover:underline">
                    <span className="font-medium truncate">{item.user.username}</span>
                    <TierBadge role={item.user.role} tier={item.user.tier} size="sm" />
                  </Link>
                  <div className="text-xs text-muted-foreground">{getTierLabel(item.user.role, item.user.tier)}</div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <div className="font-bold flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3 text-purple-500" />
                      {item.reviewsCount}
                    </div>
                    <div className="text-xs text-muted-foreground">مراجعة</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="font-bold">{item.monthsActive}</div>
                    <div className="text-xs text-muted-foreground">شهر</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
