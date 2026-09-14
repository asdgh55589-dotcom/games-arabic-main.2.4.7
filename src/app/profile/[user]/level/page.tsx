import { History, TrendingUp, Trophy } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { TierProgress } from '@/components/tier-progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import type { UserRole } from '@/lib/roles'
import { calculateUserTier } from '@/lib/tier-engine'
import { getTierConfig, getTierLabel } from '@/lib/tiers'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user: string }>
}): Promise<Metadata> {
  const { user: username } = await params
  const user = await db.user.findFirst({
    where: { username: { equals: decodeURIComponent(username), mode: 'insensitive' } },
  })
  if (!user) return { title: 'مستخدم غير موجود | Games Arabic' }
  return {
    title: `مستوى ${user.username} | Games Arabic`,
    description: `تعرف على مستوى ${user.username} وتقدمه في المنصة`,
  }
}

export default async function LevelPage({ params }: { params: Promise<{ user: string }> }) {
  const { user: usernameParam } = await params
  const username = decodeURIComponent(usernameParam)
  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    include: {
      tierHistory: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })

  if (!user) notFound()

  const tierResult = await calculateUserTier(user.id)
  const currentConfig = getTierConfig(user.role, user.tier)
  const role = user.role as UserRole

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="text-4xl">📈</div>
        <div>
          <h1 className="text-2xl font-bold flex flex-wrap items-center gap-2">
            مستوى {user.username}
            <RoleBadge role={role} />
          </h1>
          <p className="text-muted-foreground">
            {currentConfig.label} — {currentConfig.description}
          </p>
        </div>
      </div>

      {/* Current Tier Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            المستوى الحالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <TierBadge role={role} tier={user.tier} size="lg" />
            <div className="text-sm text-muted-foreground">{currentConfig.description}</div>
          </div>
        </CardContent>
      </Card>

      {/* Progress to Next Tier */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            التقدم نحو المستوى التالي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TierProgress
            role={role}
            currentTier={user.tier}
            progress={tierResult.progress}
            nextRequirements={tierResult.nextTierRequirements}
          />
        </CardContent>
      </Card>

      {/* Tier History */}
      {user.tierHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              سجل الترقيات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.tierHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {entry.toTier > entry.fromTier ? (
                      <span className="text-green-500">⬆️</span>
                    ) : (
                      <span className="text-red-500">⬇️</span>
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        من {getTierLabel(role, entry.fromTier)} إلى{' '}
                        {getTierLabel(role, entry.toTier)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.reason === 'auto'
                          ? 'ترقية تلقائية'
                          : entry.reason === 'manual'
                            ? 'قرار إداري'
                            : entry.reason === 'admin'
                              ? 'إجراء إداري'
                              : entry.reason}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
