'use client'

import { useEffect, useRef } from 'react'
import { reportError } from '@/lib/error-reporting'
import { useAuth } from '@/contexts/auth-context'

/**
 * Root-level error handler (Next.js convention: `error` + `reset` props).
 * Renders a minimal <html><body> shell so the app never white-screens,
 * reuses the wording from src/app/error.tsx,
 * and reports once per digest via reportError() with session context.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reportedRef = useRef<string | null>(null)
  // Safe default when providers are absent (global shell has no layout).
  const { user } = useAuth()

  useEffect(() => {
    console.error('[global error]', error)
    const key = error?.digest ?? error?.message ?? 'global-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      reportError(error, { route: 'global-error', action: 'render', userId: user?.id })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort global error boundary
    }
  }, [error, user?.id])

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <h2 className="text-2xl font-bold">تعذّر تحميل الصفحة</h2>
          <p className="mt-2 text-muted-foreground" aria-live="polite">
            حدث خطأ غير متوقع — تحقق من اتصالك بالإنترنت وحاول مجدداً.
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  )
}
