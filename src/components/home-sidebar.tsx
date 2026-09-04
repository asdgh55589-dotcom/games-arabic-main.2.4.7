'use client'

import { Download, Eye, Flame, Heart, ThumbsUp, Zap } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { forwardRef } from 'react'
import { getModBadgeStatus, StatusBadge } from '@/components/status-badge'
import { PLATFORM_COLORS, PLATFORM_KEY_MAP } from '@/lib/constants/platforms'
import { formatNumber } from '@/lib/format'
import type { ModSummary } from '@/lib/types'

type SidebarVariant = 'latest' | 'trending' | 'topEndorsed'

function SidebarItem({
  mod,
  variant,
  rank,
}: {
  mod: ModSummary
  variant: SidebarVariant
  rank?: number
}) {
  const badgeStatus = getModBadgeStatus(mod.createdAt, mod.updatedAt)
  const platformKey = mod.game?.platform ? PLATFORM_KEY_MAP[mod.game.platform.toUpperCase()] : null
  const platformColor = platformKey ? PLATFORM_COLORS[platformKey] : undefined

  return (
    <Link
      href={`/mod/${mod.slug}`}
      className="group flex items-center gap-3 px-2 py-2 transition-all duration-150 hover:bg-accent/60 border-r-[3px] border-transparent"
      style={
        platformColor
          ? ({ '--tw-border-right-color': platformColor } as React.CSSProperties)
          : undefined
      }
    >
      {rank !== undefined && platformColor && (
        <span
          className={`w-7 shrink-0 text-center text-2xl font-black leading-none select-none tabular-nums ${rank === 1 ? 'rank-glow' : ''}`}
          style={
            {
              color: rank === 1 ? platformColor : `${platformColor}73`,
              '--glow-color': platformColor,
            } as React.CSSProperties
          }
        >
          {String(rank).padStart(2, '0')}
        </span>
      )}
      {rank !== undefined && !platformColor && (
        <span className="w-7 shrink-0 text-center text-2xl font-black text-foreground/10 leading-none select-none tabular-nums">
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <Image
        width={40}
        height={40}
        src={mod.thumbnailUrl}
        alt={mod.name}
        loading="lazy"
        className="h-10 w-16 shrink-0 object-cover border border-border/60"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
          {mod.name}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {mod.game?.platform || ''}
        </span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-muted-foreground">
          {variant === 'latest' && (
            <>
              {badgeStatus && <StatusBadge status={badgeStatus} />}
              <span className="flex items-center gap-0.5" title="التحميلات">
                <Download className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.downloads)}
              </span>
              <span className="flex items-center gap-0.5" title="المشاهدات">
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.views)}
              </span>
              <span className="flex items-center gap-0.5" title="التأييدات">
                <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.endorsements)}
              </span>
            </>
          )}
          {variant === 'trending' && (
            <>
              <span className="flex items-center gap-0.5" title="التحميلات">
                <Download className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.downloads)}
              </span>
              <span className="flex items-center gap-0.5" title="المشاهدات">
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.views)}
              </span>
              <span className="flex items-center gap-0.5" title="التأييدات">
                <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.endorsements)}
              </span>
            </>
          )}
          {variant === 'topEndorsed' && (
            <>
              <span className="flex items-center gap-0.5" title="التحميلات">
                <Download className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.downloads)}
              </span>
              <span className="flex items-center gap-0.5" title="المشاهدات">
                <Eye className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.views)}
              </span>
              <span className="flex items-center gap-0.5" title="التأييدات">
                <ThumbsUp className="h-3.5 w-3.5 text-blue-500" />
                {formatNumber(mod.endorsements)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function SidebarList({
  items,
  variant,
  showRank,
}: {
  items: ModSummary[]
  variant: SidebarVariant
  showRank?: boolean
}) {
  return (
    <div className="divide-y divide-border/50">
      {items.map((mod, idx) => (
        <SidebarItem
          key={mod.id}
          mod={mod}
          variant={variant}
          rank={showRank ? idx + 1 : undefined}
        />
      ))}
    </div>
  )
}

interface HomeSidebarProps {
  latest: ModSummary[]
  trending: ModSummary[]
  topEndorsed: ModSummary[]
}

export const HomeSidebar = forwardRef<HTMLElement, HomeSidebarProps>(function HomeSidebar(
  { latest, trending, topEndorsed },
  ref,
) {
  return (
    <aside ref={ref} className="w-full lg:w-[340px] lg:shrink-0" dir="rtl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-1">
        {/* ===== أحدث الإصدارات ===== */}
        <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
          <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
              <Zap className="h-4 w-4 text-muted-foreground" fill="currentColor" />
              أحدث الإصدارات
            </h3>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              أحدث ما تم نشره وتعديله
            </p>
          </div>
          <div className="p-1">
            <SidebarList items={latest.slice(0, 5)} variant="latest" />
          </div>
        </div>

        {/* ===== التعريبات الرائجة الآن ===== */}
        <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
          <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
              <Flame className="h-4 w-4 text-muted-foreground" />
              التعريبات الرائجة الآن
            </h3>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              ما يحمّله الجميع الآن
            </p>
          </div>
          <div className="p-1">
            <SidebarList items={trending.slice(0, 5)} variant="trending" showRank />
          </div>
        </div>

        {/* ===== أكثر التعريبات إعجاباً ===== */}
        <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
          <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
              <Heart className="h-4 w-4 text-muted-foreground" />
              أكثر التعريبات إعجاباً
            </h3>
            <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
              أكثر تعريبات حصلت على إعجابات على الإطلاق
            </p>
          </div>
          <div className="p-1">
            <SidebarList items={topEndorsed.slice(0, 5)} variant="topEndorsed" showRank />
          </div>
        </div>
      </div>
    </aside>
  )
})
