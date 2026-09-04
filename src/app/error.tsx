'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error]', error)
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
