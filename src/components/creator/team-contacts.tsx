'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/official-ui/select'
import { useToast } from '@/hooks/use-toast'

interface ContactRow {
  id: string
  type: string
  label: string
  url: string
}

const TYPES = [
  { value: 'website', label: 'موقع' },
  { value: 'mail', label: 'بريد' },
  { value: 'telegram', label: 'تيليجرام' },
  { value: 'twitter', label: 'تويتر' },
  { value: 'youtube', label: 'يوتيوب' },
] as const

const MAX_LINKS = 10

export function TeamContacts() {
  const { toast } = useToast()
  const [links, setLinks] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<string>('website')
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/creator/team/contacts', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setLinks(json.data?.links ?? [])
    } catch {
      // advisory list — form stays usable
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const add = async () => {
    if (!url.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/creator/team/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url: url.trim(), label: label.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تمت إضافة الرابط' })
        setUrl('')
        setLabel('')
        fetchLinks()
      } else {
        toast({ title: json?.error?.message || 'فشل إضافة الرابط', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setSaving(false)
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/creator/team/contacts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم حذف الرابط' })
        fetchLinks()
      } else {
        toast({ title: json?.error?.message || 'فشل الحذف', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setBusyId(null)
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">روابط التواصل ({links.length}/{MAX_LINKS})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-12 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="جارٍ التحميل" />
        ) : (
          <div className="space-y-2">
            {links.length === 0 && <p className="text-sm text-muted-foreground">لا توجد روابط بعد</p>}
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-muted/40">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">
                  {TYPES.find((t) => t.value === l.type)?.label ?? l.type}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm" dir="ltr">
                  {l.label || l.url}
                </span>
                <Button variant="outline" size="sm" disabled={busyId === l.id} onClick={() => remove(l.id)}>
                  حذف
                </Button>
              </div>
            ))}
          </div>
        )}
        {links.length < MAX_LINKS && (
          <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger aria-label="نوع الرابط">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-url">الرابط</Label>
              <Input id="contact-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." dir="ltr" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-label">التسمية (اختياري)</Label>
              <Input id="contact-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="تابعنا على..." maxLength={100} />
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={saving || !url.trim()} onClick={add}>
                {saving ? '...' : 'إضافة الرابط'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
