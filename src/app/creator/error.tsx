'use client'

import { useEffect, useRef } from 'react'
import { reportError } from '@/lib/error-reporting'
import { useAuth } from '@/contexts/auth-context'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const reportedRef = useRef<string | null>(null)
  // Session context for observability — safe default when no provider.
  const { user } = useAuth()

  useEffect(() => {
    console.error('[creator error]', error)
    const key = error?.digest ?? error?.message ?? 'creator-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      reportError(error, { route: 'creator-error', action: 'render', userId: user?.id })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort creator error boundary
    }
  }, [error, user?.id])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">تعذّر تحميل الاستوديو</h2>
      <p className="text-muted-foreground mb-6" aria-live="polite">
        حدث خطأ غير متوقع في استوديو المبدعين — تحقق من الجلسة والاتصال ثم حاول مجدداً.
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
