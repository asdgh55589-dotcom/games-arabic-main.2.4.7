// Updated for new API response format
'use client'

import { useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Search as SearchIcon, Package, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { PLATFORMS } from '@/lib/constants'
import { getSectionIcon } from '@/lib/section-icons'
import { getPlatformColor } from '@/lib/constants/platforms'
import { cn } from '@/lib/utils'
import type { SearchResponse } from '@/lib/types'

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

export function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const q = searchParams.get('q') || searchParams.get('translationTeam') || ''
  const selectedPlatforms = useMemo(
    () => (searchParams.get('platform') || '').split(',').map((p) => p.trim()).filter(Boolean),
    [searchParams]
  )

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

  const updateUrl = (newPlatforms: string[]) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (newPlatforms.length) params.set('platform', newPlatforms.join(','))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const togglePlatform = (key: string) => {
    const next = selectedPlatforms.includes(key)
      ? selectedPlatforms.filter((p) => p !== key)
      : [...selectedPlatforms, key]
    updateUrl(next)
  }

  const platformKey = selectedPlatforms.join(',')
  const url = useMemo(() => {
    const params = new URLSearchParams()
    params.set('q', q)
    if (platformKey) params.set('platform', platformKey)
    params.set('limit', '24')
    return `/api/search?${params.toString()}`
  }, [q, platformKey])
  const { data, loading } = useFetch<{ data: SearchResponse }>(url, [q, platformKey])

  const totalResults = data?.data?.mods?.length ?? 0

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-4">
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold">
            🎮 المنصة:
          </span>
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
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                  active
                    ? 'border-transparent text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground'
                )}
                style={active ? { backgroundColor: `${color}1f`, borderColor: color } : undefined}
              >
                <Icon width={14} height={14} color={color} className="shrink-0" />
                <span dir="ltr">{p.label}</span>
              </button>
            )
          })}
          {selectedPlatforms.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => updateUrl([])}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              مسح الفلاتر ({selectedPlatforms.length})
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ModCardSkeleton key={i} />)}
        </div>
      ) : totalResults === 0 ? (
        <EmptyState
          icon="search"
          title="لا توجد نتائج مطابقة"
          description="جرّب كلمات بحث مختلفة أو غيّر فلاتر المنصة"
          action={{ label: 'الصفحة الرئيسية', href: '/' }}
        />
      ) : (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            التعريبات ({totalResults})
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {data?.data?.mods.map((m) => <ModCard key={m.id} mod={m} />)}
          </div>
        </section>
      )}
    </div>
  )
}