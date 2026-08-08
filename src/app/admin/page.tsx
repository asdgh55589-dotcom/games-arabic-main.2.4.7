'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Package,
  Users,
  Download,
  ThumbsUp,
  MessageSquare,
  Star,
  Flame,
  TrendingUp,
  Crown,
  Loader2,
  Plus,
  Layers,
  Megaphone,
  ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber, timeAgo } from '@/lib/format'
import { AdminDashboardSkeleton } from '@/components/admin/admin-dashboard-skeleton'

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

const ROLE_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  owner:     { label: 'مالك',  className: 'bg-amber-500 text-white',     icon: <Crown className="h-3 w-3" /> },
  admin:     { label: 'مدير',   className: 'bg-red-500 text-white',       icon: <Star className="h-3 w-3" /> },
  moderator: { label: 'مشرف',   className: 'bg-purple-500 text-white',    icon: <Star className="h-3 w-3" /> },
  member:    { label: 'عضو',    className: 'bg-blue-500 text-white',      icon: <Users className="h-3 w-3" /> },
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((d) => setData(d))
      .catch(() => setError('فشل تحميل بيانات الداشبورد'))
      .finally(() => setLoading(false))
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
    { label: 'التعريبات',     value: data.stats.mods,         icon: Package,       href: '/admin/mods',          color: 'text-primary' },
    { label: 'المستخدمون',    value: data.stats.users,        icon: Users,         href: '/admin/users',         color: 'text-blue-500' },
    { label: 'التحميلات',     value: data.stats.downloads,    icon: Download,      href: '/admin/mods',          color: 'text-green-500' },
    { label: 'التأييدات',     value: data.stats.endorsements, icon: ThumbsUp,      href: '/admin/endorsements',  color: 'text-amber-500' },
    { label: 'التعليقات',     value: data.stats.comments,     icon: MessageSquare, href: '/admin/comments',      color: 'text-purple-500' },
    { label: 'مميّزة',        value: data.stats.featured,     icon: Star,          href: '/admin/mods',          color: 'text-amber-400' },
    { label: 'رائجة',         value: data.stats.trending,     icon: Flame,         href: '/admin/mods',          color: 'text-orange-500' },
    { label: 'السلاسل',       value: data.stats.series,        icon: Layers,        href: '/admin/series',        color: 'text-cyan-500' },
  ]

  const quickActions = [
    { label: 'نشر تعريب', icon: Package, href: '/admin/mods/new', color: 'bg-primary hover:bg-primary/90' },
    { label: 'إضافة إعلان', icon: Megaphone, href: '/admin/ads', color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'إدارة التعليقات', icon: MessageSquare, href: '/admin/comments', color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'سجل النشاطات', icon: ScrollText, href: '/admin/audit', color: 'bg-zinc-700 hover:bg-zinc-600' },
  ]

  return (
      <div className="space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#111214]/90 p-8 shadow-2xl shadow-black/30 lg:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,180,70,0.14),transparent_30%),radial-gradient(circle_at_left,rgba(120,80,255,0.08),transparent_28%)]" />

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-primary/80">
              Operations Center
            </div>

            <h1 className="mt-6 text-4xl font-black leading-tight text-white lg:text-5xl">
              مركز إدارة GAMES ARABIC
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
              متابعة المحتوى والمجتمع والإشراف والتحليلات من لوحة تحكم موحدة وسريعة.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:min-w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-xs font-bold text-white/45">إجمالي التعريبات</div>
              <div className="mt-3 text-4xl font-black text-primary">
                {formatNumber(data.stats.mods)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-xs font-bold text-white/45">إجمالي المستخدمين</div>
              <div className="mt-3 text-4xl font-black text-cyan-400">
                {formatNumber(data.stats.users)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-xs font-bold text-white/45">التحميلات</div>
              <div className="mt-3 text-4xl font-black text-emerald-400">
                {formatNumber(data.stats.downloads)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
              <div className="text-xs font-bold text-white/45">التعليقات</div>
              <div className="mt-3 text-4xl font-black text-violet-400">
                {formatNumber(data.stats.comments)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* رأس الصفحة */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">نظرة تشغيلية مباشرة</h2>
          <p className="mt-2 text-sm leading-7 text-white/55">آخر النشاطات والمحتوى وحالة المجتمع داخل المنصة.</p>
        </div>

        <Button asChild className="h-12 rounded-2xl px-6 text-sm font-black shadow-lg shadow-primary/20">
          <Link href="/admin/mods/new">
            <Plus className="ml-2 h-4 w-4" />
            نشر تعريب جديد
          </Link>
        </Button>
      </div>

      {/* أزرار الإجراءات السريعة */}
      <div className="grid gap-4 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              href={action.href}
              className={`group relative overflow-hidden rounded-2xl px-5 py-5 text-sm font-bold text-white transition-all duration-300 ${action.color} shadow-xl shadow-black/20`}
            >
              <div className="absolute inset-0 bg-gradient-to-l from-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-black/15">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <div>{action.label}</div>
                  <div className="mt-1 text-xs font-medium text-white/70">
                    تنفيذ سريع
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group overflow-hidden rounded-[28px] border border-white/10 bg-[#121317]/90 p-5 transition-all duration-300 hover:border-primary/30 hover:bg-[#16181d]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold tracking-wide text-white/45">
                    {stat.label}
                  </div>

                  <div className="mt-4 text-4xl font-black text-white">
                    {formatNumber(stat.value)}
                  </div>

                  <div className="mt-2 text-xs text-white/40">
                    آخر تحديث مباشر
                  </div>
                </div>

                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04]">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Activity Center */}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-[#111214]/90 p-6">
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-primary/70">
                Activity Stream
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                آخر النشاطات التشغيلية
              </h2>
            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
              النظام مستقر
            </div>
          </div>

          <div className="space-y-4">
            {data.recent.mods.map((mod) => (
              <Link
                key={mod.id}
                href={`/admin/mods/${mod.id}/edit`}
                className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.05]"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-black text-white group-hover:text-primary">
                      {mod.name}
                    </h3>

                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-bold text-white/45">
                      {mod.game.platform}
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-white/55">
                    تم نشر تعريب جديد للعبة {mod.game.name}
                  </p>

                  <div className="mt-3 text-xs text-white/35">
                    {timeAgo(mod.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-[#111214]/90 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                آخر المستخدمين
              </h2>

              <Users className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-4">
              {data.recent.users.map((u) => {
                const role = ROLE_BADGE[u.role] || ROLE_BADGE.member

                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                  >
                    {u.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="h-11 w-11 rounded-2xl object-cover"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-white">
                        {u.username}
                      </div>

                      <div className="mt-1 text-xs text-white/40">
                        {timeAgo(u.joinedAt)}
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${role.className}`}>
                      {role.icon}
                      {role.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[#111214]/90 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-black text-white">
                آخر التعليقات
              </h2>

              <MessageSquare className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-4">
              {data.recent.comments.map((c) => (
                <Link
                  key={c.id}
                  href={`/?view=mod&slug=${c.mod.slug}`}
                  target="_blank"
                  className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:border-primary/30 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-black text-white">
                      {c.guestName}
                    </div>

                    <div className="text-[11px] text-white/35">
                      {timeAgo(c.createdAt)}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/55">
                    {c.text}
                  </p>

                  <div className="mt-4 text-xs font-semibold text-primary/85">
                    على {c.mod.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
