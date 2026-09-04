'use client'

import { Package, Search, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
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

interface PaginatedModsResponse {
  data: ModSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const TITLE_BY_SORT: Record<string, string> = {
  downloads: 'الأكثر تحميلاً',
  endorsements: 'الأكثر تأييداً',
  newest: 'أحدث التعديلات',
  updated: 'المحدّثة حديثاً',
  views: 'الأكثر مشاهدة',
  rating: 'الأعلى تقييماً',
}

export function ModsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams.get('sort') || 'downloads'

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(urlSort)
  const [page, setPage] = useState(1)

  const [lastUrlSort, setLastUrlSort] = useState(urlSort)
  if (urlSort !== lastUrlSort) {
    setLastUrlSort(urlSort)
    setSort(urlSort)
  }

  useDocumentTitle(TITLE_BY_SORT[sort] ?? 'تصفح التعديلات')

  const debouncedSearch = useDebounced(search, 250)

  const filterKey = `${debouncedSearch}:${sort}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('limit', '24')
    return `/api/mods?${params.toString()}`
  }, [debouncedSearch, sort, page])

  const { data, loading } = useFetch<PaginatedModsResponse>(url, [url])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          {TITLE_BY_SORT[sort] ?? 'تصفح التعديلات'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {data ? `${data.pagination.total} تعديل لجميع الألعاب` : 'جارٍ التحميل…'}
        </p>
      </div>

      {/* الفلاتر */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن التعديلات…"
            aria-label="ابحث عن التعديلات"
            className="h-10 pr-10"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[180px]" aria-label="ترتيب التعديلات">
            <SlidersHorizontal className="ml-1.5 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="downloads">الأكثر تحميلاً</SelectItem>
            <SelectItem value="endorsements">الأكثر تأييداً</SelectItem>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="updated">المحدّثة حديثاً</SelectItem>
            <SelectItem value="views">الأكثر مشاهدة</SelectItem>
            <SelectItem value="rating">الأعلى تقييماً</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الشبكة */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <ModCardSkeleton key={i} />
          ))}
        </div>
      ) : (data?.data?.length ?? 0) === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعديلات</h3>
          <p className="mt-1 text-sm text-muted-foreground">جرب كلمة بحث مختلفة</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
