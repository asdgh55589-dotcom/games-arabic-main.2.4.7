'use client'

import { useSocialOverview } from '@/hooks/use-social'
import SocialOverviewPage from '@/app/admin/social/page'

export default function MediaOverviewClient() {
  const { data } = useSocialOverview()
  const reliability = (data as any)?.reliability ?? (data as any)?.kpis
  return (
    <div className="space-y-4" dir="rtl">
      {(data as any)?.generatedAt ? (
        <div className="text-[12px] text-muted-foreground">
          آخر تحديث: {new Date((data as any).generatedAt).toLocaleString('ar-SA')}
        </div>
      ) : null}
      <SocialOverviewPage />
      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-semibold text-foreground text-[15px]">Reliability</h2>
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
          <div>successRate7d: {reliability?.successRate7d ?? 0}</div>
          <div>successRate30d: {reliability?.successRate30d ?? 0}</div>
          <div>avgPublishLatencyMs: {reliability?.avgPublishLatencyMs ?? 0}</div>
          <div>retryRate: {reliability?.retryRate ?? 0}</div>
          <div>failureRate7d: {reliability?.failureRate7d ?? 0}</div>
          <div>mttr: {reliability?.mttr ?? 0}</div>
        </div>
      </div>
    </div>
  )
}

export { MediaOverviewClient }
