'use client'

import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Download,
  Flame,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  ScrollText,
  Star,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { AdminDashboardSkeleton } from '@/components/admin/admin-dashboard-skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, timeAgo } from '@/lib/format'

// Code-split recharts: these pull the full chart vendor chunk, loaded only
// when the dashboard mounts (same pattern as admin/analytics).
const GrowthChart = dynamic(
  () => import('@/components/admin/charts/growth-chart').then((m) => ({ default: m.GrowthChart })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const PlatformDonut = dynamic(
  () =>
    import('@/components/admin/charts/platform-donut').then((m) => ({ default: m.PlatformDonut })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)

interface DashboardData {
  stats: {
    games: number
    mods: number
    users: number
    downloads: number
    endorsements: number
    comments: number
    featured: number
    trending: number
    series: number
  }
  recent: {
    mods: Array<{
      id: string
      name: string
      slug: string
      createdAt: string
      game: { name: string; platform: string }
    }>
    users: Array<{
      id: string
      username: string
      avatarUrl: string | null
      role: string
      joinedAt: string
    }>
    comments: Array<{
      id: string
      text: string
      createdAt: string
      guestName: string
      mod: { name: string; slug: string }
    }>
  }
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  owner: { label: 'مالك', className: 'text-amber-400' },
  admin: { label: 'مدير', className: 'text-red-400' },
  moderator: { label: 'مشرف', className: 'text-purple-400' },
  member: { label: 'عضو', className: 'text-blue-400' },
}

const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  blue: { bg: 'bg-blue-lt', text: 'text-blue' },
  green: { bg: 'bg-green-lt', text: 'text-green' },
  yellow: { bg: 'bg-yellow-lt', text: 'text-yellow' },
  purple: { bg: 'bg-purple-lt', text: 'text-purple' },
  red: { bg: 'bg-red-lt', text: 'text-red' },
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [growthData, setGrowthData] = useState<any>(null)
  const [platformData, setPlatformData] = useState<any>(null)
  const [activeSessions, setActiveSessions] = useState<number>(0)
  const [audit, setAudit] = useState<
    Array<{ id: string; action: string; entity: string; username: string; createdAt: string }>
  >([])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    fetch('/api/admin/dashboard', { signal: controller.signal })
      .then((r) => {
        clearTimeout(timer)
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((d) => setData(d.data))
      .catch(() => {
        clearTimeout(timer)
        setError('فشل تحميل بيانات الداشبورد')
      })
      .finally(() => setLoading(false))
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    // charts + sessions + audit — non-blocking, fail silent
    fetch('/api/admin/analytics/growth?range=12')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setGrowthData(j.data)
      })
      .catch(() => {})
    fetch('/api/admin/analytics/platforms')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setPlatformData(j.data.platforms || j.data)
      })
      .catch(() => {})
    fetch('/api/admin/sessions?limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.stats) setActiveSessions(j.data.stats.totalActive || 0)
      })
      .catch(() => {})
    fetch('/api/admin/audit?limit=10')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const list = j?.data || j?.logs || []
        if (Array.isArray(list)) setAudit(list.slice(0, 10))
      })
      .catch(() => {})
  }, [])

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const statsCards = [
    {
      label: 'المستخدمون',
      value: data.stats.users,
      icon: Users,
      color: 'blue',
      href: '/admin/users',
    },
    {
      label: 'التعريبات',
      value: data.stats.mods,
      icon: Package,
      color: 'primary',
      href: '/admin/mods',
    },
    {
      label: 'التحميلات',
      value: data.stats.downloads,
      icon: Download,
      color: 'green',
      href: '/admin/mods',
    },
    {
      label: 'الجلسات النشطة',
      value: activeSessions,
      icon: TrendingUp,
      color: 'yellow',
      href: '/admin/sessions',
    },
  ]

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">لوحة التحكم</h1>
          <p className="text-[13px] text-muted-foreground">نظرة عامة على المنصة والنشاط الأخير</p>
        </div>
        <Button asChild size="sm" className="min-h-[44px]">
          <Link href="/admin/mods/new">
            <Plus className="h-3.5 w-3.5" />
            نشر تعريب
          </Link>
        </Button>
      </div>

      {/* Stat Cards — Gentelella pattern: icon + label + value */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          const colors = STAT_COLORS[stat.color]
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${colors.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                      {formatNumber(stat.value)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'إضافة مستخدم', icon: Users, href: '/admin/users' },
          { label: 'مراجعة تعريب', icon: Package, href: '/admin/mods' },
          { label: 'إرسال إشعار', icon: Megaphone, href: '/admin/notifications/send' },
          { label: 'نسخة احتياطية', icon: ScrollText, href: '/admin/backup' },
        ].map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 text-[13px] font-medium text-foreground transition-colors hover:bg-background-secondary"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {action.label}
            </Link>
          )
        })}
      </div>

      {/* Charts Row — إضافي احترافي */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GrowthChart data={growthData} />
        <PlatformDonut platforms={platformData} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Latest Mods */}
        <Card>
          <CardHeader>
            <CardTitle>آخر التعريبات</CardTitle>
            <div className="flex items-center gap-1.5 rounded-full bg-green-lt px-2.5 py-1 text-[11px] font-medium text-green">
              <span className="h-1.5 w-1.5 rounded-full bg-green" />
              نشط
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border-light">
              {data.recent.mods.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/admin/mods/${mod.id}/edit`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-background-secondary"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-lt text-primary">
                    <Package className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">
                        {mod.name}
                      </span>
                      <span className="shrink-0 rounded bg-background-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {mod.game.platform}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{mod.game.name}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {timeAgo(mod.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Recent Users */}
          <Card>
            <CardHeader>
              <CardTitle>آخر المستخدمين</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-light">
                {data.recent.users.map((u) => {
                  const role = ROLE_BADGE[u.role] || ROLE_BADGE.member
                  return (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
                          {u.username.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {u.username}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {timeAgo(u.joinedAt)}
                        </div>
                      </div>
                      <span className={`text-[11px] font-medium ${role.className}`}>
                        {role.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Comments */}
          <Card>
            <CardHeader>
              <CardTitle>آخر التعليقات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border-light">
                {data.recent.comments.map((c) => (
                  <Link
                    key={c.id}
                    href={`/mod/${c.mod.slug}`}
                    target="_blank"
                    className="block px-4 py-3 transition-colors hover:bg-background-secondary"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-foreground">{c.guestName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{c.text}</p>
                    <div className="mt-1.5 text-[11px] font-medium text-primary">
                      على {c.mod.name}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Audit Timeline — جديد */}
          {audit.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>آخر النشاطات</CardTitle>
                <Link href="/admin/audit" className="text-xs text-primary hover:underline">
                  عرض الكل
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border-light">
                  {audit.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-foreground truncate">
                          {a.username} — {a.action} {a.entity}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {timeAgo(a.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
