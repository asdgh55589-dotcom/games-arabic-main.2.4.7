'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Menu, ChevronDown, Upload, LogIn, X, TrendingUp, Flame, Package, Users, LogOut, User, Settings, FileText, Activity } from 'lucide-react'
import { PcIcon, NintendoSwitchIcon, PlayStationIcon, Xbox360Icon } from '@/components/platform-icons'
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
import { createClient } from '@/lib/supabase/client'
import type { SearchResponse } from '@/lib/types'

interface NavbarProps {
  games: { slug: string; name: string; thumbnailUrl: string; modCount: number; platform: string }[]
  currentView?: string
}

const PLATFORMS = [
  { key: 'PC', label: 'ARABIC PC', icon: PcIcon, color: '#0078D4' },
  { key: 'X360', label: 'ARABIC XBOX 360', icon: Xbox360Icon, color: '#107C10' },
  { key: 'NS', label: 'ARABIC NS', icon: NintendoSwitchIcon, color: '#E60012' },
  { key: 'PS4', label: 'ARABIC PS4', icon: PlayStationIcon, color: '#0070D1' },
  { key: 'PS3', label: 'ARABIC PS3', icon: PlayStationIcon, color: '#003087' },
  { key: 'PS2', label: 'ARABIC PS2', icon: PlayStationIcon, color: '#4A4A4A' },
  { key: 'PS1', label: 'ARABIC PS1', icon: PlayStationIcon, color: '#8C8C8C' },
] as const

export function Navbar({ games, currentView = 'home' }: NavbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResponse>({ mods: [], games: [] })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)
  const [siteName, setSiteName] = useState('GAMES ARABIC')
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; email: string; role: string; avatarUrl?: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(({ settings }) => {
      if (settings.site_name) setSiteName(settings.site_name)
    }).catch(() => {})
  }, [])

  // التحقق من تسجيل الدخول
  useEffect(() => {
    fetch('/api/auth/me', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    })
      .then((r) => r.json())
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null))
  }, [])

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
      .then((data: SearchResponse | null) => {
        if (!cancelled && data) {
          setSuggestions(data)
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
      router.push(`/?view=search&q=${encodeURIComponent(q.trim())}`)
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
        router.push(`/?view=mod&slug=${selected.slug}`)
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm" dir="ltr">
      <div className="flex h-12 max-w-[1700px] items-center gap-4 px-4">
        {/* Mobile menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[360px]">
            <SheetHeader>
              <SheetTitle className="text-left">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <span className="text-2xl font-bold tracking-tight">
                    <span className="text-primary">{siteName.split(' ')[0] || 'GAMES'}</span>
                    <span className="text-foreground"> {siteName.split(' ').slice(1).join(' ') || 'ARABIC'}</span>
                  </span>
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {PLATFORMS.map((p) => {
                const Icon = p.icon
                return (
                  <MobileLink key={p.key} href={`/?view=platform&platform=${p.key}`} onClick={() => setMobileOpen(false)} isActive={currentView === 'platform' && searchParams.get('platform') === p.key}>
                    {p.label} <Icon width={14} height={14} color={p.color} className="inline-block align-middle ms-1" />
                  </MobileLink>
                )
              })}

              <MobileLink href="/?view=series" onClick={() => setMobileOpen(false)} isActive={currentView === 'series' || currentView === 'series-detail'}>
                <Package width={16} height={16} style={{ color: '#8B5CF6' }} className="inline-block align-middle me-1" />
                السلاسل
              </MobileLink>

              <MobileLink href="/?view=teams" onClick={() => setMobileOpen(false)} isActive={currentView === 'teams' || currentView === 'team-detail'}>
                <Users width={16} height={16} style={{ color: '#F59E0B' }} className="inline-block align-middle me-1" />
                الفرق
              </MobileLink>

              <div className="mt-4 space-y-2 border-t pt-4">
                <div className="flex items-center justify-end px-3">
          <NotificationBell currentUser={currentUser} />
                </div>
                {currentUser ? (
                  <>
                    <Button asChild variant="ghost" className="w-full">
                      <Link href={`/?view=profile&user=${currentUser.username}`} onClick={() => setMobileOpen(false)}>
                        <User className="mr-2 h-4 w-4" /> {currentUser.username}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full text-destructive"
                      onClick={async () => {
                        await fetch('/api/auth/logout', { method: 'POST' })
                        setCurrentUser(null)
                        setMobileOpen(false)
                        window.location.href = '/'
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" /> تسجيل الخروج
                    </Button>
                  </>
                ) : (
                  <Button asChild className="w-full">
                    <Link href="/?view=login" onClick={() => setMobileOpen(false)}>
                      <LogIn className="mr-2 h-4 w-4" /> تسجيل الدخول
                    </Link>
                  </Button>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Left group: Logo + Desktop nav — يبقى على اليسار مع بعض */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Logo — English, على اليسار */}
          <Link href="/" className="flex shrink-0 items-center gap-1" aria-label="Games Arabic home">
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-gradient">{siteName.split(' ')[0] || 'GAMES'}</span>
              <span className="text-foreground"> {siteName.split(' ').slice(1).join(' ') || 'ARABIC'}</span>
            </span>
          </Link>

          {/* Desktop nav — المنصات فقط (الفئات الإضافية في الـ footer) */}
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {PLATFORMS.map((p) => {
            const isActive = currentView === 'platform' && searchParams.get('platform') === p.key
            const Icon = p.icon
            return (
              <Link
                key={p.key}
                href={`/?view=platform&platform=${p.key}`}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-foreground/80 hover:bg-accent hover:text-primary'
                }`}
              >
                {p.label} <Icon width={14} height={14} color={p.color} className="inline-block align-middle ms-1" />
              </Link>
            )
          })}
          <Link
            href="/?view=series"
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              currentView === 'series' || currentView === 'series-detail'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-foreground/80 hover:bg-accent hover:text-primary'
            }`}
          >
            <Package width={14} height={14} style={{ color: '#8B5CF6' }} className="inline-block align-middle" />
            السلاسل
          </Link>
          <Link
            href="/?view=teams"
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors -ms-2 ${
              currentView === 'teams' || currentView === 'team-detail'
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-foreground/80 hover:bg-accent hover:text-primary'
            }`}
          >
            <Users width={14} height={14} style={{ color: '#F59E0B' }} className="inline-block align-middle" />
            الفرق
          </Link>
        </nav>
        </div>

        {/* Smart Search — عرض ثابت، لا يتمدّد */}
        <div ref={searchRef} className="relative w-[380px] max-w-[calc(100%-340px)] min-w-[220px] shrink-0">
          <form onSubmit={onSearch} role="search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                className="h-10 border-border bg-secondary/50 pl-11 pr-4 text-sm"
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
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
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
                      href={`/?view=mod&slug=${m.slug}`}
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
                  href={`/?view=search&q=${encodeURIComponent(q)}`}
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
              className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
            >
              <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                لا توجد نتائج لـ &quot;{q}&quot;
              </div>
            </div>
          )}
        </div>

        {/* Right actions — موسّع */}
        <div className="hidden items-center gap-3 sm:flex shrink-0 ml-auto">
          <NotificationBell currentUser={currentUser} />

          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary">
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
                    <Link href={`/?view=profile&user=${currentUser.username}&tab=about`} className="flex items-center gap-2 flex-row-reverse">
                      <User className="h-4 w-4" />
                      الملف الشخصي
                    </Link>
                  </DropdownMenuItem>
                  {['owner', 'admin', 'moderator'].includes(currentUser.role) && (
                    <DropdownMenuItem asChild>
                      <Link href={`/?view=profile&user=${currentUser.username}&tab=mods`} className="flex items-center gap-2 flex-row-reverse">
                        <FileText className="h-4 w-4" />
                        تعريباتي
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/?view=profile&user=${currentUser.username}&tab=activity`} className="flex items-center gap-2 flex-row-reverse">
                      <Activity className="h-4 w-4" />
                      النشاطات
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/?view=settings" className="flex items-center gap-2 flex-row-reverse">
                      <Settings className="h-4 w-4" />
                      إدارة الحساب والإعدادات
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2 flex-row-reverse text-destructive focus:text-destructive"
                    onClick={async () => {
                      await fetch('/api/auth/logout', { method: 'POST' })
                      setCurrentUser(null)
                      window.location.href = '/'
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="text-sm font-medium text-foreground hover:text-primary">
              <Link href="/?view=login">
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
