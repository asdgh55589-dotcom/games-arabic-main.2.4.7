'use client'

import { useEffect, useRef } from 'react'
import { reportError } from '@/lib/error-reporting'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reportedRef = useRef<string | null>(null)

  useEffect(() => {
    console.error('[login error]', error)
    const key = error?.digest ?? error?.message ?? 'login-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      // No session context here by design: this boundary guards the login
      // page itself, where no authenticated session is expected.
      reportError(error, { route: 'login-error', action: 'render' })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort login error boundary
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">تعذّر تحميل صفحة الدخول</h2>
      <p className="text-muted-foreground mb-6" aria-live="polite">
        حدث خطأ غير متوقع — تحقق من اتصالك بالإنترنت وحاول مجدداً.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
