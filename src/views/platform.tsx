// Updated for new API response format
'use client'

import { Package, Search } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebounced } from '@/hooks/use-debounced'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFetch } from '@/hooks/use-fetch'
import type { ModSummary } from '@/lib/types'

export function PlatformPage() {
  const params = useParams()
  const rawPlatform = (params.key as string) || 'PC'
  const platform = rawPlatform.toUpperCase()
  useDocumentTitle(`ARABIC ${platform}`)

  // Platform view tracking — fire-and-forget
  useEffect(() => {
    if (platform) {
      fetch(`/api/platforms/${encodeURIComponent(platform)}/view`, { method: 'POST' }).catch(
        () => {},
      )
    }
  }, [platform])

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('downloads')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounced(search, 250)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    params.set('platform', platform)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '24')
    if (debouncedSearch) params.set('search', debouncedSearch)
    return `/api/mods?${params.toString()}`
  }, [platform, sort, page, debouncedSearch])

  const { data, loading } = useFetch<{
    data: ModSummary[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(url, [url])

  const filterKey = `${platform}:${debouncedSearch}:${sort}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">ARABIC {platform}</h1>
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
          {Array.from({ length: 8 }).map((_, i) => (
            <ModCardSkeleton key={i} />
          ))}
        </div>
      ) : (data?.data?.length ?? 0) === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعريبات</h3>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {data?.data?.map((m) => (
              <ModCard key={m.id} mod={m} />
            ))}
          </div>
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </Button>
              <span className="text-sm text-muted-foreground" aria-live="polite">
                صفحة {page} من {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
