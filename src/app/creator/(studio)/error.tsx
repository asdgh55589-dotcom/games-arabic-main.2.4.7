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
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#151b25] p-8 text-center text-foreground"
      dir="rtl"
      role="alert"
    >
      <h2 className="text-2xl font-bold">حدث خطأ — أعد المحاولة</h2>
      <p className="text-base text-[#8b93a3]" aria-live="polite">
        {error?.digest ? `رمز الخطأ: ${error.digest}` : 'حدث خطأ غير متوقع في استوديو المبدعين'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-[#232b38] bg-[#232b38] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2e3949]"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
