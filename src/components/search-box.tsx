'use client'

import { ChevronDown, Package, Search, User, Users, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { highlightMatch } from '@/components/search-highlight'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useDebounced } from '@/hooks/use-debounced'
import { formatNumber } from '@/lib/format'
import type { SearchResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DropdownTeam {
  id: string
  name: string
  modCount?: number
  isOfficial?: boolean
}

interface DropdownUser {
  id: string
  username: string
  displayName?: string | null
}

interface DropdownGame {
  id: string
  name: string
  slug?: string
  platform?: string
}

type SuggestionState = SearchResponse & {
  teams?: DropdownTeam[]
  users?: DropdownUser[]
  games: DropdownGame[]
}

function highlight(text: string, query: string) {
  return highlightMatch(text, query)
}

const RECENT_KEY = 'recent_searches'

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === 'string').slice(0, 5)
      : []
  } catch {
    return []
  }
}

function pushRecent(query: string) {
  try {
    const next = [query, ...loadRecent().filter((x) => x !== query)].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort operation
  }
}

interface SearchBoxProps {
  /** Called after a navigation is triggered from search (e.g. close mobile menu). */
  onNavigate?: () => void
  /** Focus the input on mount (used when lazily revealed via keyboard). */
  autoFocus?: boolean
}

// Smart Search — extracted from Navbar and code-split via next/dynamic.
// Suggestion fetching is debounced (200ms), abortable, and fires only while typing.
export function SearchBox({ onNavigate, autoFocus = false }: SearchBoxProps) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<SuggestionState>({ mods: [], games: [] })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [trending, setTrending] = useState<string[]>([])
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(-1)

  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const trendingTried = useRef(false)

  const debouncedQ = useDebounced(q, 200)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!debouncedQ.trim()) {
      Promise.resolve().then(() => {
        setSuggestions({ mods: [], games: [] })
        setActiveSuggestionIdx(-1)
      })
      return
    }
    // Trending suggestions (lazy, once per session)
    if (!trendingTried.current) {
      trendingTried.current = true
      fetch('/api/search/trending')
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { data?: { queries?: string[] } } | null) => {
          if (json?.data?.queries) setTrending(json.data.queries)
        })
        .catch(() => {})
    }
    const controller = new AbortController()
    let cancelled = false
    fetch(`/api/search?q=${encodeURIComponent(debouncedQ)}&limit=5`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data: SearchResponse } | null) => {
        if (!cancelled && json) {
          setSuggestions(json.data)
          setShowSuggestions(true)
          setActiveSuggestionIdx(-1)
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[search-box] failed:', err)
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
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

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

  const hasSuggestions =
    suggestions.mods.length > 0 ||
    suggestions.games.length > 0 ||
    (suggestions.teams?.length ?? 0) > 0 ||
    (suggestions.users?.length ?? 0) > 0

  const totalSuggestions =
    suggestions.mods.length +
    suggestions.games.length +
    (suggestions.teams?.length ?? 0) +
    (suggestions.users?.length ?? 0)

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (q.trim()) {
      const trimmed = q.trim()
      pushRecent(trimmed)
      // Search tracking — fire-and-forget
      fetch('/api/search/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      }).catch(() => {})
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
      setShowSuggestions(false)
      onNavigate?.()
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

  return (
    <div
      ref={searchRef}
      className="relative min-w-0 max-w-[140px] shrink flex-1 transition-all duration-200 focus-within:max-w-[260px] sm:min-w-[160px] sm:max-w-[200px] lg:min-w-[180px]"
    >
      <form onSubmit={onSearch} role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (hasSuggestions) setShowSuggestions(true)
              else if (!q.trim()) {
                setRecent(loadRecent())
                setShowSuggestions(true)
              }
            }}
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
              onClick={() => {
                setQ('')
                setSuggestions({ mods: [], games: [] })
                setRecent(loadRecent())
                setShowSuggestions(true)
                inputRef.current?.focus()
              }}
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
                    activeSuggestionIdx === modIdx ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <Image
                    unoptimized
                    width={40}
                    height={40}
                    src={m.thumbnailUrl}
                    alt=""
                    className="h-10 w-14 rounded-md object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {highlight(m.name, q)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.game.name} · {formatNumber(m.downloads)} تحميل
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {m.game.platform}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* قسم: الألعاب */}
          {suggestions.games.length > 0 && (
            <div>
              <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                🎮 الألعاب ({suggestions.games.length})
              </div>
              {suggestions.games.map((g) => (
                <Link
                  key={g.id}
                  href={g.slug ? `/games/${g.slug}` : `/search?q=${encodeURIComponent(g.name)}`}
                  onClick={clearSuggestions}
                  role="option"
                  aria-selected={false}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {highlight(g.name, q)}
                    </div>
                    {g.platform && (
                      <div className="truncate text-xs text-muted-foreground">{g.platform}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* قسم: الفرق */}
          {(suggestions.teams?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3.5 w-3.5 text-primary" />
                الفرق ({suggestions.teams?.length})
              </div>
              {suggestions.teams?.map((t) => (
                <Link
                  key={t.id}
                  href={`/teams/${encodeURIComponent(t.name)}`}
                  onClick={clearSuggestions}
                  role="option"
                  aria-selected={false}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {highlight(t.name, q)}
                    </div>
                    {typeof t.modCount === 'number' && (
                      <div className="truncate text-xs text-muted-foreground">
                        {t.modCount} تعريب
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* قسم: المستخدمون */}
          {(suggestions.users?.length ?? 0) > 0 && (
            <div>
              <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <User className="h-3.5 w-3.5 text-primary" />
                المستخدمون ({suggestions.users?.length})
              </div>
              {suggestions.users?.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${encodeURIComponent(u.username)}`}
                  onClick={clearSuggestions}
                  role="option"
                  aria-selected={false}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-foreground">
                      {highlight(u.displayName || u.username, q)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground" dir="ltr">
                      @{u.username}
                    </div>
                  </div>
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
              عرض كل النتائج لـ &quot;{q}&quot; ({totalSuggestions})
              <ChevronDown className="h-3 w-3 -rotate-90" />
            </Link>
          </div>
        </div>
      )}

      {/* عمليات البحث الأخيرة — لما الحقل فاضي */}
      {showSuggestions && !hasSuggestions && !q.trim() && recent.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-none border-2 border-border bg-popover shadow-2xl">
          <div className="border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            🕘 عمليات بحث أخيرة
          </div>
          {recent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setQ(r)
                setShowSuggestions(false)
                router.push(`/search?q=${encodeURIComponent(r)}`)
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-right text-sm text-foreground transition-colors hover:bg-accent/50"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{r}</span>
            </button>
          ))}
        </div>
      )}

      {/* اقتراحات لما لا توجد نتائج */}
      {showSuggestions && !hasSuggestions && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-none border-2 border-border bg-popover shadow-2xl">
          <div className="px-4 py-3 text-center text-sm text-muted-foreground">
            🔍 لا توجد نتائج لـ &quot;{q}&quot;
          </div>
          {trending.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="mb-2 text-xs font-bold text-muted-foreground">جرّب:</div>
              <div className="flex flex-wrap gap-2">
                {trending.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setQ(t)
                      pushRecent(t)
                      router.push(`/search?q=${encodeURIComponent(t)}`)
                      setShowSuggestions(false)
                    }}
                    className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
