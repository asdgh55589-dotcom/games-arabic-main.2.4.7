// Updated for new API response format
'use client'

import { useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Package, Search, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDebounced } from '@/hooks/use-debounced'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatNumber } from '@/lib/format'
import type { ModSummary } from '@/lib/types'

interface SeriesInfo {
  id: string
  slug: string
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  isFeatured: boolean
  isOfficial: boolean
  modCount: number
}

export function SeriesDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const seriesParam = (params.slug as string) || ''
  useDocumentTitle('سلسلة التعريبات')

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('downloads')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounced(search, 250)

  // Fetch series info
  const seriesUrl = useMemo(() => {
    if (!seriesParam) return null
    return `/api/series`
  }, [seriesParam])

  const { data: allSeries } = useFetch<{ data: SeriesInfo[] }>(seriesUrl, [seriesUrl])
  const seriesInfo = useMemo(() => {
    return allSeries?.data?.find((s) => s.slug === seriesParam || s.id === seriesParam || s.name === seriesParam) || null
  }, [allSeries, seriesParam])

  // Fetch mods in series
  const url = useMemo(() => {
    if (!seriesParam) return null
    const params = new URLSearchParams()
    params.set('series', seriesParam)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '24')
    if (debouncedSearch) params.set('search', debouncedSearch)
    return `/api/series/mods?${params.toString()}`
  }, [seriesParam, sort, page, debouncedSearch])

  const { data, loading } = useFetch<{ data: ModSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(url, [url])

  const filterKey = `${seriesParam}:${debouncedSearch}:${sort}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const displayName = seriesInfo?.name || seriesParam
  const modsData = data

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      {/* مسار التنقل */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/series" className="hover:text-foreground">سلاسل التعريبات</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Banner */}
      {seriesInfo?.bannerUrl && (
        <div className="relative mb-6 h-48 overflow-hidden rounded-none">
          <img src={seriesInfo.bannerUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
          {seriesInfo?.isFeatured && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
          {seriesInfo?.isOfficial && <span className="rounded bg-primary/20 px-2 py-1 text-xs font-bold text-primary">رسمي</span>}
        </div>
        {seriesInfo?.description && (
          <p className="mt-2 text-muted-foreground">{seriesInfo.description}</p>
        )}
        <p className="mt-1 text-muted-foreground">
          {modsData ? `${formatNumber(modsData.pagination?.total ?? 0)} تعريب` : 'جارٍ التحميل…'}
        </p>
      </div>

      {/* الفلاتر */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن التعريبات…"
            aria-label="ابحث عن التعريبات"
            className="h-10 pr-10"
          />
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[160px]" aria-label="ترتيب">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="downloads">الأكثر تحميلاً</SelectItem>
            <SelectItem value="endorsements">الأكثر تأييداً</SelectItem>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="updated">المحدّثة حديثاً</SelectItem>
            <SelectItem value="views">الأكثر مشاهدة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الشبكة */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ModCardSkeleton key={i} />)}
        </div>
      ) : (modsData?.data?.length ?? 0) === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعريبات</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {modsData?.data?.map((m) => <ModCard key={m.id} mod={m} />)}
          </div>
          {modsData && modsData.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابق</Button>
              <span className="text-sm text-muted-foreground" aria-live="polite">صفحة {page} من {modsData.pagination.totalPages}</span>
              <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= modsData.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
