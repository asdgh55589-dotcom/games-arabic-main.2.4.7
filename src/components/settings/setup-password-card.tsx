'use client'

import { Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

/** Cooldown after any verification send before resend is allowed (UI-level; API enforces 3/hour). */
const RESEND_COOLDOWN_MS = 60_000

function isSyntheticEmail(email: string | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@telegram.local')
}

/**
 * Account security setup for OAuth users (Settings → Account).
 *
 * Contextual, actionable labels based on user state:
 * - No password yet → "قم بتعيين كلمة مرور" (new + confirm fields).
 * - Synthetic identity → required "قم بإضافة بريد إلكتروني" (needed for recovery).
 * - Password set but email unverified → verification status + resend.
 *
 * Email verification states: none added → sent → pending → verified/failed,
 * each with a direct message. Resend is disabled for 60s after every send.
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
  const [mailState, setMailState] = useState<'idle' | 'sent' | 'failed'>('idle')
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const hasPw = user?.hasPassword === true
  const needsEmail = isSyntheticEmail(user?.email)
  const emailVerified = user?.emailVerified === true
  const showStatus = !needsEmail && !!user?.email

  useEffect(() => {
    if (cooldownUntil === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [cooldownUntil])
  const cooldownLeft =
    cooldownUntil === null ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  // Email is required whenever the field is shown; otherwise a password is required.
  const canSubmit =
    !busy && (needsEmail ? email.trim().length > 0 : password.length > 0)

  const title = !hasPw ? 'قم بتعيين كلمة مرور' : 'تأكيد بريدك الإلكتروني'

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
    setMailState('idle')
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
      const data = (j as { data?: { needsVerification?: boolean; verificationSent?: boolean } })?.data
      if (data?.needsVerification) {
        if (data.verificationSent) {
          setMailState('sent')
          setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS)
          toast({ title: '✅ تم إرسال رابط التحقق إلى بريدك الإلكتروني' })
        } else {
          setMailState('failed')
        }
      } else {
        toast({ title: 'تم حفظ بيانات الأمان بنجاح' })
      }
      setPassword('')
      setConfirmPassword('')
      if (data?.needsVerification && data.verificationSent) setEmail('')
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
        setNotice('تم إعادة إرسال رسالة التحقق')
        setMailState('sent')
      }
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS)
      await refreshAuth()
    } catch {
      setError('حدث خطأ أثناء الإرسال، تحقق من الاتصال')
    } finally {
      setResending(false)
    }
  }

  const resendRow = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">لم تصلك الرسالة؟</span>
      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldownLeft > 0}
        className="font-bold underline underline-offset-2 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
      >
        {resending
          ? 'جارٍ الإرسال…'
          : cooldownLeft > 0
            ? `إعادة الإرسال (بعد ${cooldownLeft} ث)`
            : 'إعادة الإرسال'}
      </button>
    </div>
  )

  return (
    <div className="rounded-none border-[3px] border-amber-400 bg-card p-6 shadow-[4px_4px_0_0_var(--border)]">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="h-4 w-4 text-amber-500" />
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {!hasPw && needsEmail && 'أضف بريدك الإلكتروني وعيّن كلمة مرور لتأمين حسابك.'}
        {!hasPw && !needsEmail && 'عيّن كلمة مرور لحسابك لتتمكن من تسجيل الدخول بها.'}
        {hasPw && 'أكمل تأمين حسابك بتأكيد بريدك الإلكتروني.'}
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
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">حالة البريد:</span>
              {emailVerified ? (
                <span className="font-bold text-green-600">✅ بريدك الإلكتروني مؤكد</span>
              ) : (
                <span className="font-bold text-amber-600">بانتظار التأكيد - تحقق من بريدك</span>
              )}
            </div>
            {!!user?.email && (
              <div dir="ltr" className="text-left text-muted-foreground">
                {user.email}
              </div>
            )}
            {!emailVerified && mailState === 'sent' && (
              <p role="status" className="rounded-none border-2 border-green-600 bg-green-600/10 p-3 font-semibold text-green-700 dark:text-green-300">
                ✅ تم إرسال رابط التحقق إلى بريدك الإلكتروني. يرجى فحص بريدك الوارد
                (والرسائل غير المرغوب فيها) والضغط على الرابط لتأكيد بريدك.
              </p>
            )}
            {!emailVerified && mailState === 'failed' && (
              <p role="alert" className="rounded-none border-2 border-destructive bg-destructive/10 p-3 font-semibold text-destructive">
                ⚠️ تعذر إرسال رسالة التحقق. يرجى المحاولة لاحقًا.
              </p>
            )}
            {!emailVerified && resendRow}
          </div>
        )}
        {needsEmail && (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">لم يتم إضافة بريد إلكتروني بعد.</p>
            <label className="mb-1 block text-sm font-bold" htmlFor="setup-email">
              قم بإضافة بريد إلكتروني <span aria-hidden>*</span>
            </label>
            <p className="mb-1 text-[11px] text-muted-foreground">
              مطلوب لاسترجاع حسابك وتأمينه — سنرسل إليه رابط تحقق.
            </p>
            <Input
              id="setup-email"
              type="email"
              required
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
              <label className="mb-1 block text-sm font-bold" htmlFor="setup-password">
                كلمة المرور الجديدة
              </label>
              <p className="mb-1 text-[11px] text-muted-foreground">
                {needsEmail ? 'اختياري — ' : ''}١٠ أحرف على الأقل
              </p>
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
              <label className="mb-1 block text-sm font-bold" htmlFor="setup-confirm">
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
        {notice && (
          <p role="status" className="rounded-none border-2 border-green-600 bg-green-600/10 p-3 text-xs font-semibold text-green-700 dark:text-green-300">
            {notice}
          </p>
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
