// Updated for new API response format
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ChevronLeft, Download, ThumbsUp, Package, ArrowRight, Filter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDebounced } from '@/hooks/use-debounced'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatNumber } from '@/lib/format'
import type { GameDetail, ModSummary } from '@/lib/types'

interface PaginatedModsResponse {
  data: ModSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function GameDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = (params.slug as string) || ''
  // Read optional category filter from URL (used by mod-detail breadcrumb links).
  const urlCat = searchParams.get('cat') || 'all'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(urlCat)
  const [sort, setSort] = useState('downloads')
  const [tab, setTab] = useState('mods')

  // Sync local category state when the URL `cat` param changes — derived-state
  // pattern (preferred over useEffect-with-setState per React docs).
  const [lastUrlCat, setLastUrlCat] = useState(urlCat)
  if (urlCat !== lastUrlCat) {
    setLastUrlCat(urlCat)
    setCategory(urlCat)
  }

  const gameUrl = slug ? `/api/games/${slug}` : null
  const { data: gameData, loading: gameLoading } = useFetch<{ data: GameDetail }>(gameUrl, [slug])

  // Set the document title once the game name loads.
  useDocumentTitle(gameData?.data?.name ?? null)

  // Debounce search so we don't fire a request per keystroke.
  const debouncedSearch = useDebounced(search, 250)

  const modsUrl = useMemo(() => {
    if (!slug) return null
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '24')
    return `/api/games/${slug}/mods?${params.toString()}`
  }, [slug, category, debouncedSearch, sort, page])

  const { data: modsData, loading: modsLoading } = useFetch<PaginatedModsResponse>(modsUrl, [modsUrl])

  // Reset page when filters change — derived-state pattern.
  const filterKey = `${slug}:${category}:${debouncedSearch}:${sort}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const game = gameData?.data

  if (!gameLoading && !game) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Game not found</h1>
        <Button asChild className="mt-4">
          <Link href="/games">Back to Games</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Banner */}
      <div className="relative h-[280px] overflow-hidden sm:h-[360px]">
        {game?.bannerUrl && (
          <img src={game.bannerUrl} alt={game.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
      </div>

      <div className="mx-auto max-w-[1200px] px-4 lg:px-6">
        {/* Header */}
        <div className="-mt-24 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-lg border-2 border-border/60 bg-card shadow-2xl sm:h-40 sm:w-40">
            {game?.thumbnailUrl && (
              <img src={game.thumbnailUrl} alt={game.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex-1 pb-2">
            {gameLoading ? (
              <div className="h-10 w-64 animate-pulse rounded bg-muted" />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{game?.category}</Badge>
                  <Badge variant="outline">{game?.releaseYear}</Badge>
                  <Badge variant="secondary"><Package className="mr-1 h-3 w-3" /> {game ? formatNumber(game.modCount) : '...'} mods</Badge>
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{game?.name}</h1>
                <p className="mt-1 text-muted-foreground">{game?.tagline}</p>
              </>
            )}
          </div>
          <div className="flex gap-2 pb-2">
            <Button asChild variant="outline" size="sm" className="min-h-[44px]">
              <Link href="/games"><ChevronLeft className="mr-1 h-4 w-4" /> All Games</Link>
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-3 gap-3 rounded-lg border border-border/60 bg-card/40 p-4">
          <StatBlock icon={<Package className="h-4 w-4" />} value={game ? formatNumber(game.modCount) : '...'} label="Mods" />
          <StatBlock icon={<Download className="h-4 w-4" />} value={game ? formatNumber(game.totalDownloads) : '...'} label="Downloads" />
          <StatBlock icon={<ThumbsUp className="h-4 w-4" />} value={game ? formatNumber(game.totalEndorsements) : '...'} label="Endorsements" />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="mods">Mods</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          {tab === 'mods' && (
            <div className="mt-6">
              {/* Filters */}
              <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search mods in this game…"
                    aria-label="Search mods in this game"
                    className="h-10 pl-10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
                  <Button
                    size="sm"
                    variant={category === 'all' ? 'default' : 'outline'}
                    onClick={() => setCategory('all')}
                    aria-pressed={category === 'all'}
                    className="h-9 min-h-[44px]"
                  >
                    All
                  </Button>
                  {game?.categories?.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant={category === c.slug ? 'default' : 'outline'}
                      onClick={() => setCategory(c.slug)}
                      aria-pressed={category === c.slug}
                      className="h-9 min-h-[44px]"
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>

                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-10 w-[160px]" aria-label="Sort mods">
                    <Filter className="mr-1.5 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="downloads">Most Downloaded</SelectItem>
                    <SelectItem value="endorsements">Top Endorsed</SelectItem>
                    <SelectItem value="newest">Latest</SelectItem>
                    <SelectItem value="updated">Recently Updated</SelectItem>
                    <SelectItem value="views">Most Viewed</SelectItem>
                    <SelectItem value="rating">Top Rated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mods grid */}
              {modsLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <ModCardSkeleton key={i} />)}
                </div>
              ) : (modsData?.data?.length ?? 0) === 0 ? (
                <div className="grid place-items-center py-16 text-center">
                  <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold">No mods found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Try a different filter or search term</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {modsData?.data?.map((m) => <ModCard key={m.id} mod={m} />)}
                  </div>

                  {/* Pagination */}
                  {modsData && modsData.pagination.totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm" className="min-h-[44px]"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground" aria-live="polite">
                        Page {page} of {modsData.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm" className="min-h-[44px]"
                        disabled={page >= modsData.pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="mt-6 max-w-3xl space-y-4 text-muted-foreground">
              <p className="leading-relaxed">{game?.description}</p>
              <div className="rounded-lg border border-border/60 bg-card/40 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Game Info</h3>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="text-foreground">{game?.category}</dd>
                  <dt className="text-muted-foreground">Release Year</dt>
                  <dd className="text-foreground">{game?.releaseYear}</dd>
                  <dt className="text-muted-foreground">Total Mods</dt>
                  <dd className="text-foreground">{game ? formatNumber(game.modCount) : '...'}</dd>
                  <dt className="text-muted-foreground">Total Downloads</dt>
                  <dd className="text-foreground">{game ? formatNumber(game.totalDownloads) : '...'}</dd>
                </dl>
              </div>
            </div>
          )}

          {tab === 'categories' && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {game?.categories?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.slug); setTab('mods') }}
                  className="group flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">Browse {c.name.toLowerCase()} mods</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </button>
              ))}
            </div>
          )}
        </Tabs>
      </div>
    </div>
  )
}

function StatBlock({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
