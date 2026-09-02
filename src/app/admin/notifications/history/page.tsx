'use client'

import { useState, useEffect } from 'react'
import { Bell, RefreshCw, Filter } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NOTIFICATION_TYPE_LABELS, NotificationType } from '@/lib/notifications/types'

interface NotificationLog {
  id: string
  channel: string
  status: string
  errorMessage?: string
  sentAt?: string
  createdAt: string
  notification: {
    type: string
    title: string
    message: string
    user: { username: string }
  }
}

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'داخل التطبيق',
  email: 'بريد إلكتروني',
  telegram: 'Telegram',
}

const STATUS_LABELS: Record<string, string> = {
  sent: 'مرسل',
  failed: 'فشل',
  pending: 'معلق',
  processing: 'قيد المعالجة',
}

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
}

export default function NotificationHistoryPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ channel: '', status: '' })

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.channel) params.set('channel', filter.channel)
      if (filter.status) params.set('status', filter.status)

      // Use the existing notifications-health endpoint
      const res = await fetch(`/api/admin/notifications-health?${params}`)
      const data = await res.json()
      setLogs(data.data?.logs || [])
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">سجل الإشعارات</h1>
            <p className="text-sm text-muted-foreground">تاريخ الإشعارات المرسلة</p>
          </div>
        </div>
        <Button onClick={fetchLogs} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filter.channel}
          onChange={(e) => setFilter({ ...filter, channel: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل القنوات</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-right font-medium">النوع</th>
                  <th className="px-4 py-3 text-right font-medium">العنوان</th>
                  <th className="px-4 py-3 text-right font-medium">المستلم</th>
                  <th className="px-4 py-3 text-right font-medium">القناة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد سجلات
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs">{NOTIFICATION_TYPE_LABELS[log.notification.type as NotificationType] || log.notification.type}</td>
                      <td className="px-4 py-3">{log.notification.title}</td>
                      <td className="px-4 py-3">{log.notification.user.username}</td>
                      <td className="px-4 py-3">{CHANNEL_LABELS[log.channel] || log.channel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[log.status]}`}>
                          {STATUS_LABELS[log.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
