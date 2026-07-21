'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import type { ModSummary } from '@/lib/types'

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'newest', label: 'الأحدث' },
  { key: 'downloads', label: 'الأكثر تحميلاً' },
  { key: 'review', label: 'قيد المراجعة' },
  { key: 'draft', label: 'مسودة' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

interface ProfileModsFilterProps {
  mods: ModSummary[]
  accent: string
  loading?: boolean
}

export function ProfileModsFilter({ mods, accent, loading }: ProfileModsFilterProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredMods = (() => {
    switch (filter) {
      case 'newest':
        return [...mods].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      case 'downloads':
        return [...mods].sort((a, b) => b.downloads - a.downloads)
      case 'review':
        return mods.filter(m => (m as any).status === 'under_review')
      case 'draft':
        return mods.filter(m => (m as any).status === 'draft')
      default:
        return mods
    }
  })()

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-white'
            }`}
            style={filter === f.key ? { backgroundColor: accent } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mods grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <ModCardSkeleton key={i} />)}
        </div>
      ) : filteredMods.length === 0 ? (
        <div className="grid place-items-center py-16 text-center">
          <div className="mb-3 text-4xl text-gray-600">📦</div>
          <p className="text-sm text-gray-500">لا يوجد تعريبات</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredMods.map((m) => <ModCard key={m.id} mod={m} />)}
        </div>
      )}
    </div>
  )
}
