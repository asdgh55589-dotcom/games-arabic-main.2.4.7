export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#111214]/90 p-8 lg:p-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl space-y-5">
            <div className="h-8 w-40 rounded-full bg-white/10" />
            <div className="h-14 w-[420px] max-w-full rounded-2xl bg-white/10" />
            <div className="h-6 w-[520px] max-w-full rounded-xl bg-white/5" />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:min-w-[420px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
              >
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-5 h-10 w-20 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/10" />

              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 rounded bg-white/10" />
                <div className="h-3 w-16 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/10 bg-[#111214]/90 p-6">
          <div className="mb-6 h-8 w-52 rounded-xl bg-white/10" />

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="h-12 w-12 rounded-2xl bg-white/10" />

                <div className="flex-1 space-y-3">
                  <div className="h-5 w-44 rounded bg-white/10" />
                  <div className="h-4 w-full rounded bg-white/5" />
                  <div className="h-3 w-20 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[30px] border border-white/10 bg-[#111214]/90 p-5"
            >
              <div className="mb-5 h-7 w-36 rounded bg-white/10" />

              <div className="space-y-4">
                {Array.from({ length: 3 }).map((__, j) => (
                  <div
                    key={j}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="h-4 w-28 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-full rounded bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
