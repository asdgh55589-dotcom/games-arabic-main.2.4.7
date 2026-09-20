'use client'

import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  Crown,
  Database,
  ExternalLink,
  FileText,
  Flag,
  HardDrive,
  HeartPulse,
  History,
  Image as ImageIcon,
  Inbox,
  Key,
  Layers,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Package,
  PenTool,
  ScrollText,
  Search,
  Send,
  Settings,
  Shield,
  Star,
  ThumbsUp,
  Ticket,
  Trophy,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import NextImage from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { findPageForPath } from '@/lib/admin-pages'
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
    items: [{ href: '/admin', label: 'الرئيسية', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'إدارة المحتوى',
    items: [
      { href: '/admin/mods', label: 'التعريبات', icon: Package },
      { href: '/admin/sections', label: 'أقسام المنصات', icon: Layers },
      { href: '/admin/series', label: 'السلاسل', icon: Layers },
      { href: '/admin/teams', label: 'فرق التعريب', icon: Users },
      { href: '/admin/ads', label: 'الإعلانات', icon: Megaphone },
      { href: '/admin/news', label: 'الأخبار', icon: Newspaper },
      { href: '/admin/files', label: 'ملفات الرفع', icon: HardDrive },
      { href: '/admin/images/health', label: 'صحة الصور', icon: ImageIcon },
      { href: '/admin/docs', label: 'الدليل', icon: BookOpen },
    ],
  },
  {
    label: 'إدارة المجتمع',
    items: [
      { href: '/admin/comments', label: 'التعليقات', icon: MessageSquare },
      { href: '/admin/endorsements', label: 'التأييدات', icon: ThumbsUp, adminOnly: true },
      { href: '/admin/reports', label: 'البلاغات', icon: Flag, adminOnly: true },
      { href: '/admin/tickets', label: 'تذاكر الدعم', icon: Ticket },
      { href: '/admin/users', label: 'المستخدمون', icon: Users, adminOnly: true },
      { href: '/admin/admins', label: 'المسؤولون', icon: Shield, adminOnly: true },
      { href: '/admin/creators', label: 'المُعَرِّبون والناشرون', icon: PenTool, adminOnly: true },
      { href: '/admin/creators/requests', label: 'طلبات الترقية', icon: UserPlus, adminOnly: true },
      {
        href: '/admin/publication-requests',
        label: 'طلبات نشر التعريبات',
        icon: Inbox,
        adminOnly: true,
      },
      { href: '/admin/mod-requests', label: 'طلبات التعريب', icon: MessageSquare, adminOnly: true },
      { href: '/admin/analytics', label: 'التحليلات', icon: BarChart3, adminOnly: true },
    ],
  },
  {
    label: 'نظام المستويات',
    items: [
      { href: '/admin/tiers', label: 'المستويات', icon: Award, adminOnly: true },
      { href: '/admin/special-roles', label: 'الأدوار الخاصة', icon: Star, adminOnly: true },
      { href: '/admin/tier-history', label: 'سجل الترقيات', icon: History, adminOnly: true },
      { href: '/admin/rewards', label: 'لوحة المكافآت', icon: Trophy, adminOnly: true },
    ],
  },
  {
    label: 'النظام',
    items: [
      { href: '/admin/search', label: 'بحث متقدم', icon: Search, adminOnly: true },
      { href: '/admin/api-keys', label: 'مفاتيح API', icon: Key, adminOnly: true },
      { href: '/admin/templates', label: 'قوالب الإشعارات', icon: FileText, adminOnly: true },
      { href: '/admin/notifications/send', label: 'إرسال إشعار', icon: Send, adminOnly: true },
      {
        href: '/admin/notifications/analytics',
        label: 'تحليلات الإشعارات',
        icon: BarChart3,
        adminOnly: true,
      },
      {
        href: '/admin/notifications-health',
        label: 'صحة الإشعارات',
        icon: HeartPulse,
        adminOnly: true,
      },
      { href: '/admin/notifications/history', label: 'سجل الإشعارات', icon: Bell, adminOnly: true },
      { href: '/admin/sessions', label: 'الجلسات النشطة', icon: Shield, adminOnly: true },
      { href: '/admin/scheduler', label: 'الجدولة', icon: Clock, adminOnly: true },
      { href: '/admin/quotas', label: 'حصص الرفع', icon: HardDrive, adminOnly: true },
      {
        href: '/admin/download-settings',
        label: 'روابط التحميل الموثوقة',
        icon: Link2,
        adminOnly: true,
      },
      { href: '/admin/backup', label: 'النسخ الاحتياطي', icon: Database, ownerOnly: true },
      { href: '/admin/settings', label: 'الإعدادات', icon: Settings, ownerOnly: true },
      { href: '/admin/audit', label: 'سجل النشاطات', icon: ScrollText, ownerOnly: true },
    ],
  },
]

const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner: {
    label: 'مالك',
    icon: <Crown className="h-3 w-3" />,
    className: 'bg-amber-500 text-white',
  },
  admin: {
    label: 'مدير',
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-red-500 text-white',
  },
  moderator: {
    label: 'مشرف',
    icon: <Star className="h-3 w-3" />,
    className: 'bg-purple-500 text-white',
  },
  member: {
    label: 'عضو',
    icon: <UserIcon className="h-3 w-3" />,
    className: 'bg-blue-500 text-white',
  },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pendingCreatorCount, setPendingCreatorCount] = useState(0)
  const [pendingPublicationCount, setPendingPublicationCount] = useState(0)
  const [pendingModRequestsCount, setPendingModRequestsCount] = useState(0)
  // الصفحات المخصصة لهذا الإداري (null = النظام الافتراضي حسب الرتبة).
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null)

  useEffect(() => {
    let mounted = true
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    fetch('/api/auth/me', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((r) => {
        clearTimeout(timer)
        // لو الـ response مش JSON (مثلاً redirect HTML)، اعتبره غير مصرح
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error('Non-JSON response')
        return r.json()
      })
      .then((json) => {
        if (!mounted) return

        const user = json?.data?.user
        if (!user || user.role === 'member') {
          router.replace('/admin/login')
        } else {
          setUser(user)
        }
      })
      .catch(() => {
        clearTimeout(timer)
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
      clearTimeout(timer)
      controller.abort()
    }
  }, [router])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // الصفحات المخصصة للإداري الحالي (مرة واحدة بعد الدخول).
  useEffect(() => {
    if (!user || !['moderator', 'admin', 'manager', 'owner'].includes(user.role)) return
    let cancelled = false
    fetch('/api/admin/my-pages', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const pages = json?.data?.pages
        setAllowedPages(Array.isArray(pages) && pages.length > 0 ? pages : null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    // CRITICAL: Don't fetch if on login page
    if (pathname === '/admin/login') return
    // CRITICAL: Don't fetch if not authenticated
    if (!user) return
    // Don't fetch if user doesn't have admin role (moderator+)
    const adminRoles = ['moderator', 'admin', 'manager', 'owner']
    if (!adminRoles.includes(user.role)) return

    let cancelled = false
    const fetchPending = async () => {
      try {
        const [creatorRes, pubRes, modReqRes] = await Promise.all([
          fetch('/api/admin/creator-requests?status=pending', { cache: 'no-store' }),
          fetch('/api/admin/mods?workflowStatus=IN_REVIEW&limit=1', { cache: 'no-store' }),
          fetch('/api/admin/mod-requests?status=open&limit=1', { cache: 'no-store' }).catch(
            () => null as never,
          ),
        ])

        // CRITICAL: Handle 401 gracefully
        if (
          (creatorRes as Response).status === 401 ||
          (pubRes as Response).status === 401 ||
          (modReqRes as Response | null)?.status === 401
        ) {
          console.warn('[AdminLayout] Unauthorized - user may have logged out')
          return
        }

        if (creatorRes.ok) {
          const json = await creatorRes.json()
          const count =
            json.data?.requests?.length ?? (Array.isArray(json.data) ? json.data.length : 0)
          if (!cancelled) setPendingCreatorCount(count)
        }
        if (pubRes.ok) {
          const json = await pubRes.json()
          const count = json.pagination?.total ?? json.data?.length ?? 0
          if (!cancelled) setPendingPublicationCount(count)
        }
        if (modReqRes && (modReqRes as Response).ok) {
          const json = await (modReqRes as Response).json()
          const count = json.pagination?.total ?? json.data?.length ?? 0
          if (!cancelled) setPendingModRequestsCount(count)
        } else {
          // Fallback: try to fetch via direct mod-requests list
          try {
            const alt = await fetch('/api/mod-requests?status=open&limit=1', { cache: 'no-store' })
            if (alt.ok) {
              const j = await alt.json()
              const c = j.pagination?.total ?? j.data?.length ?? 0
              if (!cancelled) setPendingModRequestsCount(c)
            }
          } catch {
            // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort admin layout
          }
        }
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort admin layout
      }
    }
    fetchPending()
    const id = setInterval(fetchPending, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [user, pathname])

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
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const roleBadge = ROLE_BADGE[user.role] || ROLE_BADGE.member

  const isItemVisible = (item: NavItem) => {
    if (item.ownerOnly && user.role !== 'owner') return false
    if (item.adminOnly && !['admin', 'manager', 'owner'].includes(user.role)) return false
    // تخصيص الصفحات: المالك دائماً كامل، وغيره يُرشَّح حسب القائمة البيضاء.
    if (user.role !== 'owner' && allowedPages && allowedPages.length > 0) {
      const def = findPageForPath(item.href)
      if (!def) return true
      return allowedPages.includes(def.key)
    }
    return true
  }

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-light px-5">
        <NextImage src="/logo.png" alt="ألعاب عربية" width={28} height={28} className="h-7 w-auto object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(isItemVisible)
          if (visibleItems.length === 0) return null
          return (
            <div key={gi} className="mb-1">
              {group.label && (
                <div className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
                      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] min-h-[44px] transition-colors duration-150 ${
                        isActive
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-white/60 hover:bg-white/[0.04] hover:text-white/80'
                      }`}
                    >
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-primary' : 'opacity-50'}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.href === '/admin/creators/requests' && pendingCreatorCount > 0 && (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {pendingCreatorCount}
                        </span>
                      )}
                      {item.href === '/admin/publication-requests' &&
                        pendingPublicationCount > 0 && (
                          <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                            {pendingPublicationCount}
                          </span>
                        )}
                      {item.href === '/admin/mod-requests' && pendingModRequestsCount > 0 && (
                        <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {pendingModRequestsCount}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-border-light p-3">
        <div className="flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-white/[0.04]">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-xs font-bold text-white">
              {user.username.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{user.username}</div>
            <div className="text-[11px] text-muted-foreground">{roleBadge.label}</div>
          </div>
        </div>

        <div className="mt-1 space-y-0.5">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] min-h-[44px] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white/80"
          >
            <ExternalLink className="h-[18px] w-[18px] opacity-50" />
            عرض الموقع
          </Link>
          <button
            onClick={onLogout}
            aria-label="تسجيل الخروج"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] min-h-[44px] text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px] opacity-50" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* ===== Desktop Sidebar ===== */}
      <aside className="fixed right-0 top-0 z-50 hidden h-screen w-[252px] shrink-0 flex-col border-l border-border-light bg-sidebar lg:flex">
        {sidebarContent}
      </aside>

      {/* ===== Mobile Sidebar ===== */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-[252px] max-w-[85vw] shrink-0 flex-col border-l border-border-light bg-sidebar transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-border-light px-5">
          <NextImage src="/logo.png" alt="ألعاب عربية" width={28} height={28} className="h-7 w-auto object-contain" />
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] grid place-items-center text-muted-foreground hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* ===== Main Content ===== */}
      <div className="lg:mr-[252px]">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
              className="min-h-[44px] min-w-[44px] grid place-items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Link href="/admin" className="transition-colors hover:text-primary">
                الرئيسية
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground font-medium">
                {NAV_GROUPS.flatMap((g) => g.items).find((i) =>
                  i.exact ? pathname === i.href : pathname.startsWith(i.href),
                )?.label || 'لوحة التحكم'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              aria-label="بحث"
              className="min-h-[44px] min-w-[44px] grid place-items-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
            >
              <Search className="h-4.5 w-4.5" />
            </button>
            <button
              aria-label="الإشعارات"
              className="relative min-h-[44px] min-w-[44px] grid place-items-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main id="admin-main" tabIndex={-1} className="p-4 lg:p-6 outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
