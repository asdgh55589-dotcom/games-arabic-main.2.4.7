'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
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
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">سجل الترقيات</h1>
      <TierHistoryTable history={history} showUser />
    </div>
  )
}
