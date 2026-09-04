'use client'

import { BarChart3, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy load chart components (no SSR)
const GrowthChart = dynamic(
  () => import('@/components/admin/charts/growth-chart').then((m) => ({ default: m.GrowthChart })),
  { ssr: false, loading: () => <Skeleton className="h-[350px] w-full rounded-lg" /> },
)
const PlatformDonut = dynamic(
  () =>
    import('@/components/admin/charts/platform-donut').then((m) => ({ default: m.PlatformDonut })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const TopTeamsBar = dynamic(
  () => import('@/components/admin/charts/top-teams-bar').then((m) => ({ default: m.TopTeamsBar })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const ActivityHeatmap = dynamic(
  () =>
    import('@/components/admin/charts/activity-heatmap').then((m) => ({
      default: m.ActivityHeatmap,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const DownloadsTrend = dynamic(
  () =>
    import('@/components/admin/charts/downloads-trend').then((m) => ({
      default: m.DownloadsTrend,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const EngagementChart = dynamic(
  () =>
    import('@/components/admin/charts/engagement-chart').then((m) => ({
      default: m.EngagementChart,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)
const TeamQualityRadar = dynamic(
  () =>
    import('@/components/admin/charts/team-quality-radar').then((m) => ({
      default: m.TeamQualityRadar,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[350px] w-full rounded-lg" /> },
)
const WorkflowFunnel = dynamic(
  () =>
    import('@/components/admin/charts/workflow-funnel').then((m) => ({
      default: m.WorkflowFunnel,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> },
)

// Mini widgets
const MiniGrowth = dynamic(
  () => import('@/components/admin/widgets/mini-growth').then((m) => ({ default: m.MiniGrowth })),
  { ssr: false, loading: () => <Skeleton className="h-[100px] w-full rounded-lg" /> },
)
const TopPlatform = dynamic(
  () => import('@/components/admin/widgets/top-platform').then((m) => ({ default: m.TopPlatform })),
  { ssr: false, loading: () => <Skeleton className="h-[100px] w-full rounded-lg" /> },
)
const PeakActivity = dynamic(
  () =>
    import('@/components/admin/widgets/peak-activity').then((m) => ({ default: m.PeakActivity })),
  { ssr: false, loading: () => <Skeleton className="h-[100px] w-full rounded-lg" /> },
)
const WorkflowBottleneck = dynamic(
  () =>
    import('@/components/admin/widgets/workflow-bottleneck').then((m) => ({
      default: m.WorkflowBottleneck,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[100px] w-full rounded-lg" /> },
)

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('12')
  const [mounted, setMounted] = useState(false)

  // Data states
  const [growth, setGrowth] = useState<any>(null)
  const [platforms, setPlatforms] = useState<any>(null)
  const [topTeams, setTopTeams] = useState<any>(null)
  const [heatmap, setHeatmap] = useState<any>(null)
  const [downloads, setDownloads] = useState<any>(null)
  const [engagement, setEngagement] = useState<any>(null)
  const [teamQuality, setTeamQuality] = useState<any>(null)
  const [funnel, setFunnel] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [g, p, t, h, d, e, tq, f] = await Promise.all([
        fetcher(`/api/admin/analytics/growth?range=${timeRange}`),
        fetcher('/api/admin/analytics/platforms'),
        fetcher('/api/admin/analytics/top-teams'),
        fetcher('/api/admin/analytics/heatmap'),
        fetcher('/api/admin/analytics/downloads'),
        fetcher('/api/admin/analytics/engagement'),
        fetcher('/api/admin/analytics/team-quality'),
        fetcher('/api/admin/analytics/funnel'),
      ])
      setGrowth(g.data)
      setPlatforms(p.data)
      setTopTeams(t.data)
      setHeatmap(h.data)
      setDownloads(d.data)
      setEngagement(e.data)
      setTeamQuality(tq.data)
      setFunnel(f.data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    if (mounted) fetchAllData()
  }, [mounted, fetchAllData])

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[100px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">التحليلات المتقدمة</h1>
            <p className="text-sm text-muted-deep">نظرة شاملة على أداء المنصة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* Mini Widgets */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniGrowth data={growth} loading={loading} />
        <TopPlatform data={platforms} loading={loading} />
        <PeakActivity data={heatmap} loading={loading} />
        <WorkflowBottleneck data={funnel} loading={loading} />
      </div>

      {/* Growth Chart - Full Width */}
      <GrowthChart
        data={growth}
        loading={loading}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />

      {/* Platform Donut + Top Teams Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PlatformDonut platforms={platforms?.platforms} loading={loading} />
        <TopTeamsBar teams={topTeams?.teams} loading={loading} />
      </div>

      {/* Activity Heatmap - Full Width */}
      <ActivityHeatmap data={heatmap?.data} maxCount={heatmap?.maxCount} loading={loading} />

      {/* Downloads Trend + Engagement Chart */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DownloadsTrend data={downloads?.dailyTrend} loading={loading} />
        <EngagementChart data={engagement} loading={loading} />
      </div>

      {/* Team Quality Radar + Workflow Funnel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TeamQualityRadar teams={teamQuality?.teams} loading={loading} />
        <WorkflowFunnel stages={funnel?.stages} loading={loading} />
      </div>
    </div>
  )
}
