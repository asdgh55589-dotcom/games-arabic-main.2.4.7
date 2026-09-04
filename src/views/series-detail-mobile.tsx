'use client'

import Link from 'next/link'
import { ArrowRight, Home, Package, Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { formatNumber } from '@/lib/format'
import type { ModSummary } from '@/lib/types'

export interface SeriesInfo {
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

export interface SeriesDetailMobileProps {
  displayName: string
  seriesInfo: SeriesInfo | null
  modsData:
    | {
        data: ModSummary[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }
    | null
    | undefined
  loading: boolean
  search: string
  setSearch: (v: string) => void
  sort: string
  setSort: (v: string) => void
  page: number
  setPage: (v: number) => void
}

export function SeriesDetailMobile({
  displayName,
  seriesInfo,
  modsData,
  loading,
  search,
  setSearch,
  sort,
  setSort,
  page,
  setPage,
}: SeriesDetailMobileProps) {
  const total = modsData?.pagination?.total ?? seriesInfo?.modCount ?? 0
  const totalPages = modsData?.pagination?.totalPages ?? 1

  return (
    <div className="lg:hidden overflow-x-hidden" dir="rtl">
      {/* 1. Breadcrumb above header (🏠 ← سلاسل ← name) */}
      <nav
        aria-label="مسار التنقل"
        className="flex items-center gap-1.5 overflow-hidden px-3 sm:px-4 pb-2 pt-3 text-xs text-muted-foreground"
      >
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 min-h-[44px] touch-manipulation min-w-[44px] justify-center sm:min-h-0 sm:min-w-0 sm:justify-start"
          aria-label="الرئيسية"
        >
          <Home className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline break-words">الرئيسية</span>
          <span className="sm:hidden" aria-hidden>
            🏠
          </span>
        </Link>
        <ArrowRight className="h-3 w-3 shrink-0 rotate-180 opacity-50" aria-hidden />
        <Link
          href="/series"
          className="shrink-0 rounded-sm px-1 py-1 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring break-words min-h-[44px] touch-manipulation inline-flex items-center sm:min-h-0"
        >
          سلاسل
        </Link>
        <ArrowRight className="h-3 w-3 shrink-0 rotate-180 opacity-50" aria-hidden />
        <span
          className="min-w-0 flex-1 truncate break-words font-medium text-foreground"
          title={displayName}
        >
          {displayName}
        </span>
      </nav>

      {/* 2. Header: logo + title + description stacked, px-3 sm:px-4 */}
      <div className="flex flex-col items-center gap-3 px-3 sm:px-4 pb-3 text-center">
        {seriesInfo?.logoUrl ? (
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seriesInfo.logoUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="flex w-full min-w-0 flex-col items-center gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-1.5 min-w-0 max-w-full">
            <h1 className="break-words text-xl font-bold leading-tight tracking-tight">
              {displayName}
            </h1>
            {seriesInfo?.isFeatured ? (
              <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
            ) : null}
            {seriesInfo?.isOfficial ? (
              <span className="shrink-0 rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold leading-none text-primary break-words">
                رسمي
              </span>
            ) : null}
          </div>
          {seriesInfo?.description ? (
            <p className="w-full max-w-full break-words text-sm leading-relaxed text-muted-foreground">
              {seriesInfo.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* 3. Info chips: flex flex-wrap gap-1 — mods count */}
      <div className="flex flex-wrap items-center justify-center gap-1 px-3 sm:px-4 pb-4">
        <span className="inline-flex min-h-[28px] items-center rounded-full border bg-muted px-3 py-1 text-xs font-medium break-words">
          {formatNumber(total)} تعريب
        </span>
        {seriesInfo?.isFeatured ? (
          <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 break-words">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
            مميزة
          </span>
        ) : null}
        {seriesInfo?.isOfficial ? (
          <span className="inline-flex min-h-[28px] items-center rounded-full border bg-primary/10 px-3 py-1 text-xs font-bold text-primary break-words">
            رسمية
          </span>
        ) : null}
      </div>

      {/* 4. Filters: search input + sort Select stacked */}
      <div className="flex flex-col gap-2 px-3 sm:px-4 pb-4">
        <div className="relative w-full min-w-0">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن التعريبات…"
            aria-label="ابحث عن التعريبات"
            className="h-11 min-h-[44px] touch-manipulation w-full min-w-0 break-words pr-10 text-sm"
          />
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger
            className="h-11 min-h-[44px] touch-manipulation w-full min-w-0 text-sm break-words"
            aria-label="ترتيب"
          >
            <SelectValue placeholder="ترتيب" />
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

      {/* 5. Mods grid: grid-cols-2 gap-2 (compact ModCard) */}
      <div className="px-3 pb-6">
        {loading ? (
          <div
            className="grid grid-cols-2 gap-1.5 sm:gap-2"
            aria-busy="true"
            aria-label="جاري التحميل"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ModCardSkeleton key={i} variant="compact" />
            ))}
          </div>
        ) : (modsData?.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-3 sm:px-4 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <h3 className="break-words text-sm font-semibold">لا توجد تعريبات</h3>
            <p className="max-w-full break-words text-xs leading-relaxed text-muted-foreground">
              {search ? `لا توجد نتائج لـ "${search}"` : 'لا توجد تعريبات في هذه السلسلة بعد'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              {modsData?.data?.map((m) => (
                <ModCard key={m.id} mod={m} variant="compact" />
              ))}
            </div>

            {/* 6. Pagination: buttons */}
            {modsData && totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation min-w-[80px] flex-1 max-w-[100px] sm:max-w-[120px] break-words"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  aria-label="الصفحة السابقة"
                >
                  السابق
                </Button>
                <span
                  className="shrink-0 break-words px-2 text-xs font-medium text-muted-foreground"
                  aria-live="polite"
                >
                  صفحة {page} من {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] touch-manipulation min-w-[80px] flex-1 max-w-[100px] sm:max-w-[120px] break-words"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  aria-label="الصفحة التالية"
                >
                  التالي
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
