'use client'

import { useState } from 'react'
import { Loader2, Key } from 'lucide-react'
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
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  username: string
  onUpdated: () => void
}

export function EditCredentialsDialog({ open, onOpenChange, userId, username, onUpdated }: Props) {
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [securityKey, setSecurityKey] = useState('')
  const [keyExpiryDays, setKeyExpiryDays] = useState('')
  const [loading, setLoading] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password && !securityKey && !keyExpiryDays) {
      toast({ title: 'اختر حقلاً واحداً على الأقل للتحديث', variant: 'destructive' })
      return
    }
    if (password && password.length < 8) {
      toast({ title: 'كلمة المرور قصيرة', variant: 'destructive' })
      return
    }
    if (securityKey && (!/^[a-zA-Z0-9]+$/.test(securityKey) || securityKey.length < 8)) {
      toast({ title: 'مفتاح الأمان غير صالح', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const payload: any = {}
      if (password) payload.password = password
      if (securityKey) payload.securityKey = securityKey
      if (keyExpiryDays) payload.keyExpiryDays = keyExpiryDays

      const res = await fetch(`/api/admin/admins/${userId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message || data?.error || 'فشل التحديث')
      if (securityKey) setNewKey(securityKey)
      toast({ title: 'تم التحديث بنجاح' })
      onUpdated()
      if (!securityKey) {
        onOpenChange(false)
        setPassword('')
        setSecurityKey('')
        setKeyExpiryDays('')
      }
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
    if (!o) {
      setNewKey(null)
      setPassword('')
      setSecurityKey('')
      setKeyExpiryDays('')
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="max-w-lg">
        {!newKey ? (
          <>
            <DialogHeader>
              <DialogTitle>تعديل بيانات الاعتماد — {username}</DialogTitle>
              <DialogDescription>
                غيّر كلمة المرور، جدّد مفتاح الأمان، أو عدّل مدة الانتهاء. المفاتيح القديمة ستُبطل.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label>كلمة المرور الجديدة (اختياري)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="اتركه فارغاً لعدم التغيير"
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={generatePassword}>
                    توليد
                  </Button>
                </div>
              </div>
              <div>
                <Label>مفتاح الأمان الجديد (اختياري)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    placeholder="اتركه فارغاً لعدم التغيير"
                    className="flex-1"
                    dir="ltr"
                  />
                  <Button type="button" variant="outline" onClick={generateKey} className="gap-1">
                    <Key className="h-4 w-4" /> توليد
                  </Button>
                </div>
              </div>
              <div>
                <Label>مدة انتهاء المفتاح</Label>
                <select
                  value={keyExpiryDays}
                  onChange={(e) => setKeyExpiryDays(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">— بدون تغيير —</option>
                  <option value="30">30 يوم</option>
                  <option value="60">60 يوم</option>
                  <option value="90">90 يوم</option>
                  <option value="180">180 يوم</option>
                  <option value="365">365 يوم</option>
                  <option value="بدون">بدون انتهاء</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري...
                    </>
                  ) : (
                    'حفظ التغييرات'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-green-600">✅ تم التجديد — احفظ المفتاح</DialogTitle>
              <DialogDescription className="text-destructive">
                المفتاح القديم أُبطل — انسخ الجديد الآن.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-green-50 p-4 text-center" dir="ltr">
              <div className="text-xs text-muted-foreground">مفتاح الأمان الجديد لـ {username}</div>
              <code className="text-lg font-bold tracking-wider">{newKey}</code>
            </div>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>تم — إغلاق</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
