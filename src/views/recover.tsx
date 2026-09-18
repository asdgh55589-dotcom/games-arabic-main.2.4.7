'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function RecoverPage() {
  useDocumentTitle('استعادة كلمة المرور')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    setSaving(true)
    try {
      await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      }).catch(() => null)
      // Generic either way (anti-enumeration) — always show the same message.
      setSent(true)
    } finally {
      setSaving(false)
    }
  }

  if (sent) {
    return (
      <div dir="rtl" className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold">تحقق من بريدك</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          إن كان البريد مسجلاً لدينا، وصلك رابط الاستعادة (صالح لساعة واحدة)
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = '/login')}>
          إلى الدخول
        </Button>
      </div>
    )
  }

  return (
    <div dir="rtl" className="mx-auto max-w-md space-y-4 px-4 py-10">
      <h1 className="text-xl font-bold">استعادة كلمة المرور</h1>
      <p className="text-sm text-muted-foreground">أدخل بريدك وسنرسل لك رابط التعيين</p>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="rc-email">
          البريد الإلكتروني
        </label>
        <Input
          id="rc-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mail.com"
          dir="ltr"
          className="text-left"
        />
      </div>
      <Button className="w-full" disabled={saving || !email.includes('@')} onClick={submit}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال رابط الاستعادة'}
      </Button>
      <p className="text-xs text-muted-foreground">
        دخلت بتيليجرام بدون بريد إلكتروني وفقدت الوصول؟ تواصل مع الدعم مع إثبات ملكية الحساب
        (اسم المستخدم + تاريخ التقارب) — يمكن للإدارة إصدار كلمة مرور مؤقتة لك.
      </p>
    </div>
  )
}
