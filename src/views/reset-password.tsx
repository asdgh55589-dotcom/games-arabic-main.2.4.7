'use client'

import { Loader2 } from 'lucide-react'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useToast } from '@/hooks/use-toast'

function ResetPasswordForm() {
  useDocumentTitle('تعيين كلمة مرور جديدة')
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        toast({
          title: 'تعذّر التعيين',
          description: j?.error?.message || j?.error || 'الرابط غير صالح أو منتهي — اطلب رابطاً جديداً',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'تم بنجاح', description: 'تم تعيين كلمة المرور الجديدة — سجّل دخولك بها' })
      setDone(true)
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <div dir="rtl" className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold">رابط غير صالح</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">اطلب رابط استعادة جديداً من صفحة الدخول</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => (window.location.href = '/login')}>
          إلى الدخول
        </Button>
      </div>
    )
  }

  if (done) {
    return (
      <div dir="rtl" className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold">تم تعيين كلمة المرور</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">سجّل دخولك بالكلمة الجديدة</p>
        <Button className="mt-6 min-h-[44px]" onClick={() => (window.location.href = '/login')}>
          إلى الدخول
        </Button>
      </div>
    )
  }

  const valid = password.length >= 8 && password === confirm

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-bold">تعيين كلمة مرور جديدة</h1>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="rp-pass">
          كلمة المرور (٨ أحرف على الأقل)
        </label>
        <Input
          id="rp-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          dir="ltr"
          className="text-left"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="rp-pass2">
          تأكيد كلمة المرور
        </label>
        <Input
          id="rp-pass2"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          dir="ltr"
          className="text-left"
        />
      </div>
      <Button className="w-full min-h-[44px]" disabled={!valid || saving} onClick={submit}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تعيين'}
      </Button>
    </div>
  )
}

export function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
