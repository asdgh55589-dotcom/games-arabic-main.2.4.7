import {
  BarChart3,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  MessageSquare,
  Plus,
  Star,
  ThumbsUp,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = {
  title: 'لوحة تحكم المُعَرِّب | Games Arabic',
  description: 'لوحة تحكم المُعَرِّب لإدارة التعريبات ومتابعة الأداء',
  robots: { index: false, follow: false },
}

export default async function CreatorDashboard() {
  const session = await getSession()
  if (!session) redirect('/login?next=/creator')

  const creatorRoles = ['creator', 'publisher']
  if (!creatorRoles.includes(session.role)) {
    redirect('/become-creator')
  }

  const fullUser = await db.user.findUnique({
    where: { id: session.id },
    select: { tier: true, specialRoles: true, avatarUrl: true, username: true, role: true },
  })

  const mods = await db.mod.findMany({
    where: { authorId: session.id },
    select: {
      id: true,
      name: true,
      slug: true,
      workflowStatus: true,
      views: true,
      downloads: true,
      endorsements: true,
      rating: true,
      ratingCount: true,
      comments: true,
      createdAt: true,
      isOriginalWork: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const published = mods.filter((m) => m.workflowStatus === 'PUBLISHED')
  const drafts = mods.filter((m) => m.workflowStatus === 'DRAFT')
  const pending = mods.filter((m) => m.workflowStatus === 'IN_REVIEW')
  const rejected = mods.filter((m) => m.workflowStatus === 'REJECTED')

  const totalViews = published.reduce((sum, m) => sum + (m.views || 0), 0)
  const totalDownloads = published.reduce((sum, m) => sum + (m.downloads || 0), 0)
  const totalEndorsements = published.reduce((sum, m) => sum + (m.endorsements || 0), 0)
  const totalComments = published.reduce((sum, m) => sum + (m.comments || 0), 0)

  const ratedMods = published.filter((m) => m.ratingCount > 0)
  const averageRating =
    ratedMods.length > 0
      ? ratedMods.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMods.length
      : 0

  const topMods = [...published].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5)

  const displayUser = {
    username: fullUser?.username || session.username,
    avatarUrl: fullUser?.avatarUrl || session.avatarUrl,
    role: fullUser?.role || session.role,
    tier: fullUser?.tier || 0,
    specialRoles: fullUser?.specialRoles || null,
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={displayUser.avatarUrl || undefined} />
            <AvatarFallback>{displayUser.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              مرحباً، {displayUser.username}! 👋
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <RoleBadge role={displayUser.role} size="sm" />
              <TierBadge role={displayUser.role} tier={displayUser.tier} size="sm" />
              <CreatorBadge
                role={displayUser.role}
                specialRoles={displayUser.specialRoles}
                size="sm"
              />
            </div>
          </div>
        </div>
        <Link href="/creator/mods/new">
          <Button size="lg" className="min-h-[44px]">
            <Plus className="h-4 w-4 ml-2" />
            تعريب جديد
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          icon={FileText}
          label="التعريبات"
          value={mods.length}
          sub={`${published.length} منشور`}
        />
        <StatCard icon={Eye} label="المشاهدات" value={totalViews} />
        <StatCard icon={Download} label="التحميلات" value={totalDownloads} />
        <StatCard icon={ThumbsUp} label="التأييدات" value={totalEndorsements} />
        <StatCard icon={MessageSquare} label="التعليقات" value={totalComments} />
        <StatCard
          icon={Star}
          label="التقييم"
          value={averageRating.toFixed(1)}
          sub={`من ${ratedMods.length}`}
        />
      </div>

      {/* Workflow status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <WorkflowCard
          label="منشور"
          count={published.length}
          icon={CheckCircle}
          color="text-green-500"
          href="/creator/mods?status=PUBLISHED"
        />
        <WorkflowCard
          label="مسودة"
          count={drafts.length}
          icon={FileText}
          color="text-gray-500"
          href="/creator/mods?status=DRAFT"
        />
        <WorkflowCard
          label="بانتظار المراجعة"
          count={pending.length}
          icon={Clock}
          color="text-yellow-500"
          href="/creator/mods?status=IN_REVIEW"
        />
        <WorkflowCard
          label="مرفوض"
          count={rejected.length}
          icon={XCircle}
          color="text-red-500"
          href="/creator/mods?status=REJECTED"
        />
      </div>

      {/* Tier & Performance Overview */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              مستواك الحالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <TierBadge role={displayUser.role} tier={displayUser.tier} size="md" />
              <div className="text-sm">
                <div className="font-bold">
                  {displayUser.role === 'creator'
                    ? 'مُعَرِّب'
                    : displayUser.role === 'publisher'
                      ? 'ناشر'
                      : displayUser.role}
                </div>
                <div className="text-xs text-muted-foreground">المستوى {displayUser.tier}</div>
              </div>
            </div>
            <Link
              href={`/profile/${encodeURIComponent(displayUser.username)}/level`}
              className="mt-3 inline-block text-xs text-primary hover:underline"
            >
              عرض التقدم ←
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              نظرة عامة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">متوسط التقييم</span>
                <span className="font-bold">{averageRating.toFixed(1)} ⭐</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">إجمالي التعليقات</span>
                <span className="font-bold">{totalComments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">نسبة النشر</span>
                <span className="font-bold">
                  {mods.length ? Math.round((published.length / mods.length) * 100) : 0}%
                </span>
              </div>
              <div className="pt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${mods.length ? (published.length / mods.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              النشاط الأخير
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد نشاط بعد</p>
            ) : (
              <div className="space-y-2">
                {mods.slice(0, 3).map((m) => (
                  <Link
                    key={m.id}
                    href={`/mod/${m.slug}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm"
                  >
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(m.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top mods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            أفضل تعريباتك أداءً
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topMods.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">لا توجد تعريبات منشورة بعد</p>
          ) : (
            <div className="space-y-3">
              {topMods.map((mod, index) => (
                <Link
                  key={mod.id}
                  href={`/mod/${mod.slug}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
                >
                  <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{mod.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      {mod.isOriginalWork === false ? (
                        <Badge variant="outline" className="text-amber-500 text-[10px] px-1.5 py-0">
                          من مصدر خارجي
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-500 text-[10px] px-1.5 py-0">
                          عمل أصلي
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="flex items-center gap-1">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      {(mod.downloads || 0).toLocaleString('ar-EG')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      {(mod.views || 0).toLocaleString('ar-EG')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <div className="text-2xl font-bold">
          {typeof value === 'number' ? value.toLocaleString('ar-EG') : value}
        </div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  )
}

function WorkflowCard({
  label,
  count,
  icon: Icon,
  color,
  href,
}: {
  label: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  color: string
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardContent className="pt-6 text-center">
          <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
          <div className="text-2xl font-bold">{count.toLocaleString('ar-EG')}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </Link>
  )
}
