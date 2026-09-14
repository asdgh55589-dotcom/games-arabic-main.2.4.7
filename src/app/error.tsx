'use client'

import { AlertCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
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
    console.error('[app error]', error)
    const key = error?.digest ?? error?.message ?? 'app-error'
    if (reportedRef.current === key) return
    reportedRef.current = key
    try {
      reportError(error, { route: 'app-error', action: 'render' })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort error boundary
    }
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
      <h2 className="text-2xl font-bold">حدث خطأ ما</h2>
      <p className="mt-2 text-muted-foreground">نعتذر، حدث خطأ غير متوقع. حاول مرة أخرى.</p>
      <Button onClick={reset} className="mt-4">
        إعادة المحاولة
      </Button>
    </div>
  )
}
