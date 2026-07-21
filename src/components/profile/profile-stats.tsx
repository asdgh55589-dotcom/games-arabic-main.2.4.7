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
    <div className="rounded-lg bg-[#1a1a1a]">
      <HorizontalStatCard icon={<Package className="h-4 w-4" />} label="التعريبات" value={formatNumber(stats.mods)} accent={accent} border />
      <HorizontalStatCard icon={<Download className="h-4 w-4" />} label="إجمالي التحميلات" value={formatNumber(stats.totalDownloads)} accent={accent} border />
      <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التأييدات" value={formatNumber(stats.totalEndorsements)} accent={accent} border />
      <HorizontalStatCard icon={<Eye className="h-4 w-4" />} label="المشاهدات" value={formatNumber(stats.totalViews)} accent={accent} border />
      <HorizontalStatCard icon={<Users className="h-4 w-4" />} label="المتابعين" value={formatNumber(stats.followersCount)} accent={accent} border />
      <HorizontalStatCard icon={<UserPlus className="h-4 w-4" />} label="المتابَعين" value={formatNumber(stats.followingCount)} accent={accent} />

      {isTranslator && xp && (
        <>
          <div className="mx-4 border-t border-[#333]" />
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">إحصائيات المعرب</span>
          </div>
          <HorizontalStatCard
            icon={<Star className="h-4 w-4" />}
            label="نسبة الإنجاز"
            value={`${xp.progress}%`}
            accent={accent}
            border
            extra={
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#333]">
                <div className="h-full rounded-full" style={{ width: `${xp.progress}%`, backgroundColor: accent }} />
              </div>
            }
          />
          <HorizontalStatCard icon={<BarChart3 className="h-4 w-4" />} label="المستوى" value={`${xp.name} (${xp.level})`} accent={accent} border />
          <HorizontalStatCard icon={<Award className="h-4 w-4" />} label="الشارات المكتسبة" value={formatNumber(translatorStats?.badgesCount || 0)} accent={accent} border />
          <HorizontalStatCard icon={<Calendar className="h-4 w-4" />} label="تاريخ أول تعريب" value={translatorStats?.firstModDate ? formatDate(translatorStats.firstModDate) : '—'} accent={accent} border />
          <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التقييم" value={`${translatorStats?.rating || 0}%`} accent={accent} />
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
  border,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  border?: boolean
  extra?: React.ReactNode
}) {
  return (
    <div className={`px-4 py-3 ${border ? 'border-b border-[#333]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      {extra}
    </div>
  )
}
