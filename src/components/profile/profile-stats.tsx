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
  role?: string
}

export function ProfileStats({ stats, xp, isTranslator, translatorStats, role }: ProfileStatsProps) {
  // isTranslator الآن يحسب أيضاً بناءً على وجود mods (من API)، لكن نحتفظ بالمنطق القديم كـ fallback
  const hasTranslatorStats = isTranslator || (translatorStats && translatorStats.badgesCount > 0)
  const isMember = (role === 'member' || !role) && !hasTranslatorStats
  
  return (
    <div className="space-y-3">
      {/* Member-only — basic stats */}
      {isMember ? (
        <div className="grid grid-cols-3 gap-3">
          <HorizontalStatCard icon={<Eye className="h-4 w-4" />} label="المشاهدات" value={formatNumber(stats.totalViews)} />
          <HorizontalStatCard icon={<Users className="h-4 w-4" />} label="المتابعين" value={formatNumber(stats.followersCount)} />
          <HorizontalStatCard icon={<UserPlus className="h-4 w-4" />} label="المتابَعين" value={formatNumber(stats.followingCount)} />
        </div>
      ) : (
        <>
          {/* Admin/Mod/Owner — full stats */}
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard icon={<Package className="h-4 w-4" />} label="التعريبات" value={formatNumber(stats.mods)} />
            <HorizontalStatCard icon={<Download className="h-4 w-4" />} label="التحميلات" value={formatNumber(stats.totalDownloads)} />
            <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التأييدات" value={formatNumber(stats.totalEndorsements)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard icon={<Eye className="h-4 w-4" />} label="المشاهدات" value={formatNumber(stats.totalViews)} />
            <HorizontalStatCard icon={<Users className="h-4 w-4" />} label="المتابعين" value={formatNumber(stats.followersCount)} />
            <HorizontalStatCard icon={<UserPlus className="h-4 w-4" />} label="المتابَعين" value={formatNumber(stats.followingCount)} />
          </div>
        </>
      )}

      {/* Translator-only — earned + translator stats */}
      {hasTranslatorStats && xp && (
        <>
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">إحصائيات المعرب</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard icon={<Award className="h-4 w-4" />} label="الشارات" value={formatNumber(translatorStats?.badgesCount || 0)} />
            <HorizontalStatCard icon={<BarChart3 className="h-4 w-4" />} label="المستوى" value={`${xp.name} (${xp.level})`} />
            <HorizontalStatCard
              icon={<Star className="h-4 w-4" />}
              label="نسبة الإنجاز"
              value={`${xp.progress}%`}
              extra={
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#333]">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${xp.progress}%` }} />
                </div>
              }
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="إجمالي تاييدات التعريبات" value={formatNumber(stats.totalEndorsements)} />
            <HorizontalStatCard icon={<Download className="h-4 w-4" />} label="إجمالي تحميلات التعريبات" value={formatNumber(stats.totalDownloads)} />
            <HorizontalStatCard icon={<Calendar className="h-4 w-4" />} label="أول تعريب" value={translatorStats?.firstModDate ? formatDate(translatorStats.firstModDate) : '—'} />
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
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400">{icon}</span>
          <span className="text-sm text-gray-400">{label}</span>
        </div>
        <span className="text-base font-bold text-white">{value}</span>
      </div>
      {extra}
    </div>
  )
}
