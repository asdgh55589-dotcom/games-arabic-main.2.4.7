'use client'

import { BarChart3, Calendar, Eye, Layers, ThumbsUp, Users } from 'lucide-react'
import Link from 'next/link'
import { formatArabicDate, formatNumber } from '@/lib/format'

interface ModStatsBarProps {
  endorsements: number
  downloads: number
  views: number
  releaseDate: string | Date
  series?: string
  translationTeam?: string
  endorsed: boolean
  onEndorse: () => void
  hasReported: boolean
  reportButton: React.ReactNode
}

function StatItem({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string | React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${iconColor}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div className="text-xs font-bold tabular-nums text-foreground">{value}</div>
      </div>
    </div>
  )
}

export function ModStatsBar({
  endorsements,
  downloads,
  views,
  releaseDate,
  series,
  translationTeam,
  endorsed,
  onEndorse,
  hasReported,
  reportButton,
}: ModStatsBarProps) {
  return (
    <div className="mod-detail-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <StatItem
        icon={<ThumbsUp className="h-3.5 w-3.5" />}
        iconColor="bg-primary/10 text-primary"
        label="اللايكات"
        value={formatNumber(endorsements)}
      />
      <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
      <StatItem
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        iconColor="bg-sky-500/10 text-sky-500"
        label="التحميلات"
        value={formatNumber(downloads)}
      />
      <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
      <StatItem
        icon={<Eye className="h-3.5 w-3.5" />}
        iconColor="bg-emerald-500/10 text-emerald-500"
        label="المشاهدات"
        value={formatNumber(views)}
      />
      <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
      <StatItem
        icon={<Calendar className="h-3.5 w-3.5" />}
        iconColor="bg-cyan-500/10 text-cyan-500"
        label="النشر"
        value={formatArabicDate(releaseDate)}
      />

      {series && series.trim() !== '' && (
        <>
          <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                السلسلة
              </div>
              <Link
                href={`/series/${encodeURIComponent(series)}`}
                className="text-xs font-bold text-primary hover:underline truncate block max-w-[120px]"
              >
                {series}
              </Link>
            </div>
          </div>
        </>
      )}

      {translationTeam && translationTeam.trim() !== '' && (
        <>
          <span className="hidden sm:block h-5 w-px bg-border" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Users className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                الفريق
              </div>
              <Link
                href={`/teams/${encodeURIComponent(translationTeam)}`}
                className="text-xs font-bold text-primary hover:underline truncate block max-w-[120px]"
              >
                {translationTeam}
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="ms-auto flex items-center gap-2">
        <button
          onClick={onEndorse}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            endorsed
              ? 'bg-primary text-primary-foreground'
              : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20'
          }`}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${endorsed ? 'fill-current' : ''}`} />
          {endorsed ? 'تم الإعجاب' : 'أعجبني'}
        </button>
        {reportButton}
      </div>
    </div>
  )
}
