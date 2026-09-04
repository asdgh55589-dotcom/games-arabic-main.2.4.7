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
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, role, type, title, message, channels }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: `تم إرسال الإشعار إلى ${data.data.sent} مستخدم` })
        setTitle('')
        setMessage('')
      } else {
        toast({ title: data.error || 'فشل الإرسال', variant: 'destructive' })
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
            <div className="mt-1 flex gap-2">
              {(['in_app', 'email', 'telegram'] as const).map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                    className="rounded"
                  />
                  {c === 'in_app' ? 'داخل التطبيق' : c === 'email' ? 'بريد' : 'Telegram'}
                </label>
              ))}
            </div>
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
