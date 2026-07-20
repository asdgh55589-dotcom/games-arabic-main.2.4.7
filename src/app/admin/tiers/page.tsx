'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { TierRuleForm } from '@/components/tier-rule-form'

interface TierRule {
  tier: number
  name: string
  nameEn: string
  requiredMods: number
  requiredDownloads: number
  requiredRating: number
  requiredQualityScore: number
  badge: string
  badgeColor: string
  features: string[]
}

export default function TiersPage() {
  const [rules, setRules] = useState<TierRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTier, setEditingTier] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/tier-rules')
      .then(r => r.json())
      .then(data => setRules(data.rules || []))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (rule: TierRule) => {
    await fetch(`/api/admin/tier-rules/${rule.tier}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    })
    setRules(rules.map(r => r.tier === rule.tier ? rule : r))
    setEditingTier(null)
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">إدارة المستويات</h1>
      <div className="space-y-4">
        {rules.map(rule => (
          editingTier === rule.tier ? (
            <TierRuleForm key={rule.tier} rule={rule} onSave={handleSave} onCancel={() => setEditingTier(null)} />
          ) : (
            <div key={rule.tier} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <h3 className="font-semibold">{rule.name} ({rule.nameEn})</h3>
                <p className="text-sm text-muted-foreground">
                  تعريبات: {rule.requiredMods} | تحميلات: {rule.requiredDownloads} | تقييم: {rule.requiredRating} | جودة: {rule.requiredQualityScore}
                </p>
              </div>
              <button onClick={() => setEditingTier(rule.tier)} className="rounded-md border px-3 py-1 text-sm hover:bg-accent">
                تعديل
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
