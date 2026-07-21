'use client'

import { Package, Download, ThumbsUp, Eye, Users, UserPlus, Star, Award, Calendar, BarChart3 } from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/format'

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
  accent: string
}

export function ProfileStats({ stats, xp, isTranslator, translatorStats, accent }: ProfileStatsProps) {
  return (
    <div className="space-y-2">
      {/* Regular stats — 3 per row */}
      <div className="grid grid-cols-3 gap-2">
        <HorizontalStatCard icon={<Package className="h-4 w-4" />} label="التعريبات" value={formatNumber(stats.mods)} accent={accent} />
        <HorizontalStatCard icon={<Download className="h-4 w-4" />} label="التحميلات" value={formatNumber(stats.totalDownloads)} accent={accent} />
        <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التأييدات" value={formatNumber(stats.totalEndorsements)} accent={accent} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <HorizontalStatCard icon={<Eye className="h-4 w-4" />} label="المشاهدات" value={formatNumber(stats.totalViews)} accent={accent} />
        <HorizontalStatCard icon={<Users className="h-4 w-4" />} label="المتابعين" value={formatNumber(stats.followersCount)} accent={accent} />
        <HorizontalStatCard icon={<UserPlus className="h-4 w-4" />} label="المتابَعين" value={formatNumber(stats.followingCount)} accent={accent} />
      </div>

      {/* Translator-only stats */}
      {isTranslator && xp && (
        <>
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">إحصائيات المعرب</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HorizontalStatCard
              icon={<Star className="h-4 w-4" />}
              label="نسبة الإنجاز"
              value={`${xp.progress}%`}
              accent={accent}
              extra={
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#333]">
                  <div className="h-full rounded-full" style={{ width: `${xp.progress}%`, backgroundColor: accent }} />
                </div>
              }
            />
            <HorizontalStatCard icon={<BarChart3 className="h-4 w-4" />} label="المستوى" value={`${xp.name} (${xp.level})`} accent={accent} />
            <HorizontalStatCard icon={<Award className="h-4 w-4" />} label="الشارات" value={formatNumber(translatorStats?.badgesCount || 0)} accent={accent} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HorizontalStatCard icon={<Calendar className="h-4 w-4" />} label="أول تعريب" value={translatorStats?.firstModDate ? formatDate(translatorStats.firstModDate) : '—'} accent={accent} />
            <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التقييم" value={`${translatorStats?.rating || 0}%`} accent={accent} />
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
  accent,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  extra?: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      {extra}
    </div>
  )
}
