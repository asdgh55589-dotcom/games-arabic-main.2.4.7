'use client'

import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

function isSyntheticEmail(email: string | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@telegram.local')
}

/**
 * P0-flexible: optional security setup for OAuth-only users.
 * Rendered in Settings → Account while the user needs security setup.
 *
 * - Password AND email are individually OPTIONAL — set either, both, or skip.
 * - Skipping is implicit (do nothing): the site keeps working, the reminder
 *   banner persists until setup completes.
 * - Password block is hidden once a credential exists (change-password owns it).
 * - Email block is shown only for synthetic Telegram identities (provider-
 *   verified emails stay immutable).
 */
export function SetupPasswordCard() {
  const { user, refresh: refreshAuth } = useAuth()
  const { toast } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const hasPw = user?.hasPassword === true
  const needsEmail = isSyntheticEmail(user?.email)
  const emailVerified = user?.emailVerified === true
  const showStatus = !needsEmail && !!user?.email
  const canSubmit =
    !busy && (password.length > 0 || (needsEmail && email.trim().length > 0))

  function readError(j: unknown, fallback: string): string {
    const d = j as
      | { error?: string | { message?: string; details?: Record<string, string> } }
      | null
      | undefined
    const e = d?.error
    if (typeof e === 'string') return e
    return (e?.details ? Object.values(e.details)[0] : e?.message) || fallback
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, string> = {}
      if (password) {
        body.password = password
        body.confirmPassword = confirmPassword
      }
      if (needsEmail && email.trim()) body.email = email.trim()
      const res = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readError(j, 'فشل الحفظ'))
        return
      }
      if ((j as { data?: { needsVerification?: boolean } })?.data?.needsVerification) {
        setNotice('تم إرسال رابط التحقق إلى بريدك الإلكتروني — تحقق منه خلال ٢٤ ساعة.')
      }
      toast({ title: 'تم حفظ بيانات الأمان بنجاح' })
      setPassword('')
      setConfirmPassword('')
      setEmail('')
      await refreshAuth()
    } catch {
      setError('حدث خطأ أثناء الحفظ، تحقق من الاتصال')
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-email/resend', { method: 'POST' })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        setError(readError(j, 'فشل إعادة الإرسال'))
        return
      }
      if ((j as { data?: { already?: boolean } })?.data?.already) {
        setNotice('بريدك مؤكد بالفعل.')
      } else {
        setNotice('تم إرسال رابط التحقق إلى بريدك الإلكتروني — تحقق منه خلال ٢٤ ساعة.')
      }
      await refreshAuth()
    } catch {
      setError('حدث خطأ أثناء الإرسال، تحقق من الاتصال')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="rounded-none border-[3px] border-amber-400 bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        تأمين حسابك (اختياري)
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        حسابك مرتبط بطريقة دخول خارجية فقط — يمكنك تعيين كلمة مرور وبريد إلكتروني (كلٌّ
        منهما اختياري)، أو تخطي هذه الخطوة وسيبقى الموقع يعمل بشكل طبيعي.
      </p>
      <div
        role="note"
        className="mb-6 flex items-start gap-2 rounded-none border-2 border-amber-400 bg-amber-400/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300"
      >
        <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          ⚠️ تنبيه: بدون بريد إلكتروني مؤكد، لن تستطيع استرجاع حسابك إذا فقدت الوصول إلى
          تليجرام أو نسيت كلمة المرور.
        </span>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {showStatus && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">حالة البريد:</span>
            {emailVerified ? (
              <span className="font-bold text-green-600">مؤكد</span>
            ) : (
              <>
                <span className="font-bold text-amber-600">غير مؤكد</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                >
                  {resending ? 'جارٍ الإرسال…' : 'إعادة إرسال رابط التحقق'}
                </button>
              </>
            )}
          </div>
        )}
        {notice && (
          <p role="status" className="rounded-none border-2 border-green-600 bg-green-600/10 p-3 text-xs font-semibold text-green-700 dark:text-green-300">
            {notice}
          </p>
        )}
        {needsEmail && (
          <div>
            <label className="mb-1 block text-sm text-muted-foreground" htmlFor="setup-email">
              البريد الإلكتروني (اختياري)
            </label>
            <Input
              id="setup-email"
              type="email"
              dir="ltr"
              className="bg-background border-border text-left"
              placeholder="you@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}
        {!hasPw && (
          <>
            <div>
              <label
                className="mb-1 block text-sm text-muted-foreground"
                htmlFor="setup-password"
              >
                كلمة المرور الجديدة (اختياري — ١٠ أحرف على الأقل)
              </label>
              <Input
                id="setup-password"
                type="password"
                dir="ltr"
                className="bg-background border-border text-left"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground" htmlFor="setup-confirm">
                تأكيد كلمة المرور
              </label>
              <Input
                id="setup-confirm"
                type="password"
                dir="ltr"
                className="bg-background border-border text-left"
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          variant="outline"
          className="border-border cursor-pointer"
          disabled={!canSubmit}
        >
          {busy ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...
            </>
          ) : (
            'حفظ'
          )}
        </Button>
      </form>
    </div>
  )
}
