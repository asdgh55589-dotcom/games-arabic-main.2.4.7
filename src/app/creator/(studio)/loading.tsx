import { Skeleton } from '@/components/ui/skeleton'

/**
 * Segment skeleton for the creator studio layout while the server await
 * (getSession + shell) streams — dark-theme blocks instead of the root spinner.
 */
export default function CreatorStudioLoading() {
  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-6" dir="rtl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        {/* Header bar */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg bg-muted" />
          <Skeleton className="h-5 w-40 bg-muted" />
          <Skeleton className="ms-auto h-8 w-24 rounded-lg bg-muted" />
        </div>
        {/* KPI cards row */}
        <div className="grid grid-cols-2 gap-2 @xl/main:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[92px] w-full rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
        {/* Chart block */}
        <Skeleton className="h-[250px] w-full rounded-xl border border-border bg-muted" />
        {/* Table block */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-14 w-full rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
