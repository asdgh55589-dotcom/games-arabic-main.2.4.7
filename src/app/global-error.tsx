'use client'

import { useEffect, useRef } from 'react'
import { reportError } from '@/lib/error-reporting'

/**
 * Root-level error handler (Next.js convention: `error` + `reset` props).
 * Renders a minimal <html><body> shell so the app never white-screens,
 * reuses the byte-identical Arabic fallback from src/app/error.tsx,
 * and reports once per digest via reportError().
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reportedRef = useRef<string | null>(null)

  useEffect(() => {
    const key = error?.digest ?? error?.message ?? 'global-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      reportError(error, { route: 'global-error', action: 'render' })
    } catch {
      // fail-open: never break the fallback UI
    }
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
          <h2 className="text-2xl font-bold">حدث خطأ ما</h2>
          <p className="mt-2 text-muted-foreground">نعتذر، حدث خطأ غير متوقع. حاول مرة أخرى.</p>
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
