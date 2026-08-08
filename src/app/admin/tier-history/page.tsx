'use client'

import { useState, useEffect } from 'react'
import { Loader2, History } from 'lucide-react'
import { TierHistoryTable } from '@/components/tier-history-table'

interface TierHistoryEntry {
  id: string
  fromTier: number
  toTier: number
  reason: string
  notes?: string
  createdAt: string
  user?: { username: string; avatarUrl?: string }
}

export default function TierHistoryPage() {
  const [history, setHistory] = useState<TierHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/tier-history')
      .then(r => r.json())
      .then(data => setHistory(data.history || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">سجل الترقيات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تتبع جميع ترقيات وتخفيضات المستويات للأعضاء.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed border-white/10 py-20 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <History className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">لا يوجد سجل ترقيات</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              سيظهر هنا سجل جميع الترقيات التلقائية واليدوية للأعضاء عند تحقيقهم الشروط المطلوبة.
            </p>
          </div>
        </div>
      ) : (
        <TierHistoryTable history={history} showUser />
      )}
    </div>
  )
}
