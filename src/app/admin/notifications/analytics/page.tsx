'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Mail, Bell, Send, Loader2, BarChart3 } from 'lucide-react'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

interface AnalyticsData {
  range: string
  totals: { created: number; delivered: number; failed: number; deliveryRate: number }
  comparison: { prevTotal: number; growthRate: number; deliveryGrowth: number }
  byChannel: Record<string, number>
  byType: Record<string, number>
  timeSeries: { date: string; created: number; delivered: number; failed: number }[]
}

export default function NotificationsAnalyticsPage() {
  const [range, setRange] = useState('7d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/notifications/analytics?range=${range}`)
      const json = await res.json()
      if (json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setIsLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  useEffect(() => {
    const interval = setInterval(fetchAnalytics, 60000)
    return () => clearInterval(interval)
  }, [fetchAnalytics])

  if (isLoading || !data) {
    return (
      <div className="grid place-items-center py-20" dir="rtl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> تحليلات الإشعارات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إحصائيات زمنية حسب النوع والقناة
            {lastUpdated && <span className="mr-2 text-xs">— آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}</span>}
          </p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="w-40 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="7d">آخر 7 أيام</option>
          <option value="30d">آخر 30 يوم</option>
          <option value="90d">آخر 90 يوم</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الإشعارات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totals.created.toLocaleString('ar-EG')}</div>
            <div className={`flex items-center gap-1 text-sm mt-1 ${data.comparison.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.growthRate >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(data.comparison.growthRate).toFixed(1)}% عن الفترة السابقة
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">تم التوصيل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.totals.delivered.toLocaleString('ar-EG')}</div>
            <div className="text-sm text-muted-foreground mt-1">نسبة التوصيل: {data.totals.deliveryRate.toFixed(1)}%</div>
            <div className={`flex items-center gap-1 text-xs mt-1 ${data.comparison.deliveryGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.comparison.deliveryGrowth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(data.comparison.deliveryGrowth).toFixed(1)}% توصيل سابق
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">فشل التوصيل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.totals.failed.toLocaleString('ar-EG')}</div>
            <div className="text-sm text-muted-foreground mt-1">من إجمالي {data.totals.created}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">القنوات النشطة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(data.byChannel).length}</div>
            <div className="text-sm text-muted-foreground mt-1">{Object.entries(data.byChannel).map(([k, v]) => `${k}:${v}`).join(' • ') || 'لا يوجد'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الإشعارات عبر الزمن</CardTitle>
        </CardHeader>
        <CardContent>
          {data.timeSeries.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات في هذه الفترة</p>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {data.timeSeries.map((day) => {
                const max = Math.max(...data.timeSeries.map((d) => d.created), 1)
                const height = (day.created / max) * 100
                const deliverHeight = (day.delivered / max) * 100
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end h-40">
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${height}%` }} title={`${day.date}: ${day.created} إشعار (${day.delivered} تم توصيله)`}>
                        <div className="w-full bg-green-500/50 rounded-t" style={{ height: `${deliverHeight}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{day.date.slice(5).replace('-', '/')}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> إجمالي</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500/50" /> تم توصيله</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>حسب القناة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(data.byChannel).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
            ) : (
              Object.entries(data.byChannel)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([channel, count]) => {
                  const total = data.totals.created || 1
                  const pct = ((count as number) / total) * 100
                  return (
                    <div key={channel} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {channel === 'in_app' ? <Bell className="w-4 h-4" /> : channel === 'email' ? <Mail className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                          {channel === 'in_app' ? 'داخل التطبيق' : channel === 'email' ? 'البريد الإلكتروني' : 'تيليجرام'}
                        </span>
                        <span className="font-bold">{count as number} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حسب النوع (الأعلى)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.keys(data.byType).length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
            ) : (
              Object.entries(data.byType)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 8)
                .map(([type, count]) => {
                  const total = data.totals.created || 1
                  const pct = ((count as number) / total) * 100
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{(NOTIFICATION_TYPE_LABELS as Record<string, string>)[type] || type}</span>
                        <span className="font-bold shrink-0">{count as number}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
