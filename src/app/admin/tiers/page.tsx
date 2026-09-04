'use client'

import { useState, useEffect } from 'react'
import { Loader2, Plus, Award, Settings, Trash2 } from 'lucide-react'
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
  const [showCreate, setShowCreate] = useState(false)
  const [createData, setCreateData] = useState({
    tier: 1,
    name: '',
    nameEn: '',
    requiredMods: 0,
    requiredDownloads: 0,
    requiredRating: 0,
    requiredQualityScore: 0,
    badge: '',
    badgeColor: '#6b7280',
  })

  useEffect(() => {
    fetch('/api/admin/tier-rules')
      .then((r) => r.json())
      .then((data) => {
        const payload = data?.data ?? data
        const list = payload?.rules ?? payload
        setRules(Array.isArray(list) ? list : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (rule: TierRule) => {
    await fetch(`/api/admin/tier-rules/${rule.tier}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    })
    setRules(rules.map((r) => (r.tier === rule.tier ? rule : r)))
    setEditingTier(null)
  }

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/admin/tier-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...createData, features: [] }),
      })
      const data = await res.json()
      if (!res.ok) {
        const msg =
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          'فشل الإنشاء'
        throw new Error(msg)
      }
      setRules([...rules, { ...createData, features: [] }].sort((a, b) => a.tier - b.tier))
      setShowCreate(false)
      setCreateData({
        tier: rules.length + 1,
        name: '',
        nameEn: '',
        requiredMods: 0,
        requiredDownloads: 0,
        requiredRating: 0,
        requiredQualityScore: 0,
        badge: '',
        badgeColor: '#6b7280',
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'فشل الإنشاء')
    }
  }

  const handleDelete = async (tier: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستوى؟')) return
    try {
      const res = await fetch(`/api/admin/tier-rules/${tier}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      setRules(rules.filter((r) => r.tier !== tier))
    } catch {
      alert('فشل الحذف')
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة المستويات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تحديد شروط الترقية لكل مستوى والأيزات والصلاحيات المصاحبة.
          </p>
        </div>
        {rules.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            إضافة مستوى
          </button>
        )}
      </div>

      {/* نموذج الإنشاء */}
      {showCreate && (
        <div className="rounded-lg border border-primary/20 bg-card p-5 space-y-4">
          <h3 className="text-lg font-semibold">إضافة مستوى جديد</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">رقم المستوى</label>
              <input
                type="number"
                value={createData.tier}
                onChange={(e) =>
                  setCreateData({ ...createData, tier: parseInt(e.target.value) || 1 })
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                min={1}
              />
            </div>
            <div>
              <label className="text-sm font-medium">الاسم بالعربي</label>
              <input
                type="text"
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="مثال: مترجم"
              />
            </div>
            <div>
              <label className="text-sm font-medium">الاسم بالانجليزي</label>
              <input
                type="text"
                value={createData.nameEn}
                onChange={(e) => setCreateData({ ...createData, nameEn: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="مثال: Translator"
              />
            </div>
            <div>
              <label className="text-sm font-medium">لون الشارة</label>
              <input
                type="color"
                value={createData.badgeColor}
                onChange={(e) => setCreateData({ ...createData, badgeColor: e.target.value })}
                className="h-10 w-full rounded-md border bg-background px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">حد أدنى التعريبات</label>
              <input
                type="number"
                value={createData.requiredMods}
                onChange={(e) =>
                  setCreateData({ ...createData, requiredMods: parseInt(e.target.value) || 0 })
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">حد أدنى التحميلات</label>
              <input
                type="number"
                value={createData.requiredDownloads}
                onChange={(e) =>
                  setCreateData({ ...createData, requiredDownloads: parseInt(e.target.value) || 0 })
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              إنشاء
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* حالة فارغة */}
      {rules.length === 0 && !showCreate && (
        <div className="grid place-items-center rounded-lg border border-dashed border-border-light py-20 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Award className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">لا توجد مستويات بعد</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              أضف مستويات لتحديد شروط الترقية للأعضاء بناءً على إنجازاتهم في التعريب.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              إضافة أول مستوى
            </button>
          </div>
        </div>
      )}

      {/* قائمة المستويات */}
      <div className="space-y-3">
        {rules.map((rule) =>
          editingTier === rule.tier ? (
            <TierRuleForm
              key={rule.tier}
              rule={rule}
              onSave={handleSave}
              onCancel={() => setEditingTier(null)}
            />
          ) : (
            <div
              key={rule.tier}
              className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-card/80"
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: rule.badgeColor || '#6b7280' }}
                >
                  {rule.tier}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {rule.name} ({rule.nameEn})
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    تعريبات: {rule.requiredMods} · تحميلات: {rule.requiredDownloads} · تقييم:{' '}
                    {rule.requiredRating} · جودة: {rule.requiredQualityScore}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingTier(rule.tier)}
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <Settings className="h-3.5 w-3.5" />
                  تعديل
                </button>
                <button
                  onClick={() => handleDelete(rule.tier)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}
