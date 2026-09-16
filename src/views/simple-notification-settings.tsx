'use client'

import { Check, Loader2, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface NotificationPreferences {
  id: string
  userId: string
  emailEnabled: boolean
  pushEnabled: boolean
  dailySummary: boolean
  summaryIntervalDays: number
  likeThreshold: number
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  typePreferences: Record<string, unknown>
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
        checked ? 'bg-primary' : 'bg-muted'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function SimpleNotificationSettings() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) setPreferences(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const notificationsEnabled = preferences
    ? preferences.emailEnabled || preferences.pushEnabled
    : true

  const toggleNotifications = useCallback(
    (enabled: boolean) => {
      setPreferences((prev) =>
        prev
          ? {
              ...prev,
              emailEnabled: enabled,
              pushEnabled: enabled,
            }
          : prev,
      )
    },
    [],
  )

  const handleSave = async () => {
    if (!preferences) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: preferences.emailEnabled,
          pushEnabled: preferences.pushEnabled,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.data) setPreferences(data.data)
        setSaved(true)
        toast({ title: 'تم الحفظ', description: 'تم حفظ تفضيلات الإشعارات بنجاح' })
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ التغييرات', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل حفظ التغييرات', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">فشل في تحميل التفضيلات</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-none bg-card border-2 border-border p-6">
        <h3 className="mb-2 text-sm font-bold">الإشعارات</h3>
        <p className="text-xs text-muted-foreground mb-4">تحكم في استلام الإشعارات</p>
        <div className="flex items-center justify-between gap-4 p-3 rounded-none hover:bg-accent/30 transition-colors">
          <div className="flex-1">
            <p className="text-sm font-medium">تفعيل الإشعارات</p>
            <p className="text-xs text-muted-foreground mt-0.5">استلام جميع الإشعارات</p>
          </div>
          <Toggle checked={notificationsEnabled} onChange={toggleNotifications} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`cursor-pointer transition-all duration-200 ${
            saved
              ? 'bg-status-new text-status-new-foreground hover:bg-status-new/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...
            </>
          ) : saved ? (
            <>
              <Check className="ml-2 h-4 w-4" /> تم الحفظ
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" /> حفظ التغييرات
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
