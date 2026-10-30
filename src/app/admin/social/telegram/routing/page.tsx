// DEPRECATED: consolidated into /admin/media
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
 * `/admin/social/telegram/routing` — مصفوفة التوجيه (المرحلة 3).
 *
 * لكل منصة كونسول: قواعدها (الهدف × البوت × الأولوية × مفعّلة؟) +
 * معاينة الاستنتاج «سيُنشر إلى … عبر …» + إضافة/تعديل/حذف +
 * إرسال تجريبي لكل قاعدة. الكتابة manager-only عبر API.
 */

interface RouteRule {
  id: string
  platformKey: string
  targetType: string
  destinationId: string
  botId: string | null
  threadId: number | null
  priority: number
  isDefault: boolean
  isActive: boolean
  validFrom: string | null
  validUntil: string | null
  destination: {
    id: string
    chatId: string
    title: string | null
    chatType: string
    status: string
    archivedAt: string | null
  } | null
  bot: { id: string; label: string; status: string } | null
}

interface Destination {
  id: string
  chatId: string
  title: string | null
  chatType: string
}

interface Bot {
  id: string
  label: string
  botUsername: string | null
  status: string
}

interface PreviewTarget {
  ruleId: string
  chatId: string
  title: string | null
  threadId: number | null
  botId: string | null
  botLabel: string | null
  isDefault: boolean
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

const TARGET_TYPE_AR: Record<string, string> = {
  channel: 'قناة',
  group: 'مجموعة',
  topic: 'موضوع',
}

export default function TelegramRoutingPage() {
  const { toast } = useToast()
  const [platformKey, setPlatformKey] = useState<string>('PS5')
  const [rules, setRules] = useState<RouteRule[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [bots, setBots] = useState<Bot[]>([])
  const [preview, setPreview] = useState<{
    defaultRuleId: string | null
    targets: PreviewTarget[]
    excluded: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const [newDestinationId, setNewDestinationId] = useState('')
  const [newTargetType, setNewTargetType] = useState('channel')
  const [newBotId, setNewBotId] = useState('')
  const [newThread, setNewThread] = useState('')
  const [newPriority, setNewPriority] = useState('0')
  const [newDefault, setNewDefault] = useState(false)
  const [creating, setCreating] = useState(false)

  const [editing, setEditing] = useState<RouteRule | null>(null)
  const [editPriority, setEditPriority] = useState('0')
  const [editActive, setEditActive] = useState(true)
  const [editDefault, setEditDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, dRes, bRes, pRes] = await Promise.all([
        fetch(`/api/admin/social/telegram/routes?platformKey=${platformKey}`),
        fetch('/api/admin/telegram-destinations?verificationStatus=verified'),
        fetch('/api/admin/social/telegram/bots'),
        fetch(`/api/admin/social/telegram/routes/preview?platformKey=${platformKey}`),
      ])
      const rBody = await rRes.json()
      if (!rRes.ok) throw new Error(apiErrorMessage(rBody, 'تعذّر تحميل القواعد'))
      setRules(rBody.data?.rules ?? [])
      const dBody = await dRes.json()
      if (dRes.ok) setDestinations(dBody.data?.destinations ?? [])
      const bBody = await bRes.json()
      if (bRes.ok) setBots(bBody.data?.bots ?? [])
      const pBody = await pRes.json()
      if (pRes.ok) setPreview(pBody.data ?? null)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر التحميل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [platformKey, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate() {
    if (!newDestinationId) return
    setCreating(true)
    try {
      const payload: Record<string, unknown> = {
        platformKey,
        targetType: newTargetType,
        destinationId: newDestinationId,
        botId: newBotId ? newBotId : null,
        threadId: newThread.trim() ? Number(newThread.trim()) : null,
        priority: Number(newPriority) || 0,
        isDefault: newDefault,
      }
      const res = await fetch('/api/admin/social/telegram/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل إنشاء القاعدة'))
      setNewDestinationId('')
      setNewBotId('')
      setNewThread('')
      setNewPriority('0')
      setNewDefault(false)
      toast({ title: 'تم', description: 'أُضيفت قاعدة التوجيه' })
      load()
    } catch (err) {
      toast({
        title: 'تعذّر الإنشاء',
        description: err instanceof Error ? err.message : 'فشل إنشاء القاعدة',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  function openEdit(rule: RouteRule) {
    setEditing(rule)
    setEditPriority(String(rule.priority))
    setEditActive(rule.isActive)
    setEditDefault(rule.isDefault)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/social/telegram/routes/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: Number(editPriority) || 0,
          isActive: editActive,
          isDefault: editDefault,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل حفظ القاعدة'))
      setEditing(null)
      toast({ title: 'تم', description: 'حُفظت القاعدة' })
      load()
    } catch (err) {
      toast({
        title: 'تعذّر الحفظ',
        description: err instanceof Error ? err.message : 'فشل حفظ القاعدة',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rule: RouteRule) {
    if (!window.confirm(`حذف قاعدة التوجيه لمنصة ${rule.platformKey}؟`)) return
    setBusy((prev) => ({ ...prev, [rule.id]: true }))
    try {
      const res = await fetch(`/api/admin/social/telegram/routes/${rule.id}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل الحذف'))
      toast({ title: 'تم', description: 'حُذفت القاعدة' })
      load()
    } catch (err) {
      toast({
        title: 'فشل الحذف',
        description: err instanceof Error ? err.message : 'فشل الحذف',
        variant: 'destructive',
      })
    } finally {
      setBusy((prev) => ({ ...prev, [rule.id]: false }))
    }
  }

  async function handleTest(rule: RouteRule) {
    setBusy((prev) => ({ ...prev, [rule.id]: true }))
    try {
      const res = await fetch(`/api/admin/social/telegram/routes/${rule.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'فشل الإرسال التجريبي'))
      toast({
        title: 'وصلت',
        description: `رسالة الاختبار أُرسلت (message_id=${body.data.messageId ?? '؟'})`,
      })
    } catch (err) {
      toast({
        title: 'فشل الاختبار',
        description: err instanceof Error ? err.message : 'فشل الإرسال التجريبي',
        variant: 'destructive',
      })
    } finally {
      setBusy((prev) => ({ ...prev, [rule.id]: false }))
    }
  }

  const platformLabel = (key: string) => PLATFORMS.find((p) => p.key === key)?.arabicLabel ?? key

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="font-semibold text-foreground text-lg">توجيه النشر</h1>
        <p className="text-[13px] text-muted-foreground">
          لكل منصة ألعاب: أهدافها (قناة/مجموعة/موضوع) والبوت المسؤول — مع معاينة الاستنتاج
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">المنصة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={platformKey === p.key ? 'default' : 'outline'}
                onClick={() => setPlatformKey(p.key)}
              >
                {p.arabicLabel}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm">
            <span className="font-medium">سيُنشر {platformLabel(platformKey)} إلى: </span>
            {preview.targets.length === 0 ? (
              <span className="text-muted-foreground">لا أهداف نشطة — أضف قاعدة أدناه</span>
            ) : (
              preview.targets.map((t) => (
                <span key={t.ruleId} className="mr-2 rounded bg-background px-2 py-0.5 text-xs">
                  {t.title || t.chatId}
                  {t.threadId != null ? ` (موضوع ${t.threadId})` : ''} عبر{' '}
                  {t.botLabel ?? 'الافتراضي'}
                  {t.ruleId === preview.defaultRuleId ? ' ★' : ''}
                </span>
              ))
            )}
            {preview.excluded > 0 && (
              <span className="mr-2 text-xs text-muted-foreground">
                ({preview.excluded} مستبعدة: معطلة/مؤرشفة/غير موثقة)
              </span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            قواعد {platformLabel(platformKey)} ({rules.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1">
              <Label>الوجهة (موثقة فقط)</Label>
              <Select
                value={newDestinationId || 'none'}
                onValueChange={(v) => setNewDestinationId(v === 'none' ? '' : v)}
              >
                <SelectTrigger aria-label="الوجهة">
                  <SelectValue placeholder="اختر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {destinations.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.title || d.chatId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>النوع</Label>
              <Select value={newTargetType} onValueChange={setNewTargetType}>
                <SelectTrigger aria-label="النوع">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="channel">قناة</SelectItem>
                  <SelectItem value="group">مجموعة</SelectItem>
                  <SelectItem value="topic">موضوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>البوت</Label>
              <Select
                value={newBotId || 'none'}
                onValueChange={(v) => setNewBotId(v === 'none' ? '' : v)}
              >
                <SelectTrigger aria-label="البوت">
                  <SelectValue placeholder="وراثة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">وراثة (الوجهة ← الافتراضي)</SelectItem>
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
              <Label>الموضوع</Label>
              <Input
                value={newThread}
                onChange={(e) => setNewThread(e.target.value)}
                placeholder="للنوع موضوع"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label>الأولوية</Label>
              <Input
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex cursor-pointer items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={newDefault}
                  onChange={(e) => setNewDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                افتراضية
              </label>
              <Button onClick={handleCreate} disabled={!newDestinationId || creating} size="sm">
                {creating ? 'جارٍ…' : 'إضافة'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا قواعد لهذه المنصة بعد.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {rules.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="font-medium">
                    {r.destination?.title || r.destination?.chatId}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                    {TARGET_TYPE_AR[r.targetType] ?? r.targetType}
                  </span>
                  {r.threadId != null && (
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                      موضوع {r.threadId}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {r.bot?.label ?? 'وراثة'} · أولوية {r.priority}
                  </span>
                  {r.isDefault && (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      افتراضية ★
                    </span>
                  )}
                  {!r.isActive && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      معطلة
                    </span>
                  )}
                  <span className="mr-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTest(r)}
                      disabled={busy[r.id]}
                    >
                      {busy[r.id] ? 'جارٍ…' : 'اختبار'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => handleDelete(r)}
                      disabled={busy[r.id]}
                    >
                      حذف
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">تعديل القاعدة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>الأولوية</Label>
                <Input
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  inputMode="numeric"
                  className="w-28"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4"
                />
                مفعّلة
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editDefault}
                  onChange={(e) => setEditDefault(e.target.checked)}
                  className="h-4 w-4"
                />
                افتراضية المنصة
              </label>
              <Button onClick={handleSave} disabled={saving} size="sm">
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
