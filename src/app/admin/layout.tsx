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
  User as UserIcon,
  Megaphone,
  MessageSquare,
  ThumbsUp,
  ScrollText,
  Newspaper,
  BarChart3,
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
      { href: '/admin/users', label: 'المستخدمون', icon: Users, adminOnly: true },
      { href: '/admin/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },
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
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data?.user || data.user.role === 'member') {
          router.replace('/admin/login')
        } else {
          setUser(data.user)
        }
      })
      .catch(() => router.replace('/admin/login'))
      .finally(() => setLoading(false))
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
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-foreground">
      <div className="flex">
        {/* ===== Sidebar ===== */}
        <aside className="sticky top-0 h-screen w-64 shrink-0 border-l border-border bg-card/50 backdrop-blur">
          <div className="flex h-full flex-col">
            {/* الشعار */}
            <div className="border-b border-border p-4">
              <Link href="/admin" className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight">
                  <span className="text-primary">GAMES</span>
                  <span className="text-foreground"> ARABIC</span>
                </span>
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">لوحة التحكم</p>
            </div>

            {/* المستخدم */}
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-2">
                {user.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.username}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{user.username}</div>
                  <div className={`mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${roleBadge.className}`}>
                    {roleBadge.icon}
                    {roleBadge.label}
                  </div>
                </div>
              </div>
            </div>

            {/* روابط التنقل */}
            <nav className="flex-1 space-y-4 overflow-y-auto p-3">
              {NAV_GROUPS.map((group, gi) => {
                const visibleItems = group.items.filter(isItemVisible)
                if (visibleItems.length === 0) return null
                return (
                  <div key={gi}>
                    {group.label && (
                      <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {group.label}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        const Icon = item.icon
                        const isActive = item.exact
                          ? pathname === item.href
                          : pathname.startsWith(item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
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
            <div className="space-y-1 border-t border-border p-3">
              <Link
                href="/"
                target="_blank"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
                عرض الموقع
              </Link>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </aside>

        {/* ===== المحتوى الرئيسي ===== */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
