'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, Grid3x3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GameCard, GameCardSkeleton } from '@/components/game-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDebounced } from '@/hooks/use-debounced'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { GameSummary } from '@/lib/types'

const PLATFORMS = ['الكل', 'PC', 'NS', 'PS4', 'PS3', 'PS2', 'PS1'] as const

const PLATFORM_LABELS: Record<string, string> = {
  'الكل': 'الكل',
  'PC': 'PC ARABIC',
  'NS': 'NS ARABIC',
  'PS4': 'PS4 ARABIC',
  'PS3': 'PS3 ARABIC',
  'PS2': 'PS2 ARABIC',
  'PS1': 'PS1 ARABIC',
}

export function GamesPage() {
  const searchParams = useSearchParams()
  const urlPlatform = searchParams.get('platform') || 'الكل'
  useDocumentTitle('تصفح الألعاب')
  const [search, setSearch] = useState('')
  const [platform, setPlatform] = useState<string>(
    (PLATFORMS as readonly string[]).includes(urlPlatform) ? urlPlatform : 'الكل'
  )
  const [sort, setSort] = useState('popular')

  // مزامنة المنصة من الرابط
  const [lastUrlPlatform, setLastUrlPlatform] = useState(urlPlatform)
  if (urlPlatform !== lastUrlPlatform) {
    setLastUrlPlatform(urlPlatform)
    setPlatform((PLATFORMS as readonly string[]).includes(urlPlatform) ? urlPlatform : 'الكل')
  }

  const debouncedSearch = useDebounced(search, 250)

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (platform !== 'الكل') params.set('platform', platform)
    params.set('sort', sort)
    return `/api/games?${params.toString()}`
  }, [debouncedSearch, platform, sort])

  const { data, loading } = useFetch<{ games: GameSummary[] }>(url, [url])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">تصفح الألعاب</h1>
        <p className="mt-1 text-muted-foreground">
          اكتشف مجتمعات التعديل لـ {data?.games?.length ?? '...'} لعبة
        </p>
      </div>

      {/* الفلاتر */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن الألعاب…"
            aria-label="ابحث عن الألعاب"
            className="h-10 pr-10"
          />
        </div>

        {/* أزرار تصفية المنصة */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="تصفية حسب المنصة">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={platform === p ? 'default' : 'outline'}
              onClick={() => setPlatform(p)}
              aria-pressed={platform === p}
              className="h-9"
            >
              {PLATFORM_LABELS[p]}
            </Button>
          ))}
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[160px]" aria-label="ترتيب الألعاب">
            <SlidersHorizontal className="ml-1.5 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">الأكثر شعبية</SelectItem>
            <SelectItem value="mods">الأكثر تعديلات</SelectItem>
            <SelectItem value="name">أبجدياً</SelectItem>
            <SelectItem value="newest">أضيفت حديثاً</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الشبكة — بطاقات أكبر، عمودين على الجوال */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <GameCardSkeleton key={i} />)}
        </div>
      ) : (data?.games?.length ?? 0) === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Grid3x3 className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد ألعاب</h3>
          <p className="mt-1 text-sm text-muted-foreground">جرب بحثاً أو فلتراً مختلفاً</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data?.games?.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  )
}
