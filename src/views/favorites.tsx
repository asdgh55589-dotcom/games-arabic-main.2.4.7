'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal, Bookmark } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDebounced } from '@/hooks/use-debounced'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { ModSummary } from '@/lib/types'

interface BookmarksResponse {
  data: ModSummary[]
}

export function FavoritesPage() {
  useDocumentTitle('مفضلاتي')

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')

  const debouncedSearch = useDebounced(search, 250)

  const { data, loading } = useFetch<BookmarksResponse>('/api/bookmarks', ['/api/bookmarks'])

  const filteredMods = (() => {
    if (!data?.data) return []

    let mods = [...data.data]

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      mods = mods.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.game.name.toLowerCase().includes(q)
      )
    }

    switch (sort) {
      case 'downloads':
        mods.sort((a, b) => b.downloads - a.downloads)
        break
      case 'endorsements':
        mods.sort((a, b) => b.endorsements - a.endorsements)
        break
      case 'newest':
        mods.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'updated':
        mods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        break
      case 'rating':
        mods.sort((a, b) => b.rating - a.rating)
        break
    }

    return mods
  })()

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">مفضلاتي</h1>
        <p className="mt-1 text-muted-foreground">
          {data ? `${data.data.length} تعريف محفوظ` : 'جارٍ التحميل…'}
        </p>
      </div>

      {/* الفلاتر */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في المفضلة…"
            aria-label="ابحث في المفضلة"
            className="h-10 pr-10"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-10 w-[180px]" aria-label="ترتيب المفضلة">
            <SlidersHorizontal className="ml-1.5 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث</SelectItem>
            <SelectItem value="downloads">الأكثر تحميلاً</SelectItem>
            <SelectItem value="endorsements">الأكثر تأييداً</SelectItem>
            <SelectItem value="updated">المحدّثة حديثاً</SelectItem>
            <SelectItem value="rating">الأعلى تقييماً</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* الشبكة */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <ModCardSkeleton key={i} />)}
        </div>
      ) : filteredMods.length === 0 ? (
        <EmptyState
          icon="heart"
          title="لا توجد مفضلات"
          description={debouncedSearch ? 'جرب كلمة بحث مختلفة' : 'ابدأ بحفظ التعريفات التي تعجبك'}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredMods.map((m) => <ModCard key={m.id} mod={m} />)}
        </div>
      )}
    </div>
  )
}
