'use client'

import { useState } from 'react'

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

interface TierRuleFormProps {
  rule: TierRule
  onSave: (rule: TierRule) => void
  onCancel: () => void
}

export function TierRuleForm({ rule, onSave, onCancel }: TierRuleFormProps) {
  const [formData, setFormData] = useState(rule)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="text-lg font-semibold">تعديل المستوى {rule.tier}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">الاسم بالعربي</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">الاسم بالانجليزي</label>
          <input
            type="text"
            value={formData.nameEn}
            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">حد ادنى التعريبات</label>
          <input
            type="number"
            value={formData.requiredMods}
            onChange={(e) => setFormData({ ...formData, requiredMods: parseInt(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">حد ادنى التحميلات</label>
          <input
            type="number"
            value={formData.requiredDownloads}
            onChange={(e) => setFormData({ ...formData, requiredDownloads: parseInt(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">حد ادنى التقييم</label>
          <input
            type="number"
            step="0.1"
            value={formData.requiredRating}
            onChange={(e) => setFormData({ ...formData, requiredRating: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">حد ادنى الجودة</label>
          <input
            type="number"
            step="0.1"
            value={formData.requiredQualityScore}
            onChange={(e) => setFormData({ ...formData, requiredQualityScore: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          حفظ
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent">
          إلغاء
        </button>
      </div>
    </form>
  )
}
