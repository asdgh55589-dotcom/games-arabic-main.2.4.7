'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { Input } from '@/components/official-ui/input'
import { Label } from '@/components/official-ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface TabRow {
  id: string
  title: string
  content: string
  visible: boolean
}

const MAX_TABS = 3

export function TeamCustomTabs() {
  const { toast } = useToast()
  const [tabs, setTabs] = useState<TabRow[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchTabs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/creator/team/custom-tabs', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setTabs(json.data?.tabs ?? [])
    } catch {
      // advisory list — form stays usable
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTabs()
  }, [fetchTabs])

  const add = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/creator/team/custom-tabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تمت إضافة التبويب' })
        setTitle('')
        setContent('')
        fetchTabs()
      } else {
        toast({ title: json?.error?.message || 'فشل إضافة التبويب', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setSaving(false)
  }

  const toggleVisible = async (tab: TabRow) => {
    setBusyId(tab.id)
    try {
      const res = await fetch(`/api/creator/team/custom-tabs/${encodeURIComponent(tab.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !tab.visible }),
      })
      if (res.ok) {
        fetchTabs()
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الحفظ', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setBusyId(null)
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/creator/team/custom-tabs/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast({ title: 'تم حذف التبويب' })
        fetchTabs()
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الحذف', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setBusyId(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">التبويبات المخصصة ({tabs.length}/{MAX_TABS})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-12 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="جارٍ التحميل" />
        ) : (
          <div className="space-y-2">
            {tabs.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تبويبات مخصصة بعد</p>}
            {tabs.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border p-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.visible ? 'ظاهر' : 'مخفي'}</span>
                <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => toggleVisible(t)}>
                  {t.visible ? 'إخفاء' : 'إظهار'}
                </Button>
                <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => remove(t.id)}>
                  حذف
                </Button>
              </div>
            ))}
          </div>
        )}
        {tabs.length < MAX_TABS && (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-2">
              <Label htmlFor="tab-title">عنوان التبويب</Label>
              <Input id="tab-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tab-content">المحتوى</Label>
              <Textarea id="tab-content" value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
            </div>
            <Button size="sm" disabled={saving || !title.trim()} onClick={add}>
              {saving ? '...' : 'إضافة التبويب'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
