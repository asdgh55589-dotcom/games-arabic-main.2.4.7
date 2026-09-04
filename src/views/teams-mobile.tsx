'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Users, Star, Shield, Search, ArrowLeft, X } from 'lucide-react'
import { formatNumber } from '@/lib/format'

// Reuse same shape as src/views/translation-teams.tsx
export interface TeamData {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  isFeatured: boolean
  isOfficial: boolean
  modCount: number
}

export interface TeamsMobileProps {
  data: TeamData[] | undefined
  loading: boolean
}

export function TeamsMobile({ data, loading }: TeamsMobileProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className="lg:hidden overflow-x-hidden" dir="rtl">
      {/* Header + search stacked (flex-col gap-2 px-3) */}
      <div className="flex flex-col gap-2 px-3 pb-3 pt-4">
        <h1 className="break-words text-xl font-bold tracking-tight">فرق التعريب</h1>
        <p className="break-words text-sm leading-relaxed text-muted-foreground">
          اختر فريقاً لعرض جميع التعريبات التي قدّموها
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
            placeholder="ابحث عن فريق..."
            aria-label="ابحث عن فريق"
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
              ? `${formatNumber(data.length)} فريق`
              : `${formatNumber(filtered.length)} من ${formatNumber(data.length)} فريق`}
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
                className="flex min-h-[72px] items-center gap-3 rounded-lg border-[3px] border-border p-3 animate-pulse bg-muted"
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
            <Users className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <h3 className="break-words text-sm font-semibold">لا توجد فرق تعريب</h3>
            <p className="break-words text-xs leading-relaxed text-muted-foreground max-w-full">
              لم يتم إنشاء أي فريق بعد. تابعنا لمعرفة الجديد.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-3 sm:px-4 py-10 text-center">
            <Search className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <h3 className="break-words text-sm font-semibold">لا توجد نتائج</h3>
            <p className="break-words text-xs leading-relaxed text-muted-foreground max-w-full">
              لا توجد فرق مطابقة لـ &quot;{query}&quot;
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
            {filtered.map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.slug}`}
                className="group flex min-h-[72px] items-center gap-3 overflow-hidden rounded-lg border-[3px] border-border bg-card p-3 shadow-[2px_2px_0_0_var(--border)] transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-0"
              >
                {/* Logo 48px rounded */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                  {t.logoUrl || t.bannerUrl ? (
                    <img
                      src={t.logoUrl || t.bannerUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users className="h-6 w-6 text-muted-foreground/40" aria-hidden />
                  )}
                </div>

                {/* Name + members/mods count */}
                <div className="flex min-w-0 flex-1 flex-col justify-center text-right">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="line-clamp-1 min-w-0 flex-1 break-words text-sm font-bold leading-tight group-hover:text-primary">
                      {t.name}
                    </h3>
                    {t.isFeatured ? (
                      <Star
                        className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                        aria-hidden
                      />
                    ) : null}
                    {t.isOfficial ? (
                      <Shield className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-1 break-words text-xs leading-none text-muted-foreground">
                    {formatNumber(t.modCount)} تعريب
                  </p>
                  {t.description ? (
                    <p className="mt-1 line-clamp-1 break-words text-[11px] leading-none text-muted-foreground/80">
                      {t.description}
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
