'use client'

import { Package, Download, ThumbsUp, Eye, Users, UserPlus, Award, BarChart3 } from 'lucide-react'
import { formatNumber } from '@/lib/format'

const ROLE_STATS_LABEL: Record<string, string> = {
  owner: 'المالك',
  manager: 'المدير',
  admin: 'المسؤول',
  moderator: 'المشرف',
  publisher: 'الناشر',
  creator: 'المعرب',
  member: 'العضو',
}

interface ProfileStatsProps {
  stats: {
    mods: number
    totalDownloads: number
    totalEndorsements: number
    totalViews: number
    followersCount: number
    followingCount: number
  }
  xp?: {
    level: number
    name: string
    points: number
    progress: number
  }
  isTranslator?: boolean
  translatorStats?: {
    badgesCount: number
    firstModDate: string | null
    rating: number
  }
  role?: string
}

export function ProfileStats({
  stats,
  xp,
  isTranslator,
  translatorStats,
  role,
}: ProfileStatsProps) {
  const hasTranslatorStats = isTranslator || (translatorStats && translatorStats.badgesCount > 0)
  const statsLabel = (() => {
    // إذا كان معرّب لكن رتبته member، اعرض "المعرب" بدل "العضو"
    if (hasTranslatorStats && role === 'member') return 'المعرب'
    return ROLE_STATS_LABEL[role || 'member'] || 'المعرب'
  })()

  return (
    <div className="space-y-3">
      {/* ثابت للكل — 3 صناديق */}
      <div className="grid grid-cols-3 gap-3">
        <HorizontalStatCard
          icon={<Eye className="h-4 w-4" />}
          label="المشاهدات"
          value={formatNumber(stats.totalViews)}
        />
        <HorizontalStatCard
          icon={<Users className="h-4 w-4" />}
          label="المتابعين"
          value={formatNumber(stats.followersCount)}
        />
        <HorizontalStatCard
          icon={<UserPlus className="h-4 w-4" />}
          label="المتابَعين"
          value={formatNumber(stats.followingCount)}
        />
      </div>

      {/* إحصائيات X — 6 صناديق (5 سابقة + عدد التعريبات) */}
      {hasTranslatorStats && xp && (
        <>
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              إحصائيات {statsLabel}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard
              icon={<Package className="h-4 w-4" />}
              label="عدد التعريبات"
              value={formatNumber(stats.mods)}
            />
            <HorizontalStatCard
              icon={<Download className="h-4 w-4" />}
              label="إجمالي التحميلات"
              value={formatNumber(stats.totalDownloads)}
            />
            <HorizontalStatCard
              icon={<ThumbsUp className="h-4 w-4" />}
              label="إجمالي الإعجابات"
              value={formatNumber(stats.totalEndorsements)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard
              icon={<Eye className="h-4 w-4" />}
              label="إجمالي المشاهدات"
              value={formatNumber(stats.totalViews)}
            />
            <HorizontalStatCard
              icon={<Award className="h-4 w-4" />}
              label="الشارات المكتسبة"
              value={formatNumber(translatorStats?.badgesCount || 0)}
            />
            <HorizontalStatCard
              icon={<BarChart3 className="h-4 w-4" />}
              label="المستوى الحالي"
              value={`${xp.name} (${xp.level})`}
            />
          </div>
        </>
      )}
    </div>
  )
}

function HorizontalStatCard({
  icon,
  label,
  value,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] px-4 py-3 border border-[#333]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400">
            {icon}
          </span>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <span className="text-base font-bold text-white">{value}</span>
      </div>
      {extra}
    </div>
  )
}
