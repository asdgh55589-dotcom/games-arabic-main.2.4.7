'use client'

import { AlertCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
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
  // Session context for observability (item 22) — safe default when no provider.
  const { user } = useAuth()

  useEffect(() => {
    console.error('[app error]', error)
    const key = error?.digest ?? error?.message ?? 'app-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      reportError(error, { route: 'app-error', action: 'render', userId: user?.id })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort error boundary
    }
  }, [error, user?.id])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-bold">تعذّر تحميل الصفحة</h2>
      <p className="mt-2 text-muted-foreground" aria-live="polite">
        حدث خطأ غير متوقع — تحقق من اتصالك بالإنترنت وحاول مجدداً.
      </p>
      <Button onClick={reset} className="mt-4">
        إعادة المحاولة
      </Button>
    </div>
  )
}
