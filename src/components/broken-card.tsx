'use client'

// Compact per-card fallback for ErrorBoundary (grid slots).
// Matches the mod-card brutalist style; offers retry without losing the page.
export function BrokenCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 border-[3px] border-border bg-card p-4 text-center shadow-[4px_4px_0_0_var(--border)]"
    >
      <p className="text-sm font-bold text-muted-foreground">تعذر تحميل هذا المحتوى</p>
      <button
        type="button"
        onClick={() => (onRetry ? onRetry() : window.location.reload())}
        className="min-h-[44px] border-2 border-border bg-secondary px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-accent"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}
