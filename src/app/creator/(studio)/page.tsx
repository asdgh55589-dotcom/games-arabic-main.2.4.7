'use client'

import * as React from 'react'
import { ChartAreaInteractive } from '@/components/creator-dashboard/chart-area-interactive'
import { DataTable, schema } from '@/components/creator-dashboard/data-table'
import { SectionCards } from '@/components/creator-dashboard/section-cards'
import { SiteHeader } from '@/components/creator-dashboard/site-header'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import type { z } from 'zod'

type Row = z.infer<typeof schema>

interface CreatorMod {
  id: string
  name: string
  workflowStatus: string
  views: number | null
  downloads: number | null
  game?: { name: string } | null
}

function toRow(
  mod: CreatorMod,
  index: number,
  status: { publishedKey: string; inProgressKey: string }
): Row {
  return {
    id: index + 1,
    header: mod.name,
    type: mod.game?.name ?? '—',
    // Status KEYS only — data-table translates at render. Never compare Arabic literals.
    status: mod.workflowStatus === 'PUBLISHED' ? status.publishedKey : status.inProgressKey,
    target: String(mod.downloads ?? 0),
    limit: String(mod.views ?? 0),
    reviewer: '—',
  }
}

export default function CreatorDashboard() {
  const [rows, setRows] = React.useState<Row[]>([])
  const { dict } = useStudioLanguage()

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/creator/mods?page=1&limit=10', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const json = await res.json()
        const mods: CreatorMod[] = json?.data?.mods ?? []
        if (!cancelled) setRows(mods.map((m, i) => toRow(m, i, dict.status)))
      } catch {
        // table shows its empty state on failure
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={rows} />
        </div>
      </div>
    </div>
  )
}
