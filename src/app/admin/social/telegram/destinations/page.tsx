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

/**
 * `/admin/social/telegram/destinations` — إدارة وجهات تليجرام (المرحلة 1).
 *
 * قائمة بفلتر النوع (قناة/مجموعة/خارقة) + إنشاء (وجهة/بوت/موضوع) +
 * تعديل + توثيق (إصدار/فحص/يدوي) + فحص صحة + أرشفة ناعمة مع إعادة ربط.
 * كل الكتابة manager-only عبر API — الصفحة تعرض رسائل الخادم العربية.
 */

interface Destination {
  id: string
  chatId: string
  chatType: string
  username: string | null
  title: string | null
  status: string
  verificationStatus: string
  isDefault: boolean
  botId: string | null
  messageThreadId: number | null
  postCount: number
  lastHealthAt: string | null
  lastHealthError: string | null
  archivedAt: string | null
  notes: string | null
  readiness: { ready: boolean; reason: string }
}

interface Bot {
  id: string
  label: string
  botUsername: string | null
  status: string
}

const CHAT_TYPE_AR: Record<string, string> = {
  channel: 'قناة',
  group: 'مجموعة',
  supergroup: 'مجموعة خارقة',
  private: 'خاص',
  bot: 'بوت',
  unknown: 'غير معروف',
}

const STATUS_AR: Record<string, string> = {
  pending: 'معلقة',
  active: 'نشطة',
  disabled: 'معطلة',
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

export default function TelegramDestinationsPage() {
  const { toast } = useToast()
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)

  const [chatType, setChatType] = useState('')
  const [status, setStatus] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)

  const [newChatId, setNewChatId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBotId, setNewBotId] = useState('')
  const [newThread, setNewThread] = useState('')
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<Destination | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editBotId, setEditBotId] = useState('')
  const [editThread, setEditThread] = useState('')
  const [editDefault, setEditDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const [issuedToken, setIssuedToken] = useState<{ id: string; token: string } | null>(null)
  const [checkToken, setCheckToken] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (chatType) params.set('chatType', chatType)
      if (status) params.set('status', status)
      if (includeArchived) params.set('includeArchived', 'true')
      const [dRes, bRes] = await Promise.all([
        fetch(`/api/admin/telegram-destinations?${params}`),
        fetch('/api/admin/social/telegram/bots'),
      ])
      const dBody = await dRes.json()
      const bBody = await bRes.json()
      if (!dRes.ok) throw new Error(apiErrorMessage(dBody, 'تعذّر تحميل الوجهات'))
      setDestinations(dBody.data?.destinations ?? [])
      if (bRes.ok) setBots(bBody.data?.bots ?? [])
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر تحميل الوجهات',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [chatType, status, includeArchived, toast])

  useEffect(() => {
    load()
  }, [load])

  const setRowBusy = (id: string, value: boolean) => setBusy((prev) => ({ ...prev, [id]: value }))

  async function handleCreate() {
    if (!newChatId.trim()) return
    setCreating(true)
    try {
      const payload: Record<string, unknown> = { chatId: newChatId.trim() }
      if (newTitle.trim()) payload.title = newTitle.trim()
      if (newBotId) payload.botId = newBotId
      if (newThread.trim()) payload.messageThreadId = Number(newThread.trim())
      const res = await fetch('/api/admin/telegram-destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل إنشاء الوجهة'))
      setNewChatId('')
      setNewTitle('')
      setNewBotId('')
      setNewThread('')
      toast({ title: 'تم', description: 'أُضيفت الوجهة — وثّقها ثم فعّلها' })
      load()
    } catch (err) {
      toast({
        title: 'تعذّر الإنشاء',
        description: err instanceof Error ? err.message : 'فشل إنشاء الوجهة',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  function openEdit(d: Destination) {
    setEditing(d)
    setEditTitle(d.title ?? '')
    setEditStatus(d.status)
    setEditBotId(d.botId ?? '')
    setEditThread(d.messageThreadId != null ? String(d.messageThreadId) : '')
    setEditDefault(d.isDefault)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: editTitle.trim() ? editTitle.trim() : null,
        status: editStatus,
        botId: editBotId ? editBotId : null,
        messageThreadId: editThread.trim() ? Number(editThread.trim()) : null,
        isDefault: editDefault,
      }
      const res = await fetch(`/api/admin/telegram-destinations/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل حفظ الوجهة'))
      setEditing(null)
      toast({ title: 'تم', description: 'حُفظت الوجهة' })
      load()
    } catch (err) {
      toast({
        title: 'تعذّر الحفظ',
        description: err instanceof Error ? err.message : 'فشل حفظ الوجهة',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleVerify(id: string, action: 'issue' | 'check' | 'manual') {
    setRowBusy(id, true)
    try {
      const payload: Record<string, unknown> = { action }
      if (action === 'check') {
        const token = (checkToken[id] ?? '').trim()
        if (!token) {
          toast({
            title: 'تنبيه',
            description: 'الصق الرمز أولاً ثم اضغط فحص',
            variant: 'destructive',
          })
          return
        }
        payload.token = token
      }
      const res = await fetch(`/api/admin/telegram-destinations/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل التحقق'))
      if (action === 'issue') {
        setIssuedToken({ id, token: body.data.token })
        toast({ title: 'تم', description: 'ضَع الرمز في وصف الوجهة ثم الصقه أدناه واضغط فحص' })
      } else {
        setIssuedToken(null)
        toast({ title: 'تم التوثيق', description: 'الوجهة موثّقة الآن' })
        load()
      }
    } catch (err) {
      toast({
        title: 'فشل التحقق',
        description: err instanceof Error ? err.message : 'فشل التحقق',
        variant: 'destructive',
      })
    } finally {
      setRowBusy(id, false)
    }
  }

  async function handleHealth(id: string) {
    setRowBusy(id, true)
    try {
      const res = await fetch(`/api/admin/telegram-destinations/${id}/health`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل فحص الصحة'))
      if (body.data.healthy) {
        toast({ title: 'سليمة', description: `البوت ${body.data.memberStatus} ويستطيع النشر` })
      } else {
        toast({
          title: 'غير سليمة',
          description: body.data.error ?? 'راجع التفاصيل',
          variant: 'destructive',
        })
      }
      load()
    } catch (err) {
      toast({
        title: 'فشل الفحص',
        description: err instanceof Error ? err.message : 'فشل فحص الصحة',
        variant: 'destructive',
      })
    } finally {
      setRowBusy(id, false)
    }
  }

  async function handleArchive(d: Destination) {
    if (
      !window.confirm(
        `أرشفة «${d.title || d.chatId}»؟ ستُعطَّل وتُخفى عن القوائم، مع إعادة ربط منشوراتها المجدولة للافتراضية إن وُجدت.`,
      )
    ) {
      return
    }
    setRowBusy(d.id, true)
    try {
      const res = await fetch(`/api/admin/telegram-destinations/${d.id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل الأرشفة'))
      const { relinked, frozen, warning } = body.data ?? {}
      toast({
        title: 'أُرشفت الوجهة',
        description: warning ?? `أُعيد ربط ${relinked ?? 0} منشوراً مجدولاً`,
        variant: frozen > 0 ? 'destructive' : 'default',
      })
      load()
    } catch (err) {
      toast({
        title: 'فشلت الأرشفة',
        description: err instanceof Error ? err.message : 'فشلت الأرشفة',
        variant: 'destructive',
      })
    } finally {
      setRowBusy(d.id, false)
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="font-semibold text-foreground text-lg">وجهات تليجرام</h1>
        <p className="text-[13px] text-muted-foreground">
          القنوات والمجموعات والمواضيع — التوثيق والصحة والأرشفة من مكان واحد
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">إضافة وجهة</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-chat">المعرّف (رقم أو @username)</Label>
            <Input
              id="new-chat"
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              placeholder="-1001234567890 أو @channel"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="new-title">الاسم (اختياري)</Label>
            <Input
              id="new-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="قناة الأخبار"
            />
          </div>
          <div className="space-y-1">
            <Label>البوت (اختياري)</Label>
            <Select
              value={newBotId || 'none'}
              onValueChange={(v) => setNewBotId(v === 'none' ? '' : v)}
            >
              <SelectTrigger aria-label="البوت" className="w-44">
                <SelectValue placeholder="الافتراضي" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">الافتراضي العام</SelectItem>
                {bots
                  .filter((b) => b.status === 'active')
                  .map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-thread">الموضوع (اختياري)</Label>
            <Input
              id="new-thread"
              value={newThread}
              onChange={(e) => setNewThread(e.target.value)}
              placeholder="1"
              inputMode="numeric"
              className="w-28"
            />
          </div>
          <Button onClick={handleCreate} disabled={!newChatId.trim() || creating}>
            {creating ? 'جارٍ…' : 'إضافة'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">الوجهات ({destinations.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>النوع</Label>
              <Select
                value={chatType || 'all'}
                onValueChange={(v) => setChatType(v === 'all' ? '' : v)}
              >
                <SelectTrigger aria-label="فلتر النوع" className="w-40">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="channel">قناة</SelectItem>
                  <SelectItem value="group">مجموعة</SelectItem>
                  <SelectItem value="supergroup">مجموعة خارقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>الحالة</Label>
              <Select
                value={status || 'all'}
                onValueChange={(v) => setStatus(v === 'all' ? '' : v)}
              >
                <SelectTrigger aria-label="فلتر الحالة" className="w-36">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">معلقة</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="disabled">معطلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="h-4 w-4"
              />
              إظهار المؤرشفة
            </label>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا وجهات مطابقة — أضف وجهة من الأعلى.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {destinations.map((d) => (
                <div key={d.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.title || d.chatId}</span>
                    <span className="text-xs text-muted-foreground" dir="ltr">
                      {d.chatId}
                    </span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {CHAT_TYPE_AR[d.chatType] ?? d.chatType}
                    </span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      {STATUS_AR[d.status] ?? d.status}
                    </span>
                    {d.verificationStatus === 'verified' ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        موثّقة
                      </span>
                    ) : (
                      <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                        غير موثّقة
                      </span>
                    )}
                    {d.isDefault && (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        افتراضية
                      </span>
                    )}
                    {d.messageThreadId != null && (
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                        موضوع {d.messageThreadId}
                      </span>
                    )}
                    {d.archivedAt && (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        مؤرشفة
                      </span>
                    )}
                    {d.postCount > 0 && (
                      <span className="text-xs text-muted-foreground">{d.postCount} منشوراً</span>
                    )}
                  </div>
                  {d.lastHealthError && (
                    <p className="text-xs text-red-600">آخر فحص: {d.lastHealthError}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(d)}
                      disabled={!!d.archivedAt}
                    >
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(d.id, 'issue')}
                      disabled={busy[d.id] || !!d.archivedAt}
                    >
                      إصدار رمز
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(d.id, 'manual')}
                      disabled={busy[d.id] || !!d.archivedAt}
                    >
                      توثيق يدوي
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleHealth(d.id)}
                      disabled={busy[d.id] || !!d.archivedAt}
                    >
                      {busy[d.id] ? 'جارٍ…' : 'فحص الصحة'}
                    </Button>
                    {!d.archivedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleArchive(d)}
                        disabled={busy[d.id]}
                      >
                        أرشفة
                      </Button>
                    )}
                  </div>
                  {issuedToken?.id === d.id && (
                    <div className="space-y-2 rounded-lg border border-dashed p-2">
                      <p className="text-xs">الصق هذا الرمز في وصف الوجهة على تليجرام:</p>
                      <code className="block break-all rounded bg-muted p-2 text-xs" dir="ltr">
                        {issuedToken.token}
                      </code>
                      <div className="flex gap-2">
                        <Input
                          value={checkToken[d.id] ?? ''}
                          onChange={(e) =>
                            setCheckToken((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          placeholder="الصق الرمز هنا بعد وضعه في الوصف"
                          dir="ltr"
                        />
                        <Button size="sm" onClick={() => handleVerify(d.id, 'check')}>
                          فحص الرمز
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">تعديل: {editing.title || editing.chatId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>الاسم</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label>الحالة</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger aria-label="الحالة" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">معلقة</SelectItem>
                    <SelectItem value="active">نشطة</SelectItem>
                    <SelectItem value="disabled">معطلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>البوت</Label>
                <Select
                  value={editBotId || 'none'}
                  onValueChange={(v) => setEditBotId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger aria-label="البوت" className="w-44">
                    <SelectValue placeholder="الافتراضي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">الافتراضي العام</SelectItem>
                    {bots.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                        {b.status !== 'active' ? ' (معطل)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الموضوع (للمجموعات الخارقة فقط)</Label>
                <Input
                  value={editThread}
                  onChange={(e) => setEditThread(e.target.value)}
                  placeholder="اتركه فارغاً بلا موضوع"
                  inputMode="numeric"
                  className="w-40"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 self-end text-sm">
                <input
                  type="checkbox"
                  checked={editDefault}
                  onChange={(e) => setEditDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                وجهة افتراضية
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'جارٍ الحفظ…' : 'حفظ'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
