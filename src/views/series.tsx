'use client'

import Link from 'next/link'
import { Package, Star } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatNumber } from '@/lib/format'

interface SeriesItem {
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

interface SeriesData {
  series: SeriesItem[]
}

export function SeriesPage() {
  useDocumentTitle('سلاسل التعريبات')
  const { data, loading } = useFetch<SeriesData>('/api/series')

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">سلاسل التعريبات</h1>
        <p className="mt-1 text-muted-foreground">
          اختر سلسلة لعرض جميع التعريبات الخاصة بها
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !data?.series || data.series.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد سلاسل</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.series.map((s) => (
            <Link
              key={s.id}
              href={`/?view=series-detail&series=${encodeURIComponent(s.id)}`}
              className="group relative flex h-24 items-center justify-between overflow-hidden rounded-lg border border-border bg-card p-4 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {(s.bannerUrl || s.logoUrl) && (
                <img
                  src={s.bannerUrl || s.logoUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-35 transition-opacity group-hover:opacity-50"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-card via-card/75 to-card/40" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-primary">{s.name}</h3>
                  {s.isFeatured && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                  {s.isOfficial && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">رسمي</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatNumber(s.modCount)} تعريب · {formatNumber(s.totalDownloads)} تحميل
                </p>
              </div>
              <Package className="relative h-8 w-8 text-muted-foreground/30 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
