'use client'

import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

/**
 * قنوات الإرسال من لوحة الإدارة.
 *
 * `in_app` فقط هو قناة تعمل فعلياً: `sendNotification()` يكتب صف `Notification`
 * لكل مستلم. أما `email` و`telegram` فغير موصولتين من طرف إلى طرف:
 *  - `processNotificationQueue()` بلا أي مستدعٍ (لا cron ولا أمر).
 *  - `processEmailJob()` دالة فارغة تُعلّم المهمة `sent` بلا إرسال.
 *  - `processTelegramJob()` تعود مبكراً غالباً بلا إرسال.
 *
 * تفعيلها الآن يعني إنشاء مهام `pending` لا يقرأها أحد بينما الواجهة تقول "تم الإرسال",
 * لذلك معطّلة حتى يصل عامل المعالجة والمرسل الحقيقي (P2).
 */
const CHANNEL_OPTIONS = [
  { value: 'in_app', label: 'داخل التطبيق', enabled: true },
  { value: 'email', label: 'بريد', enabled: false },
  { value: 'telegram', label: 'Telegram', enabled: false },
] as const

const ENABLED_CHANNELS = CHANNEL_OPTIONS.filter((c) => c.enabled).map((c) => c.value)

export default function SendNotificationPage() {
  const { toast } = useToast()
  const [target, setTarget] = useState<'all' | 'role' | 'users'>('all')
  const [role, setRole] = useState('member')
  const [type, setType] = useState('system_alert')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [channels, setChannels] = useState<string[]>(['in_app'])
  const [isLoading, setIsLoading] = useState(false)

  const toggleChannel = (c: string) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'العنوان والرسالة مطلوبان', variant: 'destructive' })
      return
    }
    if (channels.length === 0) {
      toast({ title: 'اختر قناة واحدة على الأقل', variant: 'destructive' })
      return
    }
    setIsLoading(true)
    // حماية إضافية: لا تُرسل إلا القنوات المفعّلة فعلياً حتى لو عُبّئت الحالة بطريقة ما
    const selected = channels.filter((c) => (ENABLED_CHANNELS as readonly string[]).includes(c))
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          role,
          type,
          title,
          message,
          channels: selected.length > 0 ? selected : ['in_app'],
        }),
      })
      const data = await res.json()
      if (res.ok) {
        // `data.data.sent` كان يساوي عدد المستخدمين المطابقين فقط، وليس عدد ما
        // أُنشئ. الآن نعرض الأرقام التي تعيدها الخدمة فعلياً.
        const created = Number(data?.data?.created ?? 0)
        const skipped = Number(data?.data?.skipped ?? 0)
        const queued = Number(data?.data?.queued ?? 0)
        toast({
          title: `تم إنشاء الإشعار داخل التطبيق لـ ${created} مستخدم${
            skipped > 0 ? ` (تم تخطي ${skipped} حسب التفضيلات)` : ''
          }`,
          description:
            queued > 0
              ? `${queued} إشعار بقي في قائمة الانتظار — قنوات البريد وTelegram غير مفعّلة ولا يوجد عامل إرسال.`
              : undefined,
          variant: queued > 0 ? 'destructive' : 'default',
        })
        setTitle('')
        setMessage('')
      } else {
        const errBody = (data as { error?: string | { message?: string } })?.error
        toast({
          title: (typeof errBody === 'string' ? errBody : errBody?.message) || 'فشل الإرسال',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'خطأ في الاتصال', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <Send className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">إرسال إشعار يدوي</h1>
          <p className="text-sm text-muted-foreground">إرسال إشعار جماعي للمستخدمين</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تفاصيل الإشعار</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>المستلمون</Label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as never)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">جميع المستخدمين</option>
              <option value="role">رتبة محددة</option>
            </select>
          </div>

          {target === 'role' && (
            <div>
              <Label>الرتبة</Label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="member">عضو</option>
                <option value="creator">مُعَرِّب</option>
                <option value="publisher">ناشر</option>
                <option value="moderator">مشرف</option>
                <option value="admin">مسؤول</option>
                <option value="manager">مدير</option>
              </select>
            </div>
          )}

          <div>
            <Label>نوع الإشعار</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label as string}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>القنوات</Label>
            <div className="mt-1 flex flex-wrap gap-3">
              {CHANNEL_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-1.5 text-sm ${
                    option.enabled ? '' : 'text-muted-foreground'
                  }`}
                  title={option.enabled ? option.label : `${option.label} — معطلة مؤقتا`}
                >
                  <input
                    type="checkbox"
                    checked={option.enabled && channels.includes(option.value)}
                    disabled={!option.enabled}
                    onChange={() => toggleChannel(option.value)}
                    className="rounded"
                  />
                  {option.label}
                  {!option.enabled && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      معطلة مؤقتا
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              قناة البريد وTelegram معطلة مؤقتاً: لا يوجد عامل معالجة يقرأ المهام، لذا يُنشأ الإشعار
              داخل التطبيق فقط.
            </p>
          </div>

          <div>
            <Label>العنوان</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الإشعار"
              className="mt-1"
            />
          </div>

          <div>
            <Label>الرسالة</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="نص الإشعار..."
              className="mt-1"
            />
          </div>

          <Button onClick={handleSend} disabled={isLoading} className="w-full min-h-[44px]">
            {isLoading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="ml-2 h-4 w-4" /> إرسال الإشعار
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
