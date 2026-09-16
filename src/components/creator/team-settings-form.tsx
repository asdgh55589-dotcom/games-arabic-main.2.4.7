'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import { useToast } from '@/hooks/use-toast'

interface TeamSettings {
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  telegramUrl: string
}

interface TeamSettingsFormProps {
  initial: TeamSettings
  onSaved: () => void
}

export function TeamSettingsForm({ initial, onSaved }: TeamSettingsFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<TeamSettings>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setForm(initial)
  }, [initial])

  const set = (key: keyof TeamSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setSuccess(false)
  }

  const submit = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/creator/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setSuccess(true)
        toast({ title: 'تم حفظ إعدادات الفريق' })
        onSaved()
      } else {
        const msg =
          json?.error?.message || (typeof json?.error === 'string' ? json.error : null) || 'فشل الحفظ'
        setError(msg)
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setSaving(false)
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>إعدادات الفريق</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team-settings-name">اسم الفريق *</Label>
          <Input id="team-settings-name" value={form.name} onChange={set('name')} maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-settings-desc">الوصف</Label>
          <Input id="team-settings-desc" value={form.description} onChange={set('description')} maxLength={1000} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="team-settings-logo">رابط الشعار</Label>
            <Input id="team-settings-logo" value={form.logoUrl} onChange={set('logoUrl')} dir="ltr" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-settings-banner">رابط البانر</Label>
            <Input id="team-settings-banner" value={form.bannerUrl} onChange={set('bannerUrl')} dir="ltr" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-settings-website">الموقع</Label>
            <Input id="team-settings-website" value={form.websiteUrl} onChange={set('websiteUrl')} dir="ltr" placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-settings-telegram">تيليجرام</Label>
            <Input id="team-settings-telegram" value={form.telegramUrl} onChange={set('telegramUrl')} dir="ltr" placeholder="https://t.me/..." />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">تم الحفظ بنجاح</p>}
        <Button onClick={submit} disabled={saving || form.name.trim().length < 2}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      </CardContent>
    </Card>
  )
}
