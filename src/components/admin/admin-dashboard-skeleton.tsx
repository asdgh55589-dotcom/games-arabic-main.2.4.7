export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-28 rounded bg-background-secondary" />
          <div className="h-3.5 w-48 rounded bg-background-secondary" />
        </div>
        <div className="h-8 w-24 rounded-md bg-background-secondary" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-lg bg-background-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-20 rounded bg-background-secondary" />
                <div className="h-6 w-14 rounded bg-background-secondary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3">
            <div className="h-4 w-4 rounded bg-background-secondary" />
            <div className="h-3.5 w-16 rounded bg-background-secondary" />
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 pb-0">
            <div className="h-5 w-32 rounded bg-background-secondary" />
          </div>
          <div className="divide-y divide-border-light">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-background-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 rounded bg-background-secondary" />
                  <div className="h-3 w-24 rounded bg-background-secondary" />
                </div>
                <div className="h-3 w-12 shrink-0 rounded bg-background-secondary" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 pb-0">
              <div className="h-5 w-28 rounded bg-background-secondary" />
            </div>
            <div className="divide-y divide-border-light">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-background-secondary" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-20 rounded bg-background-secondary" />
                    <div className="h-2.5 w-16 rounded bg-background-secondary" />
                  </div>
                  <div className="h-3 w-10 rounded bg-background-secondary" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 pb-0">
              <div className="h-5 w-28 rounded bg-background-secondary" />
            </div>
            <div className="divide-y divide-border-light">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3.5 w-20 rounded bg-background-secondary" />
                    <div className="h-2.5 w-12 rounded bg-background-secondary" />
                  </div>
                  <div className="h-3 w-full rounded bg-background-secondary" />
                  <div className="h-2.5 w-16 rounded bg-background-secondary" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
