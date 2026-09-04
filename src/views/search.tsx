// Updated for new API response format
'use client'

import { Package, Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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

  // Typo suggestion state — populated by the effect below (after results load)
  const [trending, setTrending] = useState<string[]>([])

  const updateUrl = (
    opts: {
      platforms?: string[]
      tier?: number
      game?: string
      byAuthor?: string
      pg?: number
    } = {},
  ) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
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
  const { data, loading } = useFetch<{
    data: SearchResponse & { pagination?: { page: number; total: number; totalPages: number } }
  }>(url, [q, platformKey, minTier, gameId, author, page])

  const totalResults = data?.data?.pagination?.total ?? data?.data?.mods?.length ?? 0
  const totalPages = data?.data?.pagination?.totalPages ?? 1

  // Typo suggestion — when 0 results, offer the closest trending query
  useEffect(() => {
    if (totalResults === 0 && !loading && q.trim().length >= 2) {
      fetch('/api/search/trending')
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { data?: { queries?: string[] } } | null) => {
          if (json?.data?.queries) setTrending(json.data.queries)
        })
        .catch(() => {})
    }
  }, [totalResults, loading, q])

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

  const filtersPanel = (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">🎮 المنصة:</div>
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
                  'flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors min-h-[40px] touch-manipulation',
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
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">🏆 المستوى:</div>
        <div className="flex flex-wrap items-center gap-2">
          {TIER_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setTierFilter(f.minTier)}
              aria-pressed={minTier === f.minTier}
              className={cn(
                'rounded-full border px-3 py-2 text-xs font-bold transition-colors min-h-[40px] touch-manipulation',
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
        <label htmlFor="filter-game" className="mb-2 block text-sm font-semibold">
          🎲 اللعبة:
        </label>
        <select
          id="filter-game"
          value={gameId}
          onChange={(e) => updateUrl({ game: e.target.value })}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
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
        <label htmlFor="filter-author" className="mb-2 block text-sm font-semibold">
          ✍️ المعرّب:
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
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          />
          <Button type="submit" size="sm" className="h-10 shrink-0">
            تطبيق
          </Button>
        </form>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAuthorInput('')
            updateUrl({ platforms: [], tier: 0, game: '', byAuthor: '' })
          }}
          className="w-full"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          مسح كل الفلاتر
        </Button>
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <SearchIcon className="h-4 w-4" />
            نتائج البحث
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {q ? <>&quot;{q}&quot;</> : 'بحث'}
          </h1>
          <p className="mt-1 text-muted-foreground" aria-live="polite">
            {loading ? 'جارٍ البحث…' : `${totalResults} نتيجة`}
          </p>
        </div>
      </div>

      {/* Mobile filters */}
      <details className="mb-6 rounded-lg border border-border bg-card p-4 lg:hidden">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
          <SlidersHorizontal className="h-4 w-4" />
          الفلاتر{hasActiveFilters && ' (مفعّلة)'}
        </summary>
        <div className="mt-4">{filtersPanel}</div>
      </details>

      <div className="flex gap-8">
        {/* Sidebar filters (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-4">
            {filtersPanel}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Typo banner */}
          {!loading && typoSuggestion && (
            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
              هل تقصد:{' '}
              <button
                type="button"
                onClick={() => router.push(`${pathname}?q=${encodeURIComponent(typoSuggestion)}`)}
                className="font-bold text-primary hover:underline"
              >
                {typoSuggestion}
              </button>
              ؟
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <ModCardSkeleton key={i} />
              ))}
            </div>
          ) : totalResults === 0 ? (
            <EmptyState
              icon="search"
              title="لا توجد نتائج مطابقة"
              description="جرّب كلمات بحث مختلفة أو غيّر الفلاتر"
              action={{ label: 'الصفحة الرئيسية', href: '/' }}
            />
          ) : (
            <section>
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
                    onClick={() => updateUrl({ pg: page - 1 })}
                  >
                    السابق
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center gap-2">
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="text-muted-foreground">…</span>
                        )}
                        <Button
                          variant={p === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateUrl({ pg: p })}
                        >
                          {p}
                        </Button>
                      </span>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => updateUrl({ pg: page + 1 })}
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
