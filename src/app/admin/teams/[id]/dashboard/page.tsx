'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ArrowRight, Package, Download, Star, TrendingUp, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RatingDisplay } from '@/components/admin/mods/rating-display'

interface TeamDashboard {
  team: { id: string; name: string; slug: string; logoUrl: string | null }
  stats: {
    totalMods: number
    publishedMods: number
    draftMods: number
    inReviewMods: number
    totalDownloads: number
    totalEndorsements: number
    avgRating: number
    avgQuality: number
  }
  modsByStatus: { status: string; count: number }[]
  recentActivity: {
    modId: string
    modName: string
    status: string
    qualityScore: number
    updatedAt: string
  }[]
  members: { id: string; name: string; avatarUrl: string | null; role: string }[]
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشفة',
  REJECTED: 'مرفوض',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function TeamDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<TeamDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/admin/teams/${id}/dashboard`)
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body?.error?.message || body?.error || 'فشل تحميل بيانات الفريق')
        }
        const json = await response.json()
        const payload = json?.data ?? json
        setData(payload)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'فشل تحميل بيانات الفريق'
        console.error('Failed to fetch team dashboard:', err)
        setError(msg)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>
  if (!data) return <div className="p-8 text-center text-muted-foreground">الفريق غير موجود</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/teams" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{data.team.name}</h1>
          <p className="text-sm text-muted-foreground">لوحة معلومات الفريق</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي التعريبات', value: data.stats.totalMods ?? 0, icon: Package },
          { label: 'المنشورات', value: data.stats.publishedMods ?? 0, icon: Package },
          {
            label: 'التحميلات',
            value: (data.stats.totalDownloads ?? 0).toLocaleString('en-US'),
            icon: Download,
          },
          { label: 'متوسط التقييم', value: (data.stats.avgRating ?? 0).toFixed(1), icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <div className="text-2xl font-bold mt-2">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mods by Status */}
        <div className="p-4 rounded-lg border bg-card">
          <h2 className="font-medium mb-3">التعريبات حسب الحالة</h2>
          <div className="space-y-2">
            {data.modsByStatus.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                </div>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Members */}
        <div className="p-4 rounded-lg border bg-card">
          <h2 className="font-medium mb-3">أعضاء الفريق</h2>
          <div className="space-y-2">
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {member.name[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{member.name}</div>
                  <div className="text-xs text-muted-foreground">{member.role}</div>
                </div>
              </div>
            ))}
            {data.members.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">لا يوجد أعضاء</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-4 rounded-lg border bg-card">
        <h2 className="font-medium mb-3">النشاط الأخير</h2>
        <div className="space-y-2">
          {data.recentActivity.map((item) => (
            <div
              key={item.modId}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <Badge className={STATUS_COLORS[item.status]} variant="outline">
                  {STATUS_LABELS[item.status]}
                </Badge>
                <span className="text-sm font-medium">{item.modName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {(item.qualityScore ?? 0).toFixed(0)}% جودة
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString('ar-SA')}
                </span>
              </div>
            </div>
          ))}
          {data.recentActivity.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">لا يوجد نشاط</div>
          )}
        </div>
      </div>
    </div>
  )
}
