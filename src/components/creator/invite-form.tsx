'use client'

import { useState } from 'react'
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

interface InviteFormProps {
  onCreated: () => void
}

const ROLES = [
  { value: 'translator', label: 'مترجم' },
  { value: 'moderator', label: 'مشرف الفريق' },
  { value: 'member', label: 'عضو' },
  { value: 'admin', label: 'إداري' },
  { value: 'tester', label: 'مختبر' },
] as const

export function InviteForm({ onCreated }: InviteFormProps) {
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('translator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oneTimeLink, setOneTimeLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async () => {
    setSaving(true)
    setError(null)
    setOneTimeLink(null)
    setCopied(false)
    try {
      const res = await fetch('/api/creator/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(username.trim() ? { username: username.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          role,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setOneTimeLink(json.data?.acceptUrl ?? null)
        setUsername('')
        setEmail('')
        toast({ title: 'تم إنشاء الدعوة — انسخ الرابط الآن، لن يظهر مرة أخرى' })
        onCreated()
      } else {
        const msg = json?.error?.message || 'فشل إنشاء الدعوة'
        setError(msg)
        toast({ title: msg, variant: 'destructive' })
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setSaving(false)
  }

  const copyLink = async () => {
    if (!oneTimeLink) return
    try {
      await navigator.clipboard.writeText(oneTimeLink)
      setCopied(true)
    } catch {
      toast({ title: 'تعذر النسخ التلقائي — انسخ الرابط يدوياً', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>دعوة عضو جديد</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invite-username">اسم المستخدم</Label>
            <Input
              id="invite-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              dir="ltr"
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">أو البريد الإلكتروني</Label>
            <Input
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@mail.com"
              dir="ltr"
              maxLength={200}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>الدور</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-48" aria-label="دور المدعو">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {oneTimeLink && (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">رابط الدعوة (يظهر مرة واحدة فقط):</p>
            <p className="break-all text-xs text-muted-foreground" dir="ltr">
              {oneTimeLink}
            </p>
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </Button>
          </div>
        )}
        <Button onClick={submit} disabled={saving || (!username.trim() && !email.trim())}>
          {saving ? 'جارٍ الإنشاء...' : 'إنشاء الدعوة'}
        </Button>
      </CardContent>
    </Card>
  )
}
