'use client'

import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Menu, ChevronDown, Upload, LogIn, X, TrendingUp, Flame, Package, Users, LogOut, User, Settings, FileText, Activity, Bookmark, Trophy } from 'lucide-react'
import { PcIcon, NintendoSwitchIcon, PlayStationIcon, Xbox360Icon } from '@/components/platform-icons'
import { PLATFORM_COLORS, type PlatformKey } from '@/lib/constants/platforms'
import { getSectionIcon } from '@/lib/section-icons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { NotificationBell } from '@/components/notification-bell'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { useDebounced } from '@/hooks/use-debounced'
import { useAuth } from '@/contexts/auth-context'
import { useSettings } from '@/contexts/settings-context'
import type { SearchResponse } from '@/lib/types'

interface NavbarProps {
  games?: { slug: string; name: string; thumbnailUrl: string; modCount: number; platform: string }[]
  currentView?: string
}

interface SectionItem {
  id: string
  slug: string
  name: string
  nameEn: string
  key: string
  icon: string
  color: string
  order: number
}

// Fallback sections for when API hasn't loaded yet
const FALLBACK_SECTIONS: SectionItem[] = [
  { id: '1', slug: 'pc', name: 'PC ARABIC', nameEn: 'PC Arabic', key: 'PC', icon: 'PcIcon', color: PLATFORM_COLORS.pc, order: 1 },
  { id: '2', slug: 'xbox-360', name: 'XBOX 360 ARABIC', nameEn: 'Xbox 360 Arabic', key: 'X360', icon: 'Xbox360Icon', color: PLATFORM_COLORS.xbox360, order: 2 },
  { id: '3', slug: 'ns', name: 'NS ARABIC', nameEn: 'NS Arabic', key: 'NS', icon: 'NintendoSwitchIcon', color: PLATFORM_COLORS.switch, order: 3 },
  { id: '4', slug: 'ps4', name: 'PS4 ARABIC', nameEn: 'PS4 Arabic', key: 'PS4', icon: 'PlayStationIcon', color: PLATFORM_COLORS.ps4, order: 4 },
  { id: '5', slug: 'ps3', name: 'PS3 ARABIC', nameEn: 'PS3 Arabic', key: 'PS3', icon: 'PlayStationIcon', color: PLATFORM_COLORS.ps3, order: 5 },
  { id: '6', slug: 'ps2', name: 'PS2 ARABIC', nameEn: 'PS2 Arabic', key: 'PS2', icon: 'PlayStationIcon', color: PLATFORM_COLORS.ps2, order: 6 },
  { id: '7', slug: 'ps1', name: 'PS1 ARABIC', nameEn: 'PS1 Arabic', key: 'PS1', icon: 'PlayStationIcon', color: PLATFORM_COLORS.ps1, order: 7 },
  { id: '8', slug: 'ps5', name: 'PS5 ARABIC', nameEn: 'PS5 Arabic', key: 'PS5', icon: 'PlayStationIcon', color: PLATFORM_COLORS.ps5, order: 8 },
  { id: '9', slug: 'android', name: 'ANDROID ARABIC', nameEn: 'Android Arabic', key: 'ANDROID', icon: 'Smartphone', color: PLATFORM_COLORS.android, order: 9 },
]

export function Navbar({ games, currentView }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sections = FALLBACK_SECTIONS

  // Support both new routes (/platform/PC) and old SPA (?view=platform&platform=PC)
  const resolvedView = currentView || (() => {
    if (pathname === '/') return 'home'
    const segment = pathname.split('/')[1]
    if (segment) return segment
    return searchParams.get('view') || 'home'
  })()
  const resolvedPlatform = searchParams.get('platform') || (() => {
    const match = pathname.match(/^\/platform\/([^/]+)/)
    return match ? decodeURIComponent(match[1]) : null
  })()
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResponse>({ mods: [], games: [] })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)

  const { user: currentUser, logout } = useAuth()
  const { settings } = useSettings()
  const siteName = settings.site_name || 'GAMES ARABIC'

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedQ = useDebounced(q, 200)

  useEffect(() => {
    if (!debouncedQ.trim()) {
      Promise.resolve().then(() => {
        setSuggestions({ mods: [], games: [] })
        setActiveSuggestionIdx(-1)
      })
      return
    }
    const controller = new AbortController()
    let cancelled = false
    fetch(`/api/search?q=${encodeURIComponent(debouncedQ)}&limit=5`, {
      signal: controller.signal,
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data: SearchResponse } | null) => {
        if (!cancelled && json) {
          setSuggestions(json.data)
          setShowSuggestions(true)
          setActiveSuggestionIdx(-1)
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[navbar search] failed:', err)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedQ])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTypingTarget =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (e.key === '/' && !isTypingTarget && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && showSuggestions) {
        setShowSuggestions(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showSuggestions])

  const hasSuggestions = suggestions.mods.length > 0

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      const trimmed = q.trim()
      // Search tracking — fire-and-forget
      fetch('/api/search/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      }).catch(() => {})
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
      setShowSuggestions(false)
      setMobileOpen(false)
      inputRef.current?.blur()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasSuggestions) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIdx((i) => Math.min(i + 1, suggestions.mods.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeSuggestionIdx >= 0) {
      e.preventDefault()
      const selected = suggestions.mods[activeSuggestionIdx]
      if (selected) {
        router.push(`/mod/${selected.slug}`)
        setShowSuggestions(false)
        setQ('')
        inputRef.current?.blur()
      }
    }
  }

  const clearSuggestions = useCallback(() => {
    setShowSuggestions(false)
    setQ('')
  }, [])

  // الشريط العلوي — موسّع، اللوجو على اليسار
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/75 backdrop-blur-md" dir="ltr">
      <div className="flex h-11 max-w-[1700px] items-center gap-2 px-3">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden min-h-[44px] min-w-[44px]" aria-label="القائمة">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[360px]">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <span className="text-xl font-bold tracking-tight">
                    <span className="text-primary">{siteName.split(' ')[0] || 'GAMES'}</span>
                    <span className="text-foreground"> {siteName.split(' ').slice(1).join(' ') || 'ARABIC'}</span>
                  </span>
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {sections.map((s) => {
                const Icon = getSectionIcon(s.icon)
                return (
                  <MobileLink key={s.id} href={`/platform/${s.key}`} onClick={() => setMobileOpen(false)} isActive={resolvedView === 'platform' && resolvedPlatform === s.key}>
                    {s.name} <Icon width={14} height={14} color={s.color} className="inline-block align-middle ms-1" />
                  </MobileLink>
                )
              })}

              {/* Vertical divider */}
              <div className="mx-4 my-1 h-px bg-border/60" />

              <MobileLink href="/series" onClick={() => setMobileOpen(false)} isActive={resolvedView === 'series' || resolvedView === 'series-detail'}>
                <Package width={16} height={16} style={{ color: 'var(--gold)' }} className="inline-block align-middle me-1" />
                السلاسل
              </MobileLink>

              <MobileLink href="/teams" onClick={() => setMobileOpen(false)} isActive={resolvedView === 'teams' || resolvedView === 'team-detail'}>
                <Users width={16} height={16} style={{ color: 'var(--gold)' }} className="inline-block align-middle me-1" />
                الفرق
              </MobileLink>

              <MobileLink href="/request" onClick={() => setMobileOpen(false)} isActive={pathname === '/request'}>
                <span className="text-base">📝</span> طلب تعريب
              </MobileLink>

              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex items-center justify-end px-3">
          <NotificationBell currentUser={currentUser} />
                </div>
                {currentUser ? (
                  <>
                    <Button asChild variant="ghost" className="w-full">
                      <Link href={`/profile/${encodeURIComponent(currentUser.username)}`} onClick={() => setMobileOpen(false)}>
                        <User className="mr-2 h-4 w-4" /> {currentUser.username}
                      </Link>
                    </Button>
                    {['creator', 'publisher'].includes(currentUser.role) && (
                      <Button asChild variant="ghost" className="w-full justify-start text-muted-foreground text-sm font-normal">
                        <Link href="/creator" onClick={() => setMobileOpen(false)}>
                          لوحة التحكم
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="w-full text-destructive"
                      onClick={async () => {
                        await logout()
                        setMobileOpen(false)
                        window.location.href = '/'
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> تسجيل الخروج
                    </Button>
                  </>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/login" onClick={() => setMobileOpen(false)}>
                      <LogIn className="mr-2 h-4 w-4" /> تسجيل الدخول
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Left group: Logo + Desktop nav — يبقى على اليسار مع بعض */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Logo — English, على اليسار */}
          <Link href="/" className="flex shrink-0 items-center gap-1" aria-label="Games Arabic home">
            <span className="text-xl font-extrabold tracking-tight">
              <span className="text-gradient">{siteName.split(' ')[0] || 'GAMES'}</span>
              <span className="text-foreground"> {siteName.split(' ').slice(1).join(' ') || 'ARABIC'}</span>
            </span>
          </Link>

          {/* Desktop nav — الأقسام الديناميكية */}
          <nav className="hidden items-center gap-0 lg:flex" aria-label="Main">
          {sections.map((s) => {
            const isActive = resolvedView === 'platform' && resolvedPlatform === s.key
            const Icon = getSectionIcon(s.icon)
            return (
              <Link
                key={s.id}
                href={`/platform/${s.key}`}
                className={`whitespace-nowrap rounded-none px-1.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
                  isActive
                    ? 'bg-white/10 text-gray-200'
                    : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
                }`}
              >
                {s.name} <Icon width={12} height={12} color={s.color} className="inline-block align-middle ms-0.5" />
              </Link>
            )
          })}

          {/* Vertical divider */}
          <div className="mx-0.5 h-4 w-px bg-border/60" />

          <Link
            href="/series"
            className={`flex items-center gap-1 whitespace-nowrap rounded-none px-1.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
              resolvedView === 'series' || resolvedView === 'series-detail'
                ? 'bg-white/10 text-gray-200'
                : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <Package width={12} height={12} style={{ color: 'var(--gold)' }} className="inline-block align-middle" />
            السلاسل
          </Link>
          <Link
            href="/teams"
            className={`flex items-center gap-1 whitespace-nowrap rounded-none px-1.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
              resolvedView === 'teams' || resolvedView === 'team-detail'
                ? 'bg-white/10 text-gray-200'
                : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <Users width={12} height={12} style={{ color: 'var(--gold)' }} className="inline-block align-middle" />
            الفرق
          </Link>
          <Link
            href="/request"
            className={`flex items-center gap-1 whitespace-nowrap rounded-none px-1.5 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${
              pathname === '/request' ? 'bg-white/10 text-gray-200' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
          >
            <span className="text-[11px]">📝</span> طلب تعريب
          </Link>
        </nav>
        </div>

        {/* Smart Search — يبدأ ضيق، يتمدّد عند التركيز */}
        <div ref={searchRef} className="relative min-w-[160px] max-w-[200px] shrink flex-1 transition-all duration-200 focus-within:max-w-[260px] lg:min-w-[180px]">
          <form onSubmit={onSearch} role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => hasSuggestions && setShowSuggestions(true)}
                onKeyDown={onKeyDown}
                placeholder="ابحث عن تعريب…"
                aria-label="ابحث عن تعريب"
                aria-expanded={showSuggestions && hasSuggestions}
                aria-autocomplete="list"
                aria-controls="search-suggestions"
                className="h-8 border-border bg-secondary/50 pl-10 pr-4 text-xs"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setSuggestions({ mods: [], games: [] }); inputRef.current?.focus() }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          {/* نتائج البحث الذكية — مفصولة بأقسام */}
          {showSuggestions && hasSuggestions && (
            <div
              id="search-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-none border-2 border-border bg-popover shadow-2xl"
            >
              {/* قسم: التعريبات */}
              {suggestions.mods.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    التعريبات ({suggestions.mods.length})
                  </div>
                  {suggestions.mods.map((m, modIdx) => (
                    <Link
                      key={m.id}
                      href={`/mod/${m.slug}`}
                      onClick={clearSuggestions}
                      onMouseEnter={() => setActiveSuggestionIdx(modIdx)}
                      role="option"
                      aria-selected={activeSuggestionIdx === modIdx}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        activeSuggestionIdx === modIdx ? 'bg-accent' : 'hover:bg-accent/50'
                      )}
                    >
                      <img src={m.thumbnailUrl} alt="" className="h-10 w-14 rounded-md object-cover" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-foreground">{m.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {m.game.name} · {formatNumber(m.downloads)} تحميل
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{m.game.platform}</Badge>
                    </Link>
                  ))}
                </div>
              )}

              {/* قسم: روابط سريعة */}
              <div className="border-t border-border bg-secondary/20 px-4 py-2">
                <Link
                  href={`/search?q=${encodeURIComponent(q)}`}
                  onClick={clearSuggestions}
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  عرض كل النتائج لـ &quot;{q}&quot;
                  <ChevronDown className="h-3 w-3 -rotate-90" />
                </Link>
              </div>
            </div>
          )}

          {/* اقتراحات سريعة لما البحث فاضي */}
          {showSuggestions && !hasSuggestions && q.trim() && (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-none border-2 border-border bg-popover shadow-2xl"
            >
              <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                لا توجد نتائج لـ &quot;{q}&quot;
              </div>
            </div>
          )}
        </div>

        {/* Right actions — موسّع */}
        <div className="hidden items-center gap-1.5 sm:flex shrink-0 ml-auto">
          <NotificationBell currentUser={currentUser} />

          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary min-h-[44px]">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={currentUser.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px]" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                      {currentUser.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{currentUser.username}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <Link href={`/profile/${encodeURIComponent(currentUser.username)}?tab=about`} className="flex items-center gap-2 flex-row-reverse">
                      <User className="h-4 w-4" />
                      الملف الشخصي
                    </Link>
                  </DropdownMenuItem>
                  {['owner', 'admin', 'moderator'].includes(currentUser.role) && (
                    <DropdownMenuItem asChild>
                      <Link href={`/profile/${encodeURIComponent(currentUser.username)}?tab=mods`} className="flex items-center gap-2 flex-row-reverse">
                        <FileText className="h-4 w-4" />
                        تعريباتي
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {['creator', 'publisher'].includes(currentUser.role) && (
                    <DropdownMenuItem asChild>
                      <Link href="/creator" className="flex items-center gap-2 flex-row-reverse text-sm text-muted-foreground">
                        لوحة التحكم
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/favorites" className="flex items-center gap-2 flex-row-reverse">
                      <Bookmark className="h-4 w-4" />
                      مفضلاتي
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2 flex-row-reverse">
                      <Settings className="h-4 w-4" />
                      إدارة الحساب والإعدادات
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 flex-row-reverse text-destructive focus:text-destructive"
                    onClick={async () => {
                      await logout()
                      window.location.href = '/'
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="text-sm font-medium text-foreground hover:text-primary min-h-[44px]">
              <Link href="/login">
                تسجيل الدخول
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function MobileLink({
  href,
  onClick,
  isActive,
  children,
}: {
  href: string
  onClick: () => void
  isActive?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary/15 text-primary border border-primary/30'
          : 'text-foreground/80 hover:bg-accent hover:text-primary'
      }`}
    >
      {children}
    </Link>
  )
}
