'use client'

import { useState, useEffect } from 'react'
import { Clock, RefreshCw, Trash2, Eye, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface ScheduledJob {
  id: string
  type: string
  status: string
  scheduledAt: string
  executedAt?: string
  error?: string
  retries: number
  mod?: { id: string; name: string; slug: string }
  payload: any
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  telegram_post: 'منشور Telegram',
  backup: 'نسخ احتياطي',
  notification: 'إشعار',
  cleanup: 'تنظيف',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  running: 'قيد التنفيذ',
  completed: 'مكتمل',
  failed: 'فشل',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', type: '' })

  useEffect(() => {
    fetchJobs()
  }, [filter])

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.type) params.set('type', filter.type)

      const res = await fetch(`/api/admin/scheduler?${params}`)
      const data = await res.json()
      setJobs(data.data?.jobs || [])
      setStats(data.data?.stats || {})
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('هل تريد إلغاء هذه المهمة؟')) return
    try {
      await fetch(`/api/admin/scheduler?id=${id}`, { method: 'DELETE' })
      fetchJobs()
    } catch (err) {
      alert('فشل الإلغاء')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[80px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الجدولة自动化</h1>
            <p className="text-sm text-muted-foreground">إدارة المهام المجدولة والنوبية</p>
          </div>
        </div>
        <Button onClick={fetchJobs} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold">{stats[key] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-right font-medium">النوع</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">التعريب</th>
                  <th className="px-4 py-3 text-right font-medium">مجدول لـ</th>
                  <th className="px-4 py-3 text-right font-medium">التنفيذ</th>
                  <th className="px-4 py-3 text-right font-medium">المحاولات</th>
                  <th className="px-4 py-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد مهام مجدولة
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">{TYPE_LABELS[job.type] || job.type}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[job.status]}`}
                        >
                          {STATUS_LABELS[job.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {job.mod ? (
                          <span className="text-primary hover:underline cursor-pointer">
                            {job.mod.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {new Date(job.scheduledAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {job.executedAt ? new Date(job.executedAt).toLocaleString('ar-SA') : '—'}
                      </td>
                      <td className="px-4 py-3">{job.retries}/3</td>
                      <td className="px-4 py-3">
                        {job.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(job.id)}
                            className="text-red-600 hover:text-red-700 min-h-[44px]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
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
