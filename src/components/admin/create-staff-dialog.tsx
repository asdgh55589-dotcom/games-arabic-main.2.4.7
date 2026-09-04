'use client'

import { useState } from 'react'
import { Loader2, Key, Copy, Check, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { getRoleLabel } from '@/lib/roles'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function CreateStaffDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [securityKey, setSecurityKey] = useState('')
  const [role, setRole] = useState('moderator')
  const [keyExpiryDays, setKeyExpiryDays] = useState('90')
  const [loading, setLoading] = useState(false)
  const [createdCreds, setCreatedCreds] = useState<{
    username: string
    password: string
    securityKey: string
    role: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const generateKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let k = ''
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    for (let i = 0; i < 16; i++) k += chars[arr[i] % chars.length]
    setSecurityKey(k)
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let p = ''
    const arr = new Uint8Array(12)
    crypto.getRandomValues(arr)
    for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length]
    setPassword(p)
  }

  const reset = () => {
    setUsername('')
    setEmail('')
    setPassword('')
    setSecurityKey('')
    setRole('moderator')
    setKeyExpiryDays('90')
    setCreatedCreds(null)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !password.trim() || !securityKey.trim()) {
      toast({ title: 'جميع الحقول مطلوبة', variant: 'destructive' })
      return
    }
    if (password.length < 8) {
      toast({ title: 'كلمة المرور قصيرة (8 أحرف على الأقل)', variant: 'destructive' })
      return
    }
    if (!/^[a-zA-Z0-9]+$/.test(securityKey) || securityKey.length < 8) {
      toast({
        title: 'مفتاح الأمان يجب أن يكون 8 خانات وأحرف/أرقام إنجليزية فقط',
        variant: 'destructive',
      })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password: password.trim(),
          securityKey: securityKey.trim(),
          role,
          keyExpiryDays,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'فشل الإنشاء')
      setCreatedCreds({
        username: username.trim(),
        password: password.trim(),
        securityKey: securityKey.trim(),
        role,
      })
      toast({
        title: 'تم إنشاء العضو بنجاح',
        description: `${username} بدور ${getRoleLabel(role)}`,
      })
      onCreated()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (o: boolean) => {
    if (!o && createdCreds) reset()
    onOpenChange(o)
  }

  const copyCreds = async () => {
    if (!createdCreds) return
    const text = `اسم المستخدم: ${createdCreds.username}\nالبريد: ${email}\nكلمة المرور: ${createdCreds.password}\nمفتاح الأمان: ${createdCreds.securityKey}\nالدور: ${getRoleLabel(createdCreds.role)}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'تم النسخ' })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
        {!createdCreds ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> تعيين عضو جديد
              </DialogTitle>
              <DialogDescription>
                أدخل 4 بيانات الاعتماد: اسم المستخدم، البريد، كلمة المرور، مفتاح الأمان + الدور ومدة
                الانتهاء.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="c-username">اسم المستخدم *</Label>
                <Input
                  id="c-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="GAAdminAli"
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="c-email">البريد الإلكتروني *</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ali@gamesarabic.com"
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="c-password">كلمة المرور * (8 أحرف على الأقل)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="c-password"
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    توليد
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="c-key">مفتاح الأمان * (8 خانات، أحرف/أرقام إنجليزية)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="c-key"
                    type="text"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="aB3kZ9mQ2xL7pN4w"
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={generateKey} className="gap-1">
                    <Key className="h-4 w-4" /> توليد تلقائي
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الدور *</Label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="member">عضو</option>
                    <option value="creator">مُعَرِّب</option>
                    <option value="publisher">ناشر</option>
                    <option value="moderator">مشرف</option>
                    <option value="admin">مسؤول</option>
                    <option value="manager">مدير</option>
                  </select>
                </div>
                <div>
                  <Label>انتهاء المفتاح</Label>
                  <select
                    value={keyExpiryDays}
                    onChange={(e) => setKeyExpiryDays(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="30">30 يوم</option>
                    <option value="60">60 يوم</option>
                    <option value="90">90 يوم</option>
                    <option value="180">180 يوم</option>
                    <option value="365">365 يوم</option>
                    <option value="بدون">بدون انتهاء</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإنشاء...
                    </>
                  ) : (
                    'إنشاء العضو'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-green-600">
                ✅ تم الإنشاء بنجاح — احفظ البيانات
              </DialogTitle>
              <DialogDescription className="text-destructive font-bold">
                هذه البيانات تظهر مرة واحدة فقط — انسخها الآن وسلّمها للعضو.
              </DialogDescription>
            </DialogHeader>
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="p-4 space-y-3 text-sm" dir="ltr">
                <div>
                  <span className="font-bold">Username:</span> {createdCreds.username}
                </div>
                <div>
                  <span className="font-bold">Email:</span> {email}
                </div>
                <div>
                  <span className="font-bold">Password:</span>{' '}
                  <code className="bg-white px-2 py-1 rounded border">{createdCreds.password}</code>
                </div>
                <div>
                  <span className="font-bold">Security Key:</span>{' '}
                  <code className="bg-white px-2 py-1 rounded border">
                    {createdCreds.securityKey}
                  </code>
                </div>
                <div>
                  <span className="font-bold">Role:</span> {getRoleLabel(createdCreds.role)}
                </div>
              </CardContent>
            </Card>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copyCreds} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} نسخ البيانات
              </Button>
              <Button onClick={() => handleClose(false)}>تم — إغلاق</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
