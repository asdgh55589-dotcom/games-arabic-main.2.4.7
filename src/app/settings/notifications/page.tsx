'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

const NOTIFICATION_TYPES = [
  { id: 'comment_reply', label: 'ردود على تعليقاتي', enabled: true },
  { id: 'new_comment', label: 'تعليقات جديدة على تعريباتي', enabled: true },
  { id: 'mod_endorse', label: 'إعجابات على تعريباتي', enabled: true },
  { id: 'tier_upgrade', label: 'ترقية المستوى', enabled: true },
  { id: 'mod_approved', label: 'موافقة على تعريباتي', enabled: true },
  { id: 'mod_rejected', label: 'رفض تعريباتي', enabled: true },
  { id: 'system_announcement', label: 'إعلانات النظام', enabled: true },
]

export default function NotificationSettingsPage() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState(NOTIFICATION_TYPES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.preferences) {
          // Map fetched preferences to our list
          const fetched = json.data.preferences as Record<string, boolean>
          setPreferences((prev) => prev.map((p) => ({ ...p, enabled: fetched[p.id] ?? p.enabled })))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setPreferences((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, boolean> = {}
      preferences.forEach((p) => (payload[p.id] = p.enabled))
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: payload }),
      })
      if (res.ok) {
        toast({ title: 'تم حفظ التفضيلات' })
      } else {
        toast({ title: 'فشل الحفظ', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 max-w-2xl px-4 flex justify-center" dir="rtl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl px-4" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">إعدادات الإشعارات</h1>

      <Card>
        <CardHeader>
          <CardTitle>اختر الإشعارات التي تريد استقبالها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preferences.map((pref) => (
            <div
              key={pref.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <Label htmlFor={pref.id} className="text-sm">
                {pref.label}
              </Label>
              <Switch id={pref.id} checked={pref.enabled} onCheckedChange={() => toggle(pref.id)} />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
            {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            حفظ التفضيلات
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
