'use client'

import { forwardRef } from 'react'
import Link from 'next/link'
import { Flame, Heart, Zap, ThumbsUp, Download, Eye } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ModSummary } from '@/lib/types'

type SidebarVariant = 'latest' | 'trending' | 'topEndorsed'

const THIRTY_HOURS_MS = 30 * 60 * 60 * 1000

function SidebarItem({ mod, variant }: { mod: ModSummary; variant: SidebarVariant }) {
  const now = Date.now()
  const createdAt = new Date(mod.createdAt).getTime()
  const updatedAt = new Date(mod.updatedAt).getTime()
  const ageSinceCreated = now - createdAt
  const ageSinceUpdated = now - updatedAt

  let statusBadge: { text: string; color: string } | null = null
  if (ageSinceCreated < THIRTY_HOURS_MS) {
    statusBadge = { text: 'جديد', color: 'bg-emerald-500 text-white border-2 border-black' }
  } else if (ageSinceUpdated < THIRTY_HOURS_MS && ageSinceUpdated !== ageSinceCreated) {
    statusBadge = { text: 'محدّث', color: 'bg-sky-500 text-white border-2 border-black' }
  }

  return (
    <Link
      href={`/?view=mod&slug=${mod.slug}`}
      className="flex items-center gap-3 p-2 transition-all hover:bg-primary/10 hover:translate-x-[-2px] border-l-[3px] border-transparent hover:border-primary"
    >
      <img
        src={mod.thumbnailUrl}
        alt={mod.name}
        loading="lazy"
        className="h-12 w-16 shrink-0 object-cover border-2 border-border"
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
              {statusBadge && (
                <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${statusBadge.color}`}>
                  {statusBadge.text}
                </span>
              )}
              <span className="flex items-center gap-0.5" title="التأييدات">
                <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                {formatNumber(mod.endorsements)}
              </span>
              <span className="flex items-center gap-0.5" title="التحميلات">
                <Download className="h-3.5 w-3.5 text-primary" />
                {formatNumber(mod.downloads)}
              </span>
            </>
          )}
          {variant === 'trending' && (
            <>
              <span className="flex items-center gap-0.5" title="التحميلات">
                <Download className="h-3.5 w-3.5 text-primary" />
                {formatNumber(mod.downloads)}
              </span>
              <span className="flex items-center gap-0.5" title="المشاهدات">
                <Eye className="h-3.5 w-3.5 text-primary" />
                {formatNumber(mod.views)}
              </span>
            </>
          )}
          {variant === 'topEndorsed' && (
            <>
              <span className="flex items-center gap-0.5" title="التأييدات">
                <ThumbsUp className="h-3.5 w-3.5 text-primary" />
                {formatNumber(mod.endorsements)}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

function SidebarList({ items, variant }: { items: ModSummary[]; variant: SidebarVariant }) {
  return (
    <div className="divide-y-2 divide-border">
      {items.map((mod) => (
        <SidebarItem key={mod.id} mod={mod} variant={variant} />
      ))}
    </div>
  )
}

interface HomeSidebarProps {
  latest: ModSummary[]
  trending: ModSummary[]
  topEndorsed: ModSummary[]
}

export const HomeSidebar = forwardRef<HTMLElement, HomeSidebarProps>(
  function HomeSidebar({ latest, trending, topEndorsed }, ref) {
    return (
      <aside
        ref={ref}
        className="w-[340px] shrink-0"
        dir="rtl"
      >
        <div className="space-y-4">
          {/* ===== أحدث الإصدارات ===== */}
          <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
            <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                <Zap className="h-4 w-4 text-primary" fill="currentColor" />
                أحدث الإصدارات
              </h3>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                أحدث ما تم نشره وتعديله
              </p>
            </div>
            <div className="p-2">
              <SidebarList items={latest.slice(0, 5)} variant="latest" />
            </div>
          </div>

          {/* ===== التعريبات الرائجة الآن ===== */}
          <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
            <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                <Flame className="h-4 w-4 text-primary" />
                التعريبات الرائجة الآن
              </h3>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                ما يحمّله الجميع الآن
              </p>
            </div>
            <div className="p-2">
              <SidebarList items={trending.slice(0, 5)} variant="trending" />
            </div>
          </div>

          {/* ===== أكثر التعريبات إعجاباً ===== */}
          <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
            <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                <Heart className="h-4 w-4 text-primary" />
                أكثر التعريبات إعجاباً
              </h3>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                أكثر تعريبات حصلت على إعجابات على الإطلاق
              </p>
            </div>
            <div className="p-2">
              <SidebarList items={topEndorsed.slice(0, 5)} variant="topEndorsed" />
            </div>
          </div>
        </div>
      </aside>
    )
  }
)
