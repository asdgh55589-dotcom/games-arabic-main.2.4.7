import { Medal, Star, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CreatorBadge } from '@/components/creator-badge'
import { TierBadge } from '@/components/tier-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { db } from '@/lib/db'
import { getTierLabel } from '@/lib/tiers'

export const metadata: Metadata = {
  title: 'لوحة صدارة المُعَرِّبين | Games Arabic',
  description: 'أفضل المُعَرِّبين في المنصة حسب المستوى والتقييم والتحميلات',
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Trophy className="h-6 w-6 text-yellow-500" />,
  2: <Medal className="h-6 w-6 text-gray-400" />,
  3: <Medal className="h-6 w-6 text-amber-600" />,
}

export default async function CreatorsLeaderboard() {
  const creators = await db.user.findMany({
    where: { role: { in: ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'] } },
    include: {
      mods: {
        where: { workflowStatus: 'PUBLISHED' },
        select: { id: true, rating: true, ratingCount: true, downloads: true },
      },
    },
    orderBy: { tier: 'desc' },
    take: 50,
  })

  const ranked = creators
    .map((user) => {
      const publishedMods = user.mods
      const totalDownloads = publishedMods.reduce((sum, m) => sum + (m.downloads || 0), 0)
      const ratedMods = publishedMods.filter((m) => m.ratingCount > 0)
      const avgRating =
        ratedMods.length > 0
          ? ratedMods.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMods.length
          : 0
      return { user, publishedCount: publishedMods.length, totalDownloads, avgRating }
    })
    .filter((c) => c.publishedCount > 0)
    .sort((a, b) => {
      if (b.user.tier !== a.user.tier) return b.user.tier - a.user.tier
      if (b.totalDownloads !== a.totalDownloads) return b.totalDownloads - a.totalDownloads
      return b.avgRating - a.avgRating
    })

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🏆 لوحة صدارة المُعَرِّبين</h1>
        <p className="text-muted-foreground">
          أفضل المُعَرِّبين في المنصة حسب المستوى والتحميلات والتقييم
        </p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState
          icon="users"
          title="لا يوجد مُعَرِّبون بعد"
          description="كن أول مُعَرِّب ينضم للمنصة!"
          action={{ label: 'كن معرّباً', href: '/become-creator/apply' }}
        />
      ) : (
        <div className="space-y-4">
          {ranked.map((item, index) => (
            <Card key={item.user.id} className={index < 3 ? 'border-yellow-500/50' : ''}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-12 text-center shrink-0">
                  {index < 3 ? (
                    RANK_ICONS[index + 1]
                  ) : (
                    <span className="text-xl font-bold text-muted-foreground">{index + 1}</span>
                  )}
                </div>

                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={item.user.avatarUrl || undefined} />
                  <AvatarFallback>{item.user.username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${encodeURIComponent(item.user.username)}`}
                    className="flex items-center gap-2 flex-wrap hover:underline"
                  >
                    <span className="font-medium truncate">{item.user.username}</span>
                    <TierBadge role={item.user.role} tier={item.user.tier} size="sm" />
                    <CreatorBadge
                      role={item.user.role}
                      specialRoles={item.user.specialRoles}
                      size="sm"
                    />
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {getTierLabel(item.user.role, item.user.tier)}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <div className="font-bold">{item.publishedCount}</div>
                    <div className="text-xs text-muted-foreground">تعريب</div>
                  </div>
                  <div className="text-center hidden sm:block">
                    <div className="font-bold">{item.totalDownloads.toLocaleString('ar-EG')}</div>
                    <div className="text-xs text-muted-foreground">تحميل</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      {item.avgRating.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">تقييم</div>
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
