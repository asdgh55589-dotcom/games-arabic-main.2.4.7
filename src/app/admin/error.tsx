'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin Layout Error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <h2 className="text-2xl font-bold text-red-500 mb-4">حدث خطأ غير متوقع</h2>
      <p className="text-muted-foreground mb-6">نعتذر عن هذا الخلل. يرجى المحاولة مرة أخرى.</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
