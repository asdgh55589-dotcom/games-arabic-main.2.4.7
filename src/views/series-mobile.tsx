'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Package, Star, Search, ArrowLeft, X } from 'lucide-react'
import { formatNumber } from '@/lib/format'

// Reuse same shape as src/views/series.tsx
export interface SeriesItem {
  id: string
  slug: string
  name: string
  description: string
  bannerUrl: string
  logoUrl: string
  color: string
  isFeatured: boolean
  isOfficial: boolean
  modCount: number
  totalDownloads: number
  totalEndorsements: number
}

export interface SeriesMobileProps {
  data: SeriesItem[] | undefined
  loading: boolean
}

export function SeriesMobile({ data, loading }: SeriesMobileProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className="lg:hidden overflow-x-hidden" dir="rtl">
      {/* Header + search/filters stacked (flex-col gap-2 px-3) */}
      <div className="flex flex-col gap-2 px-3 pb-3 pt-4">
        <h1 className="break-words text-xl font-bold tracking-tight">سلاسل التعريبات</h1>
        <p className="break-words text-sm leading-relaxed text-muted-foreground">
          اختر سلسلة لعرض جميع التعريبات الخاصة بها
        </p>

        {/* Search — compact, tap target ≥44px */}
        <div className="relative mt-1">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن سلسلة..."
            aria-label="ابحث عن سلسلة"
            className="h-11 min-h-[44px] touch-manipulation w-full rounded-lg border-[2px] border-border bg-card py-2 pe-9 ps-9 text-sm break-words placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح البحث"
              className="absolute left-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground min-h-[32px] min-w-[32px]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {!loading && data && data.length > 0 && (
          <p className="break-words text-xs font-medium text-muted-foreground" aria-live="polite">
            {filtered.length === data.length
              ? `${formatNumber(data.length)} سلسلة`
              : `${formatNumber(filtered.length)} من ${formatNumber(data.length)} سلسلة`}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="px-3 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-2" aria-busy="true" aria-label="جاري التحميل">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-[3px] border-border p-3 rounded-lg min-h-[72px] animate-pulse bg-muted"
              >
                <div className="h-12 w-12 shrink-0 rounded-md bg-muted-foreground/15" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 w-3/5 rounded bg-muted-foreground/15" />
                  <div className="h-3 w-2/5 rounded bg-muted-foreground/10" />
                </div>
                <div className="h-4 w-4 shrink-0 rounded bg-muted-foreground/10" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 sm:px-4 py-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <h3 className="break-words text-sm font-semibold">لا توجد سلاسل</h3>
            <p className="break-words text-xs leading-relaxed text-muted-foreground max-w-full">
              لم يتم إنشاء أي سلسلة بعد. تابعنا لمعرفة الجديد.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 sm:px-4 py-10 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <h3 className="break-words text-sm font-semibold">لا توجد نتائج</h3>
            <p className="break-words text-xs leading-relaxed text-muted-foreground max-w-full">
              لا توجد سلاسل مطابقة لـ &quot;{query}&quot;
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-md border-[2px] border-border bg-card px-3 sm:px-4 text-xs font-bold hover:bg-muted"
            >
              مسح البحث
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.slug}`}
                className="group flex min-h-[72px] items-center gap-3 overflow-hidden rounded-lg border-[3px] border-border bg-card p-3 shadow-[2px_2px_0_0_var(--border)] transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0"
              >
                {/* Logo / image 48px */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {s.logoUrl || s.bannerUrl ? (
                    <img
                      src={s.logoUrl || s.bannerUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground/40" aria-hidden />
                  )}
                </div>

                {/* Name (line-clamp-1) + mods count */}
                <div className="flex min-w-0 flex-1 flex-col justify-center text-right">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-sm font-bold leading-tight group-hover:text-primary">
                      {s.name}
                    </h3>
                    {s.isFeatured ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-hidden /> : null}
                    {s.isOfficial ? (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary">
                        رسمي
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-1 break-words text-xs leading-none text-muted-foreground">
                    {formatNumber(s.modCount)} تعريب · {formatNumber(s.totalDownloads)} تحميل
                  </p>
                  {s.description ? (
                    <p className="mt-1 line-clamp-1 break-words text-[11px] leading-none text-muted-foreground/80">
                      {s.description}
                    </p>
                  ) : null}
                </div>

                {/* Arrow — tap target ≥44px via parent link */}
                <ArrowLeft
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-foreground"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
