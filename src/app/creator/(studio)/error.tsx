'use client'

export default function CreatorStudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground"
      dir="rtl"
      role="alert"
    >
      <h2 className="text-2xl font-bold">حدث خطأ — أعد المحاولة</h2>
      <p className="text-base text-muted-foreground" aria-live="polite">
        {error?.digest ? `رمز الخطأ: ${error.digest}` : 'حدث خطأ غير متوقع في استوديو المبدعين'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
