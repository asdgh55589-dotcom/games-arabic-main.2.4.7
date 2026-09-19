'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface Tier {
  downloads: number
  durationDays: number
}

export default function AdminBadgeSettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trendingThreshold, setTrendingThreshold] = useState(50)
  const [popularThreshold, setPopularThreshold] = useState(20)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [badgesEnabled, setBadgesEnabled] = useState(true)
  const [newHours, setNewHours] = useState(48)
  const [updatedHours, setUpdatedHours] = useState(24)

  useEffect(() => {
    fetch('/api/admin/badges/settings')
      .then((r) => {
        if (!r.ok) throw new Error('failed')
        return r.json()
      })
      .then((json) => {
        const s = json.data?.settings
        if (!s) return
        setTrendingThreshold(s.trendingThreshold)
        setPopularThreshold(s.popularThreshold)
        setTiers(s.featuredTiers ?? [])
        setBadgesEnabled(s.badgesEnabled !== false)
        setNewHours(s.newDurationHours ?? 48)
        setUpdatedHours(s.updatedDurationHours ?? 24)
      })
      .catch(() => toast({ title: 'فشل تحميل الإعدادات', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/badges/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trendingThreshold,
          popularThreshold,
          featuredTiers: tiers,
          badgesEnabled,
        }),
      })
      if (!res.ok) throw new Error('failed')
      toast({ title: 'تم حفظ الإعدادات' })
    } catch {
      toast({ title: 'فشل الحفظ', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">جاري التحميل...</p>

  return (
    <div className="max-w-2xl space-y-6" dir="rtl">
      <h1 className="text-2xl font-black">إعدادات الشارات</h1>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={badgesEnabled}
          onChange={(e) => setBadgesEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        تفعيل نظام الشارات
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm">
          عتبة رائج (تحميل/24 ساعة)
          <Input
            type="number"
            min={1}
            value={trendingThreshold}
            onChange={(e) => setTrendingThreshold(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          عتبة شائع (تحميل/24 ساعة)
          <Input
            type="number"
            min={1}
            value={popularThreshold}
            onChange={(e) => setPopularThreshold(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">مستويات مميز</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => tiers.length < 10 && setTiers([...tiers, { downloads: 100, durationDays: 2 }])}
          >
            إضافة مستوى
          </Button>
        </div>
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-sm text-muted-foreground">مستوى {i + 1}</span>
            <label className="flex-1 text-xs">
              التحميلات
              <Input
                type="number"
                min={1}
                value={t.downloads}
                onChange={(e) =>
                  setTiers(tiers.map((x, j) => (j === i ? { ...x, downloads: Number(e.target.value) } : x)))
                }
              />
            </label>
            <label className="flex-1 text-xs">
              المدة (أيام)
              <Input
                type="number"
                min={1}
                max={30}
                value={t.durationDays}
                onChange={(e) =>
                  setTiers(tiers.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))
                }
              />
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
            >
              حذف
            </Button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/50 p-4 sm:grid-cols-2">
        <label className="text-sm text-muted-foreground">
          مدة شارة جديد (ساعة) — نظامية، للعرض فقط
          <Input type="number" value={newHours} disabled className="opacity-60" />
        </label>
        <label className="text-sm text-muted-foreground">
          مدة شارة محدّث (ساعة) — نظامية، للعرض فقط
          <Input type="number" value={updatedHours} disabled className="opacity-60" />
        </label>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </Button>
    </div>
  )
}
