import { Skeleton } from '@/components/ui/skeleton'

/**
 * Section 4 item 29: segment skeleton for /mod/[slug] — the server await
 * (getModData incl. the 3-query download-count chain) streams this instead
 * of blocking the whole page on the root spinner.
 */
export default function ModDetailLoading() {
  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-48" />
      </div>
      <Skeleton className="aspect-[16/7] w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
