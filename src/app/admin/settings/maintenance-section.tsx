'use client'

import { useEffect, useState } from 'react'
import { Settings, Wrench, Shield, Save, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

/**
 * قسم إعدادات الصيانة في لوحة التحكم.
 * يسمح للمالك بـ:
 *   1. تفعيل/تعطيل وضع الصيانة
 *   2. تعديل العنوان الظاهر للزوار
 *   3. تعديل الرسالة المخصصة
 */

export default function MaintenanceSettingsSection() {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [title, setTitle] = useState('الموقع تحت الصيانة')
  const [message, setMessage] = useState('نعمل حاليًا على تحسين الموقع. نرجع قريبًا!')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/maintenance')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.settings) {
          setEnabled(data.settings.enabled)
          setTitle(data.settings.title)
          setMessage(data.settings.message)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const onSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, title, message }),
      })
      if (!res.ok) throw new Error('فشل الحفظ')
      toast({
        title: 'تم الحفظ',
        description: enabled ? 'تم تفعيل وضع الصيانة' : 'تم تعطيل وضع الصيانة',
      })
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/30 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
        <Wrench className="h-4 w-4 text-orange-500" /> وضع الصيانة
      </h2>

      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {enabled ? '🟢 وضع الصيانة مفعل' : '🔴 وضع الصيانة معطّل'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? 'الزوار هيشوفوا صفحة الصيانة بدل الموقع'
                  : 'الموقع شغال طبيعي — الزوار يقدر يدخلوا'}
              </p>
            </div>

            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                enabled ? 'bg-orange-500' : 'bg-muted-foreground/30'
              }`}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`pointer-events-none block h-6 w-6 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                  enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Title */}
          <div>
            <Label className="text-sm">عنوان صفحة الصيانة</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="الموقع تحت الصيانة"
              className="mt-1"
              disabled={!enabled}
            />
          </div>

          {/* Message */}
          <div>
            <Label className="text-sm">الرسالة المخصصة للزوار</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="نعمل حاليًا على تحسين الموقع..."
              className="mt-1"
              rows={3}
              disabled={!enabled}
            />
          </div>

          {/* Info Box */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-amber-600">ملاحظة مهمة:</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>المديرين والمشرفين يقدرهم يدخلوا الموقع حتى لو الصيانة مفعّلة</li>
                <li>APIs الخاصة باللوحة التحكم بتفضل شغالة</li>
                <li>الزوار العاديين هيشوفوا صفحة الصيانة بدل الموقع</li>
              </ul>
            </div>
          </div>

          {/* Save Button */}
          <Button onClick={onSave} disabled={saving || !enabled}>
            {saving ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            حفظ الإعدادات
          </Button>
        </div>
      )}
    </div>
  )
}
