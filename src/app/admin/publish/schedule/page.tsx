'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { PLATFORMS } from '@/lib/constants'

/**
 * `/admin/publish/schedule` — صفحة الجدولة للأدمن العامل (المرحلة 4).
 *
 * كل مهام الجدولة (موقع + اجتماعي) مع فلاتر الحالة/المنصة/المالك،
 * وتعديل الموعد/الوضعية قبل الإطلاق، وتفعيل المسودات وإلغاء المجدولة.
 * الكتابة manager-only عبر API.
 */

interface ScheduleProject {
  id: string
  modId: string | null
  postId: string | null
  mode: string
  sitePublishAt: string | null
  socialPublishAt: string | null
  status: string
  error: string | null
  createdById: string | null
  createdAt: string
  mod: {
    id: string
    name: string
    slug: string
    workflowStatus: string
    game: { platform: string } | null
  } | null
  post: { id: string; status: string; scheduledFor: string | null } | null
}

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدولة',
  running: 'جارية',
  done: 'تمت',
  failed: 'فشلت',
  canceled: 'ملغاة',
}

const MODE_AR: Record<string, string> = {
  site_only: 'الموقع فقط',
  social_only: 'منشور فقط',
  both: 'الاثنان',
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-SA')
}

function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: { message?: string }; message?: string }).error
    if (typeof err?.message === 'string' && err.message) return err.message
    const msg = (body as { message?: string }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

export default function PublishSchedulePage() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<ScheduleProject[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState('')
  const [platform, setPlatform] = useState('')
  const [owner, setOwner] = useState('')

  const [editing, setEditing] = useState<ScheduleProject | null>(null)
  const [editMode, setEditMode] = useState('both')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('12:00')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (platform) params.set('platform', platform)
      if (owner.trim()) params.set('owner', owner.trim())
      const res = await fetch(`/api/admin/schedule-projects?${params}`)
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر تحميل المهام'))
      setProjects(body.data?.projects ?? [])
      setTotal(body.data?.total ?? 0)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر التحميل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [status, platform, owner, toast])

  useEffect(() => {
    load()
  }, [load])

  function openEdit(p: ScheduleProject) {
    setEditing(p)
    setEditMode(p.mode)
    const dt = p.sitePublishAt ?? p.socialPublishAt
    setEditDate(dt ? dt.slice(0, 10) : '')
    setEditTime(dt ? (dt.slice(11, 16) || '12:00') : '12:00')
  }

  async function handleSave() {
    if (!editing || !editDate) return
    setSaving(true)
    try {
      const iso = new Date(`${editDate}T${editTime}:00`).toISOString()
      const res = await fetch(`/api/admin/schedule-projects/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: editMode, sitePublishAt: iso, socialPublishAt: iso }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل حفظ المهمة'))
      setEditing(null)
      toast({ title: 'تم', description: 'حُفظت المهمة وأُعيد تفعيلها' })
      load()
    } catch (err) {
      toast({
        title: 'تعذّر الحفظ',
        description: err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAction(p: ScheduleProject, action: 'activate' | 'cancel' | 'delete') {
    if (action !== 'activate' && !window.confirm(action === 'cancel' ? 'إلغاء هذه المهمة؟' : 'حذف هذه المسودة نهائياً؟')) {
      return
    }
    setBusy((prev) => ({ ...prev, [p.id]: true }))
    try {
      let res: Response
      if (action === 'delete') {
        res = await fetch(`/api/admin/schedule-projects/${p.id}`, { method: 'DELETE' })
      } else {
        res = await fetch(`/api/admin/schedule-projects/${p.id}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        })
      }
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل الإجراء'))
      toast({ title: 'تم', description: action === 'activate' ? 'فُعّلت المهمة' : action === 'cancel' ? 'أُلغيت المهمة' : 'حُذفت المسودة' })
      load()
    } catch (err) {
      toast({
        title: 'فشل الإجراء',
        description: err instanceof Error ? err.message : 'فشل الإجراء',
        variant: 'destructive',
      })
    } finally {
      setBusy((prev) => ({ ...prev, [p.id]: false }))
    }
  }

  const editable = (p: ScheduleProject) => p.status === 'draft' || p.status === 'scheduled'

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="font-semibold text-foreground text-lg">النشر المجدول</h1>
        <p className="text-[13px] text-muted-foreground">
          كل المهام (موقع + اجتماعي) — {total} مهمة — التعديل قبل الإطلاق فقط
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="space-y-1">
            <Label>الحالة</Label>
            <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
              <SelectTrigger aria-label="الحالة" className="w-36">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {Object.entries(STATUS_AR).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>المنصة</Label>
            <Select value={platform || 'all'} onValueChange={(v) => setPlatform(v === 'all' ? '' : v)}>
              <SelectTrigger aria-label="المنصة" className="w-44">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.arabicLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="owner-filter">المالك (معرّف)</Label>
            <Input
              id="owner-filter"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="user id"
              className="w-44"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-4">
          {loading ? (
            <>
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا مهام مطابقة.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {projects.map((p) => (
                <div key={p.id} className="space-y-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.mod?.name ?? 'بلا مود'}</span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {MODE_AR[p.mode] ?? p.mode}
                    </span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {STATUS_AR[p.status] ?? p.status}
                    </span>
                    {p.mod && (
                      <span className="text-xs text-muted-foreground">
                        {p.mod.game?.platform ?? '—'} · الموقع: {p.mod.workflowStatus}
                      </span>
                    )}
                    {p.post && (
                      <span className="text-xs text-muted-foreground">المنشور: {p.post.status}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    الموقع: {fmtDate(p.sitePublishAt)} · الاجتماعي: {fmtDate(p.socialPublishAt)}
                  </div>
                  {p.error && <p className="text-xs text-red-600">{p.error}</p>}
                  <div className="flex flex-wrap gap-2">
                    {editable(p) && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        تعديل
                      </Button>
                    )}
                    {p.status === 'draft' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(p, 'activate')}
                          disabled={busy[p.id]}
                        >
                          تفعيل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleAction(p, 'delete')}
                          disabled={busy[p.id]}
                        >
                          حذف
                        </Button>
                      </>
                    )}
                    {(p.status === 'scheduled' || p.status === 'running') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleAction(p, 'cancel')}
                        disabled={busy[p.id]}
                      >
                        إلغاء
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">تعديل المهمة (قبل الإطلاق)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>الوضعية</Label>
                <Select value={editMode} onValueChange={setEditMode}>
                  <SelectTrigger aria-label="الوضعية" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="site_only">الموقع فقط</SelectItem>
                    <SelectItem value="social_only">منشور فقط</SelectItem>
                    <SelectItem value="both">الاثنان</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>التاريخ</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>الوقت</Label>
                <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={!editDate || saving} size="sm">
                {saving ? 'جارٍ…' : 'حفظ'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
