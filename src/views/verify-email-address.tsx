'use client'

import { CheckCircle2, Loader2, MailWarning, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

type State = { kind: 'verifying' } | { kind: 'ok' } | { kind: 'error'; message: string }

function readError(j: unknown): string {
  const d = j as { error?: string | { message?: string; details?: Record<string, string> } } | null
  const e = d?.error
  if (typeof e === 'string') return e
  return (e?.details ? Object.values(e.details)[0] : e?.message) || '⚠️ انتهت صلاحية رابط التحقق — اطلب رابطاً جديداً من صفحة الإعدادات.'
}

function VerifyEmailAddressInner() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<State>({ kind: 'verifying' })
  const started = useRef(false)

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
      })
      .catch(() => {
        setState({ kind: 'error', message: 'حدث خطأ أثناء التحقق، تحقق من الاتصال' })
      })
  }, [searchParams])

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
            <p className="mt-2 text-sm text-muted-foreground">
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
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
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
