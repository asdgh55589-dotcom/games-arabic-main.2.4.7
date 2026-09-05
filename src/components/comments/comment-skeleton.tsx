'use client'

/** هيكل تحميل التعليقات — يطابق التخطيط النهائي (بدل spinner أعمى) */
export function CommentSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="جاري تحميل التعليقات">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-none border-[1.5px] border-border/40 bg-card p-2.5"
          aria-hidden="true"
        >
          <div className="flex gap-2">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">جاري تحميل التعليقات…</span>
    </div>
  )
}
