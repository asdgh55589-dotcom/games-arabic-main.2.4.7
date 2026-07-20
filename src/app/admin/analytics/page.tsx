'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { Loader2, Download, Send } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface SummaryData {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  bannedUsers: number
  newUsersThisMonth: number
  newUsersLastMonth: number
  growthRate: number
}

interface TrendsData {
  labels: string[]
  newUsers: number[]
  activeUsers: number[]
}

interface InactiveUser {
  id: string
  username: string
  email: string
  lastLoginAt: Date | null
  daysSinceLastLogin: number | null
  modCount: number
  totalDownloads: number
}

interface ActivityLogEntry {
  id: string
  username: string
  action: string
  entity: string
  entityId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [threshold, setThreshold] = useState(30)
  const [alertLoading, setAlertLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [logPage, setLogPage] = useState(1)
  const [logPagination, setLogPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 })

  useEffect(() => {
    fetchAllData()
  }, [period, threshold, logPage])

  const fetchAllData = async () => {
    setLoading(true)
    try {
      const [summaryRes, trendsRes, inactiveRes, logsRes] = await Promise.all([
        fetch('/api/admin/users/analytics/summary'),
        fetch(`/api/admin/users/analytics/trends?period=${period}`),
        fetch(`/api/admin/users/analytics/inactive?daysThreshold=${threshold}`),
        fetch(`/api/admin/activity-log?page=${logPage}&limit=20`)
      ])

      const [summaryData, trendsData, inactiveData, logsData] = await Promise.all([
        summaryRes.json(),
        trendsRes.json(),
        inactiveRes.json(),
        logsRes.json()
      ])

      setSummary(summaryData)
      setTrends(trendsData)
      setInactiveUsers(inactiveData.inactiveUsers || [])
      setActivityLogs(logsData.logs || [])
      setLogPagination(logsData.pagination || { page: 1, limit: 20, total: 0, pages: 0 })
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    setExportLoading(true)
    try {
      const response = await fetch(`/api/admin/users/export?format=${format}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setExportLoading(false)
    }
  }

  const handleSendAlert = async () => {
    setAlertLoading(true)
    try {
      const response = await fetch('/api/admin/users/inactive/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysThreshold: threshold })
      })
      const data = await response.json()
      alert(data.message)
    } catch (error) {
      console.error('Alert failed:', error)
    } finally {
      setAlertLoading(false)
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      create: 'إنشاء',
      update: 'تحديث',
      delete: 'حذف',
      ban: 'حظر',
      unban: 'إلغاء الحظر',
      promote: 'ترقية',
      demote: 'تخفيض',
      moderate: 'إشراف',
      inactive_alert: 'تنبيه خاملين'
    }
    return labels[action] || action
  }

  const getEntityLabel = (entity: string) => {
    const labels: Record<string, string> = {
      user: 'مستخدم',
      mod: 'تعريب',
      comment: 'تعليق',
      game: 'لعبة',
      series: 'سلسلة',
      team: 'فريق'
    }
    return labels[entity] || entity
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const chartData = trends?.labels.map((label, i) => ({
    date: label,
    'مستخدمون جدد': trends.newUsers[i],
    'مستخدمون نشطون': trends.activeUsers[i]
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تحليلات المستخدمين</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            disabled={exportLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">إجمالي المستخدمين</div>
          <div className="text-2xl font-bold">{summary?.totalUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المستخدمون النشطون</div>
          <div className="text-2xl font-bold text-green-600">{summary?.activeUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المستخدمون الخاملون</div>
          <div className="text-2xl font-bold text-yellow-600">{summary?.inactiveUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">المحظورون</div>
          <div className="text-2xl font-bold text-red-600">{summary?.bannedUsers.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">معدل النمو</div>
          <div className={`text-2xl font-bold ${(summary?.growthRate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary?.growthRate || 0}%
          </div>
        </div>
      </div>

      {/* Trends Chart */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">الاتجاهات</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border bg-background px-3 py-1 text-sm"
          >
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="90d">آخر 90 يوم</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="مستخدمون جدد" stroke="#8884d8" />
            <Line type="monotone" dataKey="مستخدمون نشطون" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Inactive Users */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">المستخدمون الخاملون</h2>
          <div className="flex gap-2">
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value={7}>7 أيام</option>
              <option value={14}>14 يوم</option>
              <option value={30}>30 يوم</option>
              <option value={60}>60 يوم</option>
              <option value={90}>90 يوم</option>
            </select>
            <button
              onClick={handleSendAlert}
              disabled={alertLoading}
              className="flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {alertLoading ? 'جاري الإرسال...' : 'إرسال تنبيه'}
            </button>
          </div>
        </div>
        {inactiveUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد مستخدمون خاملون</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-right">المستخدم</th>
                  <th className="px-4 py-2 text-right">آخر دخول</th>
                  <th className="px-4 py-2 text-right">أيام الخمول</th>
                  <th className="px-4 py-2 text-right">التعريبات</th>
                  <th className="px-4 py-2 text-right">التحميلات</th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{user.username}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      {user.lastLoginAt
                        ? format(new Date(user.lastLoginAt), 'PPP', { locale: ar })
                        : 'لم يسجل دخول'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        (user.daysSinceLastLogin || 0) > 60
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {user.daysSinceLastLogin || '-'} يوم
                      </span>
                    </td>
                    <td className="px-4 py-2">{user.modCount}</td>
                    <td className="px-4 py-2">{user.totalDownloads.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 text-lg font-semibold">آخر النشاطات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-right">المستخدم</th>
                <th className="px-4 py-2 text-right">الإجراء</th>
                <th className="px-4 py-2 text-right">الكيان</th>
                <th className="px-4 py-2 text-right">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {activityLogs.map((log) => (
                <tr key={log.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-2">{log.username}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2">{getEntityLabel(log.entity)}</td>
                  <td className="px-4 py-2">
                    {format(new Date(log.createdAt), 'PPP HH:mm', { locale: ar })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logPagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              صفحة {logPagination.page} من {logPagination.pages} ({logPagination.total} سجل)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLogPage(p => Math.max(1, p - 1))}
                disabled={logPage === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                السابق
              </button>
              <button
                onClick={() => setLogPage(p => Math.min(logPagination.pages, p + 1))}
                disabled={logPage === logPagination.pages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
