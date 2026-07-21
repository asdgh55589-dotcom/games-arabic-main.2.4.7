'use client'

import { Package, Download, ThumbsUp, Eye, Users, UserPlus, Star } from 'lucide-react'
import { formatNumber } from '@/lib/format'

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
  accent: string
}

export function ProfileStats({ stats, xp, accent }: ProfileStatsProps) {
  return (
    <div className="space-y-3">
      {/* Row 1: Core stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Package className="h-5 w-5" />} label="التعريبات" value={formatNumber(stats.mods)} accent={accent} />
        <StatCard icon={<Download className="h-5 w-5" />} label="التحميلات" value={formatNumber(stats.totalDownloads)} accent={accent} />
        <StatCard icon={<ThumbsUp className="h-5 w-5" />} label="التأييدات" value={formatNumber(stats.totalEndorsements)} accent={accent} />
        <StatCard icon={<Eye className="h-5 w-5" />} label="المشاهدات" value={formatNumber(stats.totalViews)} accent={accent} />
      </div>
      {/* Row 2: Social + XP */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="المتابعين" value={formatNumber(stats.followersCount)} accent={accent} />
        <StatCard icon={<UserPlus className="h-5 w-5" />} label="المتابَعين" value={formatNumber(stats.followingCount)} accent={accent} />
        {xp && (
          <div className="rounded-lg bg-[#1a1a1a] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Star className="h-5 w-5" style={{ color: accent }} />
              <span className="text-xs text-gray-400">نسبة الإنجاز</span>
            </div>
            <div className="text-2xl font-bold text-white">{xp.progress}%</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#222]">
              <div className="h-full rounded-full" style={{ width: `${xp.progress}%`, backgroundColor: accent }} />
            </div>
          </div>
        )}
        {xp && (
          <div className="rounded-lg bg-[#1a1a1a] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Star className="h-5 w-5" style={{ color: accent }} />
              <span className="text-xs text-gray-400">المستوى</span>
            </div>
            <div className="text-2xl font-bold text-white">{xp.level}</div>
            <div className="text-xs text-gray-500">{xp.name}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg bg-[#1a1a1a] p-4 text-center">
      <div className="mb-2 flex items-center justify-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
