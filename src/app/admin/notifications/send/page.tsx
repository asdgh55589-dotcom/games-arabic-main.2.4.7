'use client'

import { Loader2, Send, UserCheck, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CHANNEL_ORDER, channelLabel, formatArNumber } from '@/lib/notifications/admin-labels'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'
import { ROLE_LABELS, ROLE_ORDER } from '@/lib/roles'

type Target = 'all' | 'role' | 'users'

export default function SendNotificationPage() {
  const { toast } = useToast()
  const [type, setType] = useState('system_alert')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<string[]>(['in_app'])
  const [target, setTarget] = useState<Target>('all')
  const [role, setRole] = useState<string>('member')
  const [selectedUsers, setSelectedUsers] = useState<PickedUser[]>([])
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PickedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [estimate, setEstimate] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)

  const recipientCount = useMemo(
    () => resolveRecipientCount(target, selectedUsers, estimate),
    [target, selectedUsers, estimate],
  )

  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    )
  }

  const toggleUser = (user: PickedUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    )
  }

  // Recipient estimate for the broad targets. The send route resolves real
  // recipients at POST time, so this is a count for confirmation, not a promise.
  useEffect(() => {
    if (target === 'users') {
      setEstimate(null)
      return
    }
    let cancelled = false
    setEstimating(true)
    const params = new URLSearchParams({ page: '1', limit: '1', banned: 'active' })
    if (target === 'role') params.set('role', role)
    fetch(`/api/admin/users?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled) return
        setEstimate(body?.pagination?.total ?? null)
      })
      .catch(() => {
        if (!cancelled) setEstimate(null)
      })
      .finally(() => {
        if (!cancelled) setEstimating(false)
      })
    return () => {
      cancelled = true
    }
  }, [target, role])

  // Debounced user search for the target picker.
  useEffect(() => {
    if (target !== 'users') return
    const term = search.trim()
    const handle = setTimeout(() => {
      setSearching(true)
      const params = new URLSearchParams({ page: '1', limit: '20' })
      if (term) params.set('search', term)
      fetch(`/api/admin/users?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => setResults(body?.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [search, target])

  const validation = validateSendForm({ type, title, message, channels, target, selectedUsers })

  const sendToRecipients = useCallback(async (body: SendPayload) => {
    const res = await fetch('/api/admin/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await readError(res)
      throw new Error(detail)
    }
    return parseSendResult(await res.json())
  }, [])

  const confirmSend = async () => {
    setSending(true)
    try {
      const payload = buildSendPayload({
        type,
        title,
        message,
        channels,
        target,
        role,
        selectedUsers,
      })
      const result = await sendToRecipients(payload)
      setConfirmOpen(false)
      toast(sentToast(result))
      setTitle('')
      setMessage('')
      setSelectedUsers([])
    } catch (err) {
      toast({
        title: 'تعذّر الإرسال',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  /**
   * Test-to-me: delivers to the signed-in admin only, so an operator can check
   * rendering per channel without touching real users. Uses the send route's
   * `users` target with the current identity from /api/auth/me.
   */
  const testToMe = async () => {
    setTesting(true)
    try {
      const meRes = await fetch('/api/auth/me')
      const meBody = meRes.ok ? await meRes.json() : null
      const meId = meBody?.data?.user?.id as string | undefined
      if (!meId) throw new Error('تعذّر تحديد حسابك الحالي')
      const result = await sendToRecipients({
        type,
        title: title.trim() || 'إشعار تجريبي',
        message: message.trim() || 'هذا إشعار تجريبي أُرسل إلى حسابك فقط.',
        channels,
        target: 'users',
        userIds: [meId],
      })
      toast(sentToast(result))
    } catch (err) {
      toast({
        title: 'تعذّر الإرسال',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">إرسال إشعار</h1>

      <Card>
        <CardHeader>
          <CardTitle>محتوى الإشعار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">النوع</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">العنوان</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الإشعار"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="نص الإشعار"
            />
          </div>

          <div className="space-y-2">
            <Label>القنوات</Label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_ORDER.map((channel) => (
                <Button
                  key={channel}
                  type="button"
                  size="sm"
                  variant={channels.includes(channel) ? 'default' : 'outline'}
                  aria-pressed={channels.includes(channel)}
                  onClick={() => toggleChannel(channel)}
                >
                  {channelLabel(channel)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المستقبِلون</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target">الجمهور</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
              <SelectTrigger id="target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المستخدمين</SelectItem>
                <SelectItem value="role">حسب الدور</SelectItem>
                <SelectItem value="users">مستخدمون محددون</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === 'role' && (
            <div className="space-y-2">
              <Label htmlFor="role">الدور</Label>
              {/* Sourced from the canonical role list so `owner` is selectable. */}
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {target === 'users' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="user-search">البحث عن مستخدم</Label>
                <Input
                  id="user-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="اسم المستخدم أو البريد"
                />
              </div>
              <div
                className="max-h-56 overflow-y-auto rounded-md border"
                role="listbox"
                aria-label="نتائج البحث"
              >
                {searching ? (
                  <p className="p-3 text-sm text-muted-foreground">جارٍ البحث…</p>
                ) : results.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">لا توجد نتائج</p>
                ) : (
                  results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      aria-selected={selectedUsers.some((u) => u.id === user.id)}
                      onClick={() => toggleUser(user)}
                      className="flex w-full items-center justify-between p-3 text-right text-sm hover:bg-muted"
                    >
                      <span>
                        <span className="font-medium">{user.displayName || user.username}</span>
                        <span className="text-muted-foreground"> @{user.username}</span>
                      </span>
                      {selectedUsers.some((u) => u.id === user.id) ? (
                        <UserCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Users className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  ))
                )}
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                    >
                      {user.displayName || user.username}
                      <button
                        type="button"
                        onClick={() => toggleUser(user)}
                        aria-label={`إزالة ${user.displayName || user.username}`}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {estimating
              ? 'جارٍ تقدير عدد المستقبِلين…'
              : recipientCount == null
                ? 'عدد المستقبِلين غير متاح'
                : `عدد المستقبِلين التقريبي: ${formatArNumber(recipientCount)}`}
          </p>

          {validation && (
            <p className="text-sm text-destructive" role="alert">
              {validation}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirmOpen(true)} disabled={Boolean(validation) || sending}>
          <Send className="h-4 w-4" />
          إرسال
        </Button>
        <Button variant="outline" onClick={testToMe} disabled={Boolean(validation) || testing}>
          {testing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          اختبار إلى نفسي
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الإرسال</DialogTitle>
            <DialogDescription>راجع الإشعار والمستقبِلين قبل الإرسال النهائي.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div>
              <span className="text-muted-foreground">النوع: </span>
              {NOTIFICATION_TYPE_LABELS[type] ?? type}
            </div>
            <div>
              <span className="text-muted-foreground">العنوان: </span>
              {title.trim() || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">الرسالة: </span>
              <span className="whitespace-pre-wrap">{message.trim() || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">القنوات: </span>
              {channels.map((c) => channelLabel(c)).join('، ')}
            </div>
            <div>
              <span className="text-muted-foreground">الجمهور: </span>
              {describeAudience(target, role, selectedUsers)}
            </div>
            <div>
              <span className="text-muted-foreground">عدد المستقبِلين: </span>
              {recipientCount == null ? 'غير متاح' : formatArNumber(recipientCount)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              إلغاء
            </Button>
            <Button onClick={confirmSend} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الإرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface PickedUser {
  id: string
  username: string
  displayName: string | null
}

interface SendPayload {
  type: string
  title: string
  message: string
  channels: string[]
  target: Target
  role?: string
  userIds?: string[]
}

/**
 * Exact for the `users` target (we hold the ids), an estimate for the broad
 * targets (the send route re-resolves real recipients at POST time).
 * Returns null when no estimate is available yet so the UI can say so rather
 * than implying zero recipients.
 */
export function resolveRecipientCount(
  target: Target,
  selectedUsers: PickedUser[],
  estimate: number | null,
): number | null {
  if (target === 'users') return selectedUsers.length
  return estimate
}

/** Blocking problems that must stop the send button. Returns null when valid. */
export function validateSendForm(form: {
  type: string
  title: string
  message: string
  channels: string[]
  target: Target
  selectedUsers: PickedUser[]
}): string | null {
  if (!form.title.trim()) return 'العنوان مطلوب'
  if (!form.message.trim()) return 'الرسالة مطلوبة'
  if (form.channels.length === 0) return 'اختر قناة واحدة على الأقل'
  if (form.target === 'users' && form.selectedUsers.length === 0) {
    return 'اختر مستخدمًا واحدًا على الأقل'
  }
  return null
}

export function buildSendPayload(form: {
  type: string
  title: string
  message: string
  channels: string[]
  target: Target
  role: string
  selectedUsers: PickedUser[]
}): SendPayload {
  const base = {
    type: form.type,
    title: form.title.trim(),
    message: form.message.trim(),
    channels: form.channels,
    target: form.target,
  }
  if (form.target === 'role') return { ...base, role: form.role }
  if (form.target === 'users') return { ...base, userIds: form.selectedUsers.map((u) => u.id) }
  return base
}

/**
 * ما حدث فعلاً عند الإرسال — كما تعيده الخدمة، لا كما نتوقّعها.
 *
 * `queued` تعني "مهمة طابور جاهزة" لا "وصلت الرسالة": قنوات مثل البريد
 * وتيليجرام تُسلَّم لاحقاً بواسطة `POST /api/cron/notification-drain`، وقد
 * تُؤجَّل (ساعات الهدوء) أو تفشل ثم تدخل `dead_letter`. لذلك نعرض الرقمين
 * منفصلَين ولا ندّعي التسليم.
 *
 * (P1 أضاف هذا المبدأ حين كان `sent` يساوي عدد المطابقين فقط؛ P2 جعل
 * `queued` حقيقياً عبر cron بدل أن يبقى بلا قارئ.)
 */
export interface SendResult {
  created: number
  skipped: number
  queued: number
  deduplicated: number
}

interface SendResponse {
  data?: {
    created?: unknown
    skipped?: unknown
    queued?: unknown
    deduplicated?: unknown
  }
}

function count(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

/** يقرأ أرقام النتيجة بأمان: حقل غائب أو NaN ⇒ 0، لا `NaN` في الواجهة. */
export function parseSendResult(body: SendResponse | null | undefined): SendResult {
  return {
    created: count(body?.data?.created),
    skipped: count(body?.data?.skipped),
    queued: count(body?.data?.queued),
    deduplicated: count(body?.data?.deduplicated),
  }
}

/** ما لم يُسلَّم فوراً — يُعرض كوصف تحت العنوان بدل ادّعاء التسليم. */
function sentToastNotes(result: SendResult): string[] {
  const notes: string[] = []
  if (result.queued > 0) {
    notes.push(
      `${formatArNumber(result.queued)} رسالة في طابور التسليم — عامل التصريف (cron) هو من أرسلها، ` +
        'وقد تتأجّل لساعات الهدوء أو تدخل dead_letter عند الفشل المتكرر.',
    )
  }
  if (result.skipped > 0) {
    notes.push(`تُخطّي ${formatArNumber(result.skipped)} — لا قناة قابلة للتوصيل لتفضيلاتهم.`)
  }
  if (result.deduplicated > 0) {
    notes.push(`استُبعد ${formatArNumber(result.deduplicated)} بنافذة منع التكرار.`)
  }
  return notes
}

/** عنوان صادق + وصف لما تبقّى. تحذير فقط حين لم يُنشأ ولم يُجدوَل شيء. */
export function sentToast(result: SendResult): {
  title: string
  description?: string
  variant: 'default' | 'destructive'
} {
  const notes = sentToastNotes(result)
  return {
    title: `أُنشئ الإشعار داخل التطبيق لـ ${formatArNumber(result.created)} مستخدم`,
    ...(notes.length > 0 ? { description: notes.join(' ') } : {}),
    variant: result.created === 0 && result.queued === 0 ? 'destructive' : 'default',
  }
}

function describeAudience(target: Target, role: string, selectedUsers: PickedUser[]): string {
  if (target === 'all') return 'كل المستخدمين'
  if (target === 'role') return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role
  if (selectedUsers.length === 0) return 'لم يُختر أي مستخدم'
  return `${formatArNumber(selectedUsers.length)} مستخدم محدد`
}

/**
 * رسالة الخطأ كما يقرؤها مستخدم.
 *
 * عقد `api-response` يُعيد `{ error: { code, message, ... }, problem: {...} }`،
 * لكن أخطاء الوكيل/الشبكة قد تصل كنص. لذا نقرأ `message` من الشكلين وإلا
 * نُظهر رمز الحالة — لا `[object Object]` أمام المستخدم.
 */
async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string | { message?: string }
      message?: string
    }
    const raw = body?.error
    const message = typeof raw === 'string' ? raw : raw?.message || body?.message
    return message || `فشل الإرسال (${res.status})`
  } catch {
    return `فشل الإرسال (${res.status})`
  }
}
