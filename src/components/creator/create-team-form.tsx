'use client'

import { useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import { useToast } from '@/hooks/use-toast'

interface CreateTeamFormProps {
  onCreated: () => void
}

export function CreateTeamForm({ onCreated }: CreateTeamFormProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [telegramUrl, setTelegramUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          logoUrl,
          bannerUrl,
          websiteUrl,
          telegramUrl,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم إنشاء الفريق بنجاح' })
        onCreated()
      } else {
        const msg =
          json?.error?.message || (typeof json?.error === 'string' ? json.error : null) || 'فشل إنشاء الفريق'
        setError(msg)
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setSaving(false)
  }

  return (
    <Card className="max-w-2xl border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>أنشئ فريقك الأول</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="team-name">اسم الفريق *</Label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: فريق التعريب الذهبي"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-desc">الوصف</Label>
          <Input
            id="team-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="نبذة قصيرة عن الفريق"
            maxLength={1000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="team-logo">رابط الشعار</Label>
            <Input
              id="team-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-banner">رابط البانر</Label>
            <Input
              id="team-banner"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-website">الموقع</Label>
            <Input
              id="team-website"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-telegram">تيليجرام</Label>
            <Input
              id="team-telegram"
              value={telegramUrl}
              onChange={(e) => setTelegramUrl(e.target.value)}
              placeholder="https://t.me/..."
              dir="ltr"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit} disabled={saving || name.trim().length < 2}>
          {saving ? 'جارٍ الإنشاء...' : 'إنشاء الفريق'}
        </Button>
      </CardContent>
    </Card>
  )
}
