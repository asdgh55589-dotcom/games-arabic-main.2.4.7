'use client'

import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface TrendPoint { date: string; downloads: number; views: number }
interface TopMod { name: string; downloads: number }
interface RoleSlice { name: string; value: number }

interface Props {
  trend?: TrendPoint[]
  topMods?: TopMod[]
  roles?: RoleSlice[]
  loading?: boolean
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function TeamCharts({ trend = [], topMods = [], roles = [], loading = false }: Props) {
  const trendData = useMemo(() => trend, [trend])
  const topData = useMemo(() => topMods, [topMods])
  const roleData = useMemo(() => roles, [roles])

  if (loading) {
    return <div className="grid gap-4 md:grid-cols-2"><div className="h-48 animate-pulse rounded-lg bg-muted" /><div className="h-48 animate-pulse rounded-lg bg-muted" /></div>
  }

  const empty = trendData.length === 0 && topData.length === 0 && roleData.length === 0
  if (empty) {
    return <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trendData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">التحميلات والمشاهدات</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="downloads" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              <Area type="monotone" dataKey="views" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {topData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">أفضل التعريبات</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Bar dataKey="downloads" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {roleData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">توزيع الأدوار</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={roleData} dataKey="value" nameKey="name" outerRadius={70}>
                {roleData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
