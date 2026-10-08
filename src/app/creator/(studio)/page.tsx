'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import * as React from 'react'
import { DataTable, schema } from '@/components/creator-dashboard/data-table'
import { SectionCards } from '@/components/creator-dashboard/section-cards'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import type { z } from 'zod'

// Code-split recharts: the interactive area chart loads only with the studio
// dashboard instead of joining the initial studio bundle.
const ChartAreaInteractive = dynamic(
  () =>
    import('@/components/creator-dashboard/chart-area-interactive').then((m) => ({
      default: m.ChartAreaInteractive,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)

type Row = z.infer<typeof schema>

interface CreatorMod {
  modId: string
  name: string
  slug: string
  workflowStatus: string
  views: number | null
  downloads: number | null
  game?: string | null
}

function toRow(mod: CreatorMod, index: number, status: { publishedKey: string; inProgressKey: string }, fallback: string): Row {
  return {
    id: index + 1,
    modId: mod.modId,
    header: mod.name,
    type: mod.game ?? fallback,
    // Status KEYS only — data-table translates at render. Never compare Arabic literals.
    status: mod.workflowStatus === 'PUBLISHED' ? status.publishedKey : status.inProgressKey,
    target: String(mod.downloads ?? 0),
    limit: String(mod.views ?? 0),
    slug: mod.slug ?? '',
  }
}

type TopModsStatus = 'loading' | 'ready' | 'error' | 'empty'

const QUICK_LINKS = [
  { href: '/creator/mods', key: 'myMods' },
  { href: '/creator/files', key: 'files' },
  { href: '/creator/comments', key: 'comments' },
  { href: '/creator/team', key: 'myTeam' },
  { href: '/creator/requests', key: 'requests' },
  { href: '/creator/news', key: 'news' },
  { href: '/creator/reports', key: 'reports' },
] as const

export default function CreatorDashboard() {
  const [rows, setRows] = React.useState<Row[]>([])
  const [topStatus, setTopStatus] = React.useState<TopModsStatus>('loading')
  const { dict } = useStudioLanguage()

  const load = React.useCallback(async () => {
    setTopStatus('loading')
    try {
      // Wave B Task 6 — top mods by PERIOD downloads (server aggregate).
      const res = await fetch('/api/creator/analytics/top-mods?range=30&limit=10', {
        cache: 'no-store',
      })
      if (!res.ok) {
        setTopStatus('error')
        return
      }
      const json = await res.json()
      const mods: CreatorMod[] = json?.data?.mods ?? []
      setRows(mods.map((m, i) => toRow(m, i, dict.status, dict.common.unpublishedFallback)))
      setTopStatus(mods.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      console.error('[studio] top-mods load failed', err)
      setTopStatus('error')
    }
  }, [dict])

  React.useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-4 md:gap-4 md:py-6">
        <SectionCards />
        {/* C5: quick per-page summaries — compact strip above the chart */}
        <nav aria-label={dict.dashboard.quickLinks} className="px-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-xs text-muted-foreground">{dict.dashboard.quickLinks}:</span>
            {QUICK_LINKS.map((l) => (
              <Button key={l.href} asChild variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs">
                <Link href={l.href}>{dict.nav[l.key as keyof typeof dict.nav]}</Link>
              </Button>
            ))}
          </div>
        </nav>
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        {/* C2: explicit table states — no silent empty/error */}
        {topStatus === 'loading' && (
          <div role="status" aria-live="polite" aria-label={dict.dashboard.topModsLoading} className="px-4 lg:px-6">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </div>
        )}
        {topStatus === 'error' && (
          <div role="alert" className="mx-4 flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm lg:mx-6">
            <p className="font-medium">{dict.dashboard.topModsTitle} — {dict.dashboard.topModsError}</p>
            <Button size="sm" variant="outline" onClick={load}>
              {dict.dashboard.retry}
            </Button>
          </div>
        )}
        {topStatus === 'empty' && (
          <div role="status" className="mx-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground lg:mx-6">
            {dict.dashboard.topModsEmpty}
          </div>
        )}
        {(topStatus === 'ready' || (topStatus !== 'loading' && topStatus !== 'error' && topStatus !== 'empty')) && (
          <DataTable data={rows} onChanged={load} />
        )}
        {topStatus === 'ready' && rows.length === 0 && (
          <div role="status" className="mx-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground lg:mx-6">
            {dict.dashboard.topModsEmpty}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
