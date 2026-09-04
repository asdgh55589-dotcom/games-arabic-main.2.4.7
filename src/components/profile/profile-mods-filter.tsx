'use client'

import { Download, Eye, Loader2, MessageCircle, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { formatNumber } from '@/lib/format'
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
  loading?: boolean
}

export function ProfileModsFilter({ mods, loading }: ProfileModsFilterProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredMods = (() => {
    switch (filter) {
      case 'newest':
        return [...mods].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
      case 'downloads':
        return [...mods].sort((a, b) => b.downloads - a.downloads)
      case 'review':
        return mods.filter(
          (m) => (m as any).workflowStatus === 'IN_REVIEW' || (m as any).status === 'under_review',
        )
      case 'draft':
        return mods.filter(
          (m) => (m as any).workflowStatus === 'DRAFT' || (m as any).status === 'draft',
        )
      default:
        return mods
    }
  })()

  const totalDownloads = mods.reduce((s, m) => s + m.downloads, 0)
  const totalEndorsements = mods.reduce((s, m) => s + m.endorsements, 0)
  const totalViews = mods.reduce((s, m) => s + (m as any).views || 0, 0)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-green-500" />
              <span className="text-xs text-gray-400">إجمالي التحميلات</span>
            </div>
            <span className="text-sm font-bold text-white">{formatNumber(totalDownloads)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-gray-400">إجمالي التأييدات</span>
            </div>
            <span className="text-sm font-bold text-white">{formatNumber(totalEndorsements)}</span>
          </div>
        </div>
        <div className="rounded-lg bg-[#1a1a1a] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-400">إجمالي المشاهدات</span>
            </div>
            <span className="text-sm font-bold text-white">{formatNumber(totalViews)}</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-white'
                : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Mods grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ModCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredMods.length === 0 ? (
        <div className="grid place-items-center py-16 text-center">
          <div className="mb-3 text-4xl text-gray-600">📦</div>
          <p className="text-sm text-gray-500">لا يوجد تعريبات</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredMods.map((m) => (
            <ModCard key={m.id} mod={m} />
          ))}
        </div>
      )}
    </div>
  )
}
