// Updated for new API response format
'use client'

import {
  AlertTriangle,
  Dices,
  Gamepad2,
  Lightbulb,
  Package,
  PenLine,
  RotateCcw,
  Search as SearchIcon,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFetch } from '@/hooks/use-fetch'
import { PLATFORMS } from '@/lib/constants'
import { getPlatformColor } from '@/lib/constants/platforms'
import { getSectionIcon } from '@/lib/section-icons'
import type { SearchResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

// Platform key → section icon name (يجب أن يطابق أيقونات الشريط العلوي)
const PLATFORM_ICON: Record<string, string> = {
  PC: 'PcIcon',
  X360: 'Xbox360Icon',
  NS: 'NintendoSwitchIcon',
  PS5: 'PlayStationIcon',
  PS4: 'PlayStationIcon',
  PS3: 'PlayStationIcon',
  PS2: 'PlayStationIcon',
  PS1: 'PlayStationIcon',
  ANDROID: 'Smartphone',
}

const TIER_FILTERS = [
  { value: 'all', label: 'كل المستويات', minTier: 0 },
  { value: '3', label: 'مُعَرِّب محترف+', minTier: 3 },
  { value: '4', label: 'مُعَرِّب معتمد+', minTier: 4 },
  { value: '5', label: 'مُعَرِّب أسطوري', minTier: 5 },
] as const

export function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const resultsRef = useRef<HTMLDivElement>(null)

  const q = searchParams.get('q') || searchParams.get('translationTeam') || ''
  const selectedPlatforms = useMemo(
    () =>
      (searchParams.get('platform') || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
    [searchParams],
  )
  const minTier = useMemo(() => {
    const v = searchParams.get('minTier')
    const n = v ? parseInt(v, 10) : 0
    return Number.isNaN(n) ? 0 : n
  }, [searchParams])
  const gameId = searchParams.get('gameId') || ''
  const author = searchParams.get('author') || ''
  const page = useMemo(() => {
    const n = parseInt(searchParams.get('page') || '1', 10)
    return Number.isNaN(n) || n < 1 ? 1 : n
  }, [searchParams])

  useDocumentTitle(q ? `بحث: ${q}` : 'بحث')

  // Search tracking — fire-and-forget when query changes
  useEffect(() => {
    if (q && q.trim().length >= 2) {
      fetch('/api/search/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      }).catch(() => {})
    }
  }, [q])

  // Games list for the game filter dropdown (cached 60s browser-side by the API)
  const [gamesList, setGamesList] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    fetch('/api/games')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: { id: string; name: string }[] } | null) => {
        if (Array.isArray(json?.data)) setGamesList(json.data)
      })
      .catch(() => {})
  }, [])

  const [authorInput, setAuthorInput] = useState(author)
  useEffect(() => setAuthorInput(author), [author])

  // In-page search box — lets users refine the query without the navbar
  const [searchInput, setSearchInput] = useState(q)
  useEffect(() => setSearchInput(q), [q])

  // Typo suggestion state — populated by the effect below (after results load)
  const [trending, setTrending] = useState<string[]>([])
  const [typoDismissed, setTypoDismissed] = useState(false)
  useEffect(() => setTypoDismissed(false), [q])

  const updateUrl = (
    opts: {
      q?: string
      platforms?: string[]
      tier?: number
      game?: string
      byAuthor?: string
      pg?: number
    } = {},
  ) => {
    const params = new URLSearchParams()
    const nextQ = opts.q ?? q
    if (nextQ) params.set('q', nextQ)
    const newPlatforms = opts.platforms ?? selectedPlatforms
    if (newPlatforms.length) params.set('platform', newPlatforms.join(','))
    const newTier = opts.tier ?? minTier
    if (newTier) params.set('minTier', String(newTier))
    const newGame = opts.game ?? gameId
    if (newGame) params.set('gameId', newGame)
    const newAuthor = opts.byAuthor ?? author
    if (newAuthor) params.set('author', newAuthor)
    const newPage = opts.pg ?? 1
    if (newPage > 1) params.set('page', String(newPage))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const togglePlatform = (key: string) => {
    const next = selectedPlatforms.includes(key)
      ? selectedPlatforms.filter((p) => p !== key)
      : [...selectedPlatforms, key]
    updateUrl({ platforms: next })
  }

  const setTierFilter = (value: number) => {
    updateUrl({ tier: value })
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateUrl({ q: searchInput.trim(), pg: 1 })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goToPage = (p: number) => {
    updateUrl({ pg: p })
    // router.replace uses scroll:false — bring results back into view manually
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // "Did you mean" keeps the active filters instead of dropping them
  const applySuggestion = (suggestion: string) => {
    setSearchInput(suggestion)
    updateUrl({ q: suggestion, pg: 1 })
  }

  const clearAllFilters = () => {
    setAuthorInput('')
    updateUrl({ platforms: [], tier: 0, game: '', byAuthor: '' })
  }

  const platformKey = selectedPlatforms.join(',')
  const url = useMemo(() => {
    const params = new URLSearchParams()
    params.set('q', q)
    if (platformKey) params.set('platform', platformKey)
    if (minTier) params.set('minTier', String(minTier))
    if (gameId) params.set('gameId', gameId)
    if (author) params.set('author', author)
    params.set('limit', '12')
    params.set('page', String(page))
    return `/api/search?${params.toString()}`
  }, [q, platformKey, minTier, gameId, author, page])
  const { data, loading, error, refetch } = useFetch<{
    data: SearchResponse & { pagination?: { page: number; total: number; totalPages: number } }
  }>(url, [q, platformKey, minTier, gameId, author, page])

  const totalResults = data?.data?.pagination?.total ?? data?.data?.mods?.length ?? 0
  const totalPages = data?.data?.pagination?.totalPages ?? 1

  // Typo suggestion — when 0 results, offer the closest trending query
  useEffect(() => {
    if (totalResults === 0 && !loading && !error && q.trim().length >= 2) {
      fetch('/api/search/trending')
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { data?: { queries?: string[] } } | null) => {
          if (json?.data?.queries) setTrending(json.data.queries)
        })
        .catch(() => {})
    }
  }, [totalResults, loading, error, q])

  const typoSuggestion = useMemo(() => {
    if (totalResults !== 0 || !q.trim()) return null
    const needle = q.trim().toLowerCase()
    return (
      trending.find(
        (t) =>
          t.toLowerCase() !== needle &&
          (t.toLowerCase().includes(needle.slice(0, 3)) ||
            needle.includes(t.toLowerCase().slice(0, 3))),
      ) ?? null
    )
  }, [totalResults, q, trending])

  const hasActiveFilters =
    selectedPlatforms.length > 0 || minTier > 0 || gameId !== '' || author !== ''
  const activeFilterCount =
    selectedPlatforms.length + (minTier > 0 ? 1 : 0) + (gameId ? 1 : 0) + (author ? 1 : 0)

  const tierLabel = TIER_FILTERS.find((f) => f.minTier === minTier)?.label ?? ''
  const gameLabel = gamesList.find((g) => g.id === gameId)?.name ?? 'لعبة محددة'
  const platformLabel = (key: string) => PLATFORMS.find((p) => p.key === key)?.label ?? key

  const filtersPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Gamepad2 className="h-4 w-4 text-primary" aria-hidden="true" />
          المنصة:
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p.key)
            const color = getPlatformColor(p.key)
            const Icon = getSectionIcon(PLATFORM_ICON[p.key])
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => togglePlatform(p.key)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-transparent text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground',
                )}
                style={active ? { backgroundColor: `${color}1f`, borderColor: color } : undefined}
              >
                <Icon width={14} height={14} color={color} className="shrink-0" />
                <span dir="ltr">{p.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Trophy className="h-4 w-4 text-primary" aria-hidden="true" />
          المستوى:
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTierFilter(f.minTier)}
              aria-pressed={minTier === f.minTier}
              className={cn(
                'min-h-[40px] touch-manipulation rounded-full border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                minTier === f.minTier
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="filter-game" className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Dices className="h-4 w-4 text-primary" aria-hidden="true" />
          اللعبة:
        </label>
        <select
          id="filter-game"
          value={gameId}
          onChange={(e) => updateUrl({ game: e.target.value })}
          className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">كل الألعاب</option>
          {gamesList.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="filter-author"
          className="mb-2 flex items-center gap-2 text-sm font-semibold"
        >
          <PenLine className="h-4 w-4 text-primary" aria-hidden="true" />
          المعرّب:
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateUrl({ byAuthor: authorInput.trim() })
          }}
          className="flex gap-2"
        >
          <input
            id="filter-author"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            placeholder="اسم المستخدم…"
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" size="sm" className="h-11 shrink-0">
            تطبيق
          </Button>
        </form>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="w-full focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          مسح كل الفلاتر
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      {/* Page header — query, live count, in-page refine box */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SearchIcon className="h-4 w-4" aria-hidden="true" />
              نتائج البحث
            </div>
            <h1 className="mt-1 text-balance text-3xl font-bold tracking-tight">
              {q ? <>&quot;{q}&quot;</> : 'بحث'}
            </h1>
            <p className="mt-1 text-muted-foreground" aria-live="polite">
              {loading ? (
                <span className="inline-block h-5 w-24 animate-pulse rounded bg-muted align-middle" />
              ) : error ? (
                'تعذّر تحميل النتائج'
              ) : (
                `${totalResults} نتيجة`
              )}
            </p>
          </div>
        </div>

        {/* Refine search without leaving the page */}
        <form onSubmit={submitSearch} role="search" className="mt-4 flex max-w-xl gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ابحث عن تعريب أو لعبة…"
              aria-label="تعديل كلمة البحث"
              className="h-11 w-full rounded-md border border-border bg-card pe-10 ps-10 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="مسح كلمة البحث"
                className="absolute end-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <Button type="submit" className="h-11 shrink-0">
            بحث
          </Button>
        </form>

        {/* Active filter chips — removable one by one */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="الفلاتر النشطة">
            {selectedPlatforms.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePlatform(key)}
                aria-label={`إزالة فلتر المنصة ${platformLabel(key)}`}
                className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span dir="ltr">{platformLabel(key)}</span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
            {minTier > 0 && (
              <button
                type="button"
                onClick={() => setTierFilter(0)}
                aria-label={`إزالة فلتر المستوى ${tierLabel}`}
                className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tierLabel}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {gameId && (
              <button
                type="button"
                onClick={() => updateUrl({ game: '' })}
                aria-label={`إزالة فلتر اللعبة ${gameLabel}`}
                className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {gameLabel}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            {author && (
              <button
                type="button"
                onClick={() => {
                  setAuthorInput('')
                  updateUrl({ byAuthor: '' })
                }}
                aria-label={`إزالة فلتر المعرّب ${author}`}
                className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {author}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="min-h-[32px] px-2 py-1 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* Mobile filters */}
      <details className="mb-6 rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)] lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          الفلاتر
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </summary>
        <div className="mt-4">{filtersPanel}</div>
      </details>

      <div className="flex gap-8">
        {/* Sidebar filters (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold">
              <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
              تصفية النتائج
            </h2>
            {filtersPanel}
          </div>
        </aside>

        <div ref={resultsRef} className="min-w-0 flex-1 scroll-mt-20">
          {/* Typo banner */}
          {!loading && !error && typoSuggestion && !typoDismissed && (
            <div
              role="status"
              className="mb-4 flex items-start gap-3 rounded-none border-[3px] border-amber-600/50 bg-amber-500/10 px-4 py-3 text-sm"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <p className="min-w-0 flex-1">
                هل تقصد:{' '}
                <button
                  type="button"
                  onClick={() => applySuggestion(typoSuggestion)}
                  className="font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {typoSuggestion}
                </button>
                ؟
              </p>
              <button
                type="button"
                onClick={() => setTypoDismissed(true)}
                aria-label="إغلاق الاقتراح"
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {loading ? (
            <div aria-hidden="true">
              <div className="mb-4 h-7 w-48 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <ModCardSkeleton key={i} />
                ))}
              </div>
              <span className="sr-only" role="status">
                جارٍ البحث…
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center rounded-none border-[3px] border-border bg-card px-6 py-16 text-center shadow-[4px_4px_0_0_var(--border)]">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none border-[3px] border-border bg-muted">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold">تعذّر تحميل نتائج البحث</h2>
              <p className="mb-6 mt-2 max-w-md text-sm text-muted-foreground">
                تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={refetch}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  إعادة المحاولة
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">الصفحة الرئيسية</Link>
                </Button>
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center rounded-none border-[3px] border-border bg-card px-6 py-16 text-center shadow-[4px_4px_0_0_var(--border)]">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none border-[3px] border-border bg-muted">
                <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold">لا توجد نتائج مطابقة</h2>
              <p className="mb-6 mt-2 max-w-md text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'جرّب كلمات بحث مختلفة أو أزل بعض الفلاتر لتوسيع النتائج'
                  : 'جرّب كلمات بحث مختلفة أو تصفح الاقتراحات الرائجة أدناه'}
              </p>
              {trending.length > 0 && (
                <div className="mb-6 w-full max-w-md">
                  <p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    عمليات بحث رائجة
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {trending.slice(0, 6).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => applySuggestion(t)}
                        className="min-h-[36px] rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearAllFilters}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    مسح الفلاتر
                  </Button>
                )}
                <Button asChild>
                  <Link href="/">الصفحة الرئيسية</Link>
                </Button>
              </div>
            </div>
          ) : (
            <section aria-live="polite">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Package className="h-5 w-5 text-primary" aria-hidden="true" />
                التعريبات ({totalResults})
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
                {data?.data?.mods.map((m) => (
                  <ModCard key={m.id} mod={m} query={q} />
                ))}
              </div>
              {totalPages > 1 && (
                <nav
                  aria-label="ترقيم الصفحات"
                  className="mt-6 flex items-center justify-center gap-2"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    السابق
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center gap-2">
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="text-muted-foreground" aria-hidden="true">
                            …
                          </span>
                        )}
                        <Button
                          variant={p === page ? 'default' : 'outline'}
                          size="sm"
                          aria-current={p === page ? 'page' : undefined}
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </Button>
                      </span>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    التالي
                  </Button>
                </nav>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
