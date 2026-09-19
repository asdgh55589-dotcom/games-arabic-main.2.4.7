'use client'

import { CheckCircle2, Loader2, MailWarning, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

type State = { kind: 'verifying' } | { kind: 'ok' } | { kind: 'error'; message: string }

function readError(j: unknown): string {
  const d = j as { error?: string | { message?: string; details?: Record<string, string> } } | null
  const e = d?.error
  if (typeof e === 'string') return e
  return (e?.details ? Object.values(e.details)[0] : e?.message) || '⚠️ انتهت صلاحية رابط التحقق — اطلب رابطاً جديداً من صفحة الإعدادات.'
}

function VerifyEmailAddressInner() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [state, setState] = useState<State>({ kind: 'verifying' })
  const started = useRef(false)
  // Phase 4C merge: legacy /verify-email Supabase-resend folded in here.
  const [sbEmail, setSbEmail] = useState('')
  const [sbCooldown, setSbCooldown] = useState(0)
  const [sbBusy, setSbBusy] = useState(false)

  useEffect(() => {
    if (sbCooldown > 0) {
      const t = setTimeout(() => setSbCooldown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [sbCooldown])

  async function resendSupabaseSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!sbEmail.trim() || sbCooldown > 0 || sbBusy) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sbEmail.trim())) {
      toast({ title: 'خطأ', description: 'البريد الإلكتروني غير صحيح', variant: 'destructive' })
      return
    }
    setSbBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: sbEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
      })
      if (error) {
        if (error.message.toLowerCase().includes('already confirmed')) {
          toast({ title: 'تم التأكيد مسبقاً', description: 'بريدك مُفعّل بالفعل — سجّل دخولك' })
        } else {
          toast({ title: 'خطأ', description: 'تعذر الإرسال، حاول لاحقاً', variant: 'destructive' })
        }
      } else {
        toast({ title: 'تم الإرسال', description: `أرسلنا رابطاً جديداً إلى ${sbEmail.trim()}` })
        setSbCooldown(60)
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الإرسال، تحقق من الاتصال', variant: 'destructive' })
    } finally {
      setSbBusy(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = searchParams.get('token')
    if (!token) {
      setState({ kind: 'error', message: '⚠️ انتهت صلاحية رابط التحقق — اطلب رابطاً جديداً من صفحة الإعدادات.' })
      return
    }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          setState({ kind: 'error', message: readError(j) })
          return
        }
        setState({ kind: 'ok' })
        toast({ title: 'تم التأكيد', description: 'تم تأكيد بريدك الإلكتروني بنجاح' })
      })
      .catch(() => {
        setState({ kind: 'error', message: 'حدث خطأ أثناء التحقق، تحقق من الاتصال' })
      })
  }, [searchParams, toast])

  return (
    <div dir="rtl" className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center px-4 py-10">
      <div className="w-full rounded-none border-[3px] border-border bg-card p-6 text-center shadow-[4px_4px_0_0_var(--border)]">
        {state.kind === 'verifying' && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-lg font-bold">جارٍ تأكيد بريدك الإلكتروني…</h1>
          </>
        )}
        {state.kind === 'ok' && (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
            <h1 className="mt-4 text-lg font-bold">تم تأكيد بريدك الإلكتروني بنجاح</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              يمكنك الآن استخدامه لتسجيل الدخول واستعادة حسابك عند الحاجة.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/settings?section=account" className="text-sm font-bold underline underline-offset-4">
                العودة إلى الإعدادات
              </Link>
            </div>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <XCircle className="mx-auto h-8 w-8 text-destructive" />
            <h1 className="mt-4 text-lg font-bold">تعذّر تأكيد البريد</h1>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{state.message}</p>
            <div className="mt-4 flex items-start justify-center gap-2 text-xs text-muted-foreground">
              <MailWarning className="h-4 w-4 shrink-0" />
              <span>اطلب رابطاً جديداً من صفحة الإعدادات (قسم الحساب).</span>
            </div>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/settings?section=account" className="text-sm font-bold underline underline-offset-4">
                الذهاب إلى الإعدادات
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Legacy Supabase-signup resend (folded in from /verify-email merge) */}
      <details className="mt-4 w-full rounded-none border-[3px] border-border bg-card p-4 text-start shadow-[4px_4px_0_0_var(--border)]">
        <summary className="cursor-pointer text-sm font-bold">
          سجلت بالبريد ولم يصلك رابط التفعيل؟
        </summary>
        <form onSubmit={resendSupabaseSignup} className="mt-3 space-y-3">
          <p className="text-xs leading-6 text-muted-foreground">
            أدخل بريد التسجيل وسنعيد إرسال رابط التفعيل (روابط التسجيل بالبريد فقط — روابط تغيير
            البريد تُطلب من الإعدادات).
          </p>
          <Input
            type="email"
            required
            dir="ltr"
            className="text-left"
            placeholder="you@mail.com"
            value={sbEmail}
            onChange={(e) => setSbEmail(e.target.value)}
          />
          <Button type="submit" disabled={sbBusy || sbCooldown > 0} className="min-h-[44px] w-full">
            {sbBusy ? 'جارٍ الإرسال…' : sbCooldown > 0 ? `إعادة الإرسال (بعد ${sbCooldown} ث)` : 'إعادة إرسال رابط التفعيل'}
          </Button>
        </form>
      </details>
    </div>
  )
}

export function VerifyEmailAddressView() {
  return (
    <Suspense>
      <VerifyEmailAddressInner />
    </Suspense>
  )
}
