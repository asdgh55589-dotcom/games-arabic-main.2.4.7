import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getTierLabel } from '@/lib/tiers'
import { TierBadge } from '@/components/tier-badge'
import { CreatorBadge } from '@/components/creator-badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Trophy, Medal, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'لوحة صدارة الناشرين | Games Arabic',
  description: 'أفضل الناشرين حسب الموثوقية والتحميلات',
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Trophy className="h-6 w-6 text-yellow-500" />,
  2: <Medal className="h-6 w-6 text-gray-400" />,
  3: <Medal className="h-6 w-6 text-amber-600" />,
}

export default async function PublishersLeaderboard() {
  const publishers = await db.user.findMany({
    where: { role: { in: ['publisher', 'admin', 'manager', 'owner'] } },
    include: {
      mods: {
        where: { workflowStatus: 'PUBLISHED', isOriginalWork: false },
        select: { id: true, rating: true, ratingCount: true, downloads: true },
      },
    },
    orderBy: { tier: 'desc' },
    take: 50,
  })

  const ranked = publishers
    .map((user) => {
      const mods = user.mods
      const totalDownloads = mods.reduce((sum, m) => sum + (m.downloads || 0), 0)
      const rated = mods.filter((m) => m.ratingCount > 0)
      const avgRating = rated.length > 0 ? rated.reduce((s, m) => s + (m.rating || 0), 0) / rated.length : 0
      return { user, publishedCount: mods.length, totalDownloads, avgRating }
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
        <h1 className="text-3xl font-bold mb-2">📦 لوحة صدارة الناشرين</h1>
        <p className="text-muted-foreground">أفضل الناشرين حسب إعادة النشر والموثوقية</p>
      </div>

      {ranked.length === 0 ? (
        <EmptyState icon="users" title="لا يوجد ناشرون بعد" description="كن أول ناشر ينضم للمنصة!" action={{ label: 'كن معرّباً', href: '/become-creator' }} />
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
                    <CreatorBadge role={item.user.role} specialRoles={item.user.specialRoles} size="sm" />
                  </Link>
                  <div className="text-xs text-muted-foreground">{getTierLabel(item.user.role, item.user.tier)}</div>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <div className="font-bold">{item.publishedCount}</div>
                    <div className="text-xs text-muted-foreground">منشور</div>
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
