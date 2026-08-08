'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Package,
  Layers,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  Loader2,
  Crown,
  Shield,
  Star,
  Award,
  History,
  User as UserIcon,
  Megaphone,
  MessageSquare,
  ThumbsUp,
  ScrollText,
  Newspaper,
  BarChart3,
  Flag,
} from 'lucide-react'
import type { SessionUser } from '@/lib/auth'

interface NavGroup {
  label: string
  items: NavItem[]
}

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  adminOnly?: boolean
  ownerOnly?: boolean
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [
      { href: '/admin', label: 'الرئيسية', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'إدارة المحتوى',
    items: [
      { href: '/admin/mods', label: 'التعريبات', icon: Package },
      { href: '/admin/series', label: 'السلاسل', icon: Layers },
      { href: '/admin/teams', label: 'فرق التعريب', icon: Users },
      { href: '/admin/ads', label: 'الإعلانات', icon: Megaphone },
      { href: '/admin/news', label: 'الأخبار', icon: Newspaper },
    ],
  },
  {
    label: 'إدارة المجتمع',
    items: [
      { href: '/admin/comments', label: 'التعليقات', icon: MessageSquare },
      { href: '/admin/endorsements', label: 'التأييدات', icon: ThumbsUp, adminOnly: true },
      { href: '/admin/reports', label: 'البلاغات', icon: Flag, adminOnly: true },
      { href: '/admin/users', label: 'المستخدمون', icon: Users, adminOnly: true },
      { href: '/admin/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: 'نظام المستويات',
    items: [
      { href: '/admin/tiers', label: 'المستويات', icon: Award, adminOnly: true },
      { href: '/admin/special-roles', label: 'الأدوار الخاصة', icon: Star, adminOnly: true },
      { href: '/admin/tier-history', label: 'سجل الترقيات', icon: History, adminOnly: true },
    ],
  },
  {
    label: 'النظام',
    items: [
      { href: '/admin/settings', label: 'الإعدادات', icon: Settings, ownerOnly: true },
      { href: '/admin/audit', label: 'سجل النشاطات', icon: ScrollText, ownerOnly: true },
    ],
  },
]

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner:     { label: 'مالك', icon: <Crown className="h-3 w-3" />, className: 'bg-amber-500 text-white' },
  admin:     { label: 'مدير', icon: <Shield className="h-3 w-3" />, className: 'bg-red-500 text-white' },
  moderator: { label: 'مشرف', icon: <Star className="h-3 w-3" />,  className: 'bg-purple-500 text-white' },
  member:    { label: 'عضو',  icon: <UserIcon className="h-3 w-3" />, className: 'bg-blue-500 text-white' },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    fetch('/api/auth/me', {
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return

        if (!data?.user || data.user.role === 'member') {
          router.replace('/admin/login')
        } else {
          setUser(data.user)
        }
      })
      .catch(() => {
        if (mounted) {
          router.replace('/admin/login')
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const onLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/admin/login')
    router.refresh()
  }

  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const roleBadge = ROLE_BADGE[user.role] || ROLE_BADGE.member

  const isItemVisible = (item: NavItem) => {
    if (item.ownerOnly && user.role !== 'owner') return false
    if (item.adminOnly && user.role !== 'admin' && user.role !== 'owner') return false
    return true
  }

  return (
    <div dir="rtl" className="min-h-screen overflow-hidden bg-[#09090b] text-foreground">
      <div className="flex min-h-screen">
        {/* ===== Sidebar ===== */}
        <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 border-l border-white/10 bg-[#0f1014]/95 backdrop-blur-xl lg:block">
          <div className="flex h-full flex-col">
            {/* الشعار */}
            <div className="border-b border-white/10 px-6 py-6">
              <Link href="/admin" className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight">
                  <span className="text-primary">GAMES</span>
                  <span className="text-foreground"> ARABIC</span>
                </span>
              </Link>

              <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary/80">
                  Operations Center
                </div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  إدارة المحتوى والمجتمع والإشراف من مكان واحد.
                </p>
              </div>
            </div>

            {/* المستخدم */}
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                {user.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="h-11 w-11 rounded-2xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-white">{user.username}</div>
                  <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold shadow-lg ${roleBadge.className}`}>
                    {roleBadge.icon}
                    {roleBadge.label}
                  </div>
                </div>
              </div>
            </div>

            {/* روابط التنقل */}
            <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              {NAV_GROUPS.map((group, gi) => {
                const visibleItems = group.items.filter(isItemVisible)
                if (visibleItems.length === 0) return null
                return (
                  <div key={gi}>
                    {group.label && (
                      <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.25em] text-white/35">
                        {group.label}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon
                        const isActive = item.exact
                          ? pathname === item.href
                          : pathname.startsWith(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                              className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                                isActive
                                  ? 'bg-gradient-to-l from-primary to-orange-400 text-black shadow-lg shadow-primary/20'
                                  : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                              }`}
                            >
                              {isActive && (
                                <div className="absolute inset-y-2 right-0 w-1 rounded-full bg-black/60" />
                              )}

                              <div className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                                isActive
                                  ? 'bg-black/10'
                                  : 'bg-white/[0.04] group-hover:bg-primary/10'
                              }`}>
                                <Icon className="h-4 w-4" />
                              </div>

                              {item.label}
                            </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>

            {/* أزرار سفلية */}
            <div className="space-y-2 border-t border-white/10 p-4">
              <Link
                href="/"
                target="_blank"
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/[0.04] hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                عرض الموقع
              </Link>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </aside>

        {/* ===== المحتوى الرئيسي ===== */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,180,70,0.08),transparent_22%),radial-gradient(circle_at_left,rgba(120,80,255,0.06),transparent_24%)]">
          <div className="mx-auto max-w-[1700px] px-5 py-6 lg:px-10 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
