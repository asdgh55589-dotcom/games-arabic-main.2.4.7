'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Shield, Monitor, Smartphone, Laptop, Clock, MapPin, LogOut, Search, Filter, Download, Trash2, Loader2, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'

interface SessionItem {
  id: string
  token: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  ipAddress: string | null
  userAgent: string | null
  user: { id: string; username: string; displayName: string | null; email: string; avatarUrl: string | null; role: string }
}

function parseUA(ua?: string | null) {
  if (!ua) return { label: 'غير معروف', icon: Monitor }
  const l = ua.toLowerCase()
  if (l.includes('mobile') || l.includes('iphone') || l.includes('android')) return { label: 'هاتف', icon: Smartphone }
  if (l.includes('tablet') || l.includes('ipad')) return { label: 'تابلت', icon: Smartphone }
  if (l.includes('chrome') && !l.includes('edg')) return { label: 'Chrome', icon: Laptop }
  if (l.includes('firefox')) return { label: 'Firefox', icon: Laptop }
  if (l.includes('safari') && !l.includes('chrome')) return { label: 'Safari', icon: Laptop }
  if (l.includes('edg')) return { label: 'Edge', icon: Laptop }
  return { label: 'حاسوب', icon: Monitor }
}

function timeAgo(date: string) {
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'الآن'
  if (m < 60) return `قبل ${m} د`
  const h = Math.floor(m / 60)
  if (h < 24) return `قبل ${h} س`
  const days = Math.floor(h / 24)
  return `قبل ${days} يوم`
}

export default function AdminSessionsPage() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [device, setDevice] = useState('all')
  const [time, setTime] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ totalActive: 0, todayCount: 0, uniqueDevices: 0 })
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      if (search) params.set('search', search)
      if (device !== 'all') params.set('device', device)
      if (time !== 'all') params.set('time', time)
      const res = await fetch(`/api/admin/sessions?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const j = await res.json()
      setSessions(j.data.sessions || [])
      setTotal(j.data.pagination.total || 0)
      setTotalPages(j.data.pagination.totalPages || 1)
      setStats(j.data.stats || { totalActive: 0, todayCount: 0, uniqueDevices: 0 })
    } catch {
      toast({ title: 'فشل تحميل الجلسات', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search, device, time, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPage(1)
  }, [search, device, time])

  const revoke = async (token: string) => {
    if (!confirm('هل تريد طرد هذه الجلسة؟')) return
    setRevoking(token)
    try {
      const res = await fetch('/api/admin/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      if (!res.ok) throw new Error('failed')
      toast({ title: 'تم طرد الجلسة' })
      setSessions((p) => p.filter((s) => s.token !== token))
      setStats((s) => ({ ...s, totalActive: Math.max(0, s.totalActive - 1) }))
    } catch {
      toast({ title: 'فشل طرد الجلسة', variant: 'destructive' })
    } finally {
      setRevoking(null)
    }
  }

  const revokeAll = async () => {
    if (!confirm('هل تريد طرد كل الجلسات النشطة؟ سيُسجل خروج كل المستخدمين.')) return
    try {
      const res = await fetch('/api/admin/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
      if (!res.ok) throw new Error('failed')
      const j = await res.json().catch(() => null)
      toast({ title: `تم طرد ${j?.data?.deleted ?? ''} جلسة` })
      setSessions([])
      setStats((s) => ({ ...s, totalActive: 0 }))
    } catch {
      toast({ title: 'فشل العملية', variant: 'destructive' })
    }
  }

  const exportCSV = () => {
    const header = ['المستخدم', 'الإيميل', 'الدور', 'الجهاز', 'IP', 'آخر نشاط']
    const rows = sessions.map((s) => {
      const { label } = parseUA(s.userAgent)
      return [s.user.username, s.user.email, s.user.role, label, s.ipAddress || '', timeAgo(s.updatedAt)]
    })
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sessions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> الجلسات النشطة
          </h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة كل الجلسات النشطة عبر Better Auth — مراقبة الأجهزة وطرد المشبوه</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="min-h-[44px]">
            <Download className="ml-2 h-4 w-4" /> تصدير CSV
          </Button>
          <Button variant="destructive" onClick={revokeAll} className="min-h-[44px]">
            <Trash2 className="ml-2 h-4 w-4" /> طرد الكل
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">إجمالي النشطة</div>
              <div className="text-xl font-bold">{formatNumber(stats.totalActive)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">جلسات اليوم</div>
              <div className="text-xl font-bold">{formatNumber(stats.todayCount)}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">أجهزة فريدة</div>
              <div className="text-xl font-bold">{formatNumber(stats.uniqueDevices)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث بالمستخدم أو الإيميل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10 h-11" />
          </div>
          <Select value={device} onValueChange={setDevice}>
            <SelectTrigger className="w-full sm:w-[160px] h-11">
              <SelectValue placeholder="الجهاز" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأجهزة</SelectItem>
              <SelectItem value="mobile">هاتف</SelectItem>
              <SelectItem value="chrome">Chrome</SelectItem>
              <SelectItem value="firefox">Firefox</SelectItem>
              <SelectItem value="safari">Safari</SelectItem>
            </SelectContent>
          </Select>
          <Select value={time} onValueChange={setTime}>
            <SelectTrigger className="w-full sm:w-[160px] h-11">
              <SelectValue placeholder="الوقت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الوقت</SelectItem>
              <SelectItem value="hour">آخر ساعة</SelectItem>
              <SelectItem value="day">آخر يوم</SelectItem>
              <SelectItem value="week">آخر أسبوع</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground whitespace-nowrap">الإجمالي: {total}</div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">المستخدم</TableHead>
              <TableHead className="text-right">الجهاز</TableHead>
              <TableHead className="text-right">الموقع</TableHead>
              <TableHead className="text-right">آخر نشاط</TableHead>
              <TableHead className="text-right">IP</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-sm text-muted-foreground">
                  لا توجد جلسات نشطة
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => {
                const { label, icon: Icon } = parseUA(s.userAgent)
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.user.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {s.user.username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link href={`/admin/users/${s.user.id}`} className="text-sm font-medium hover:text-primary">
                            {s.user.username}
                          </Link>
                          <div className="text-xs text-muted-foreground">{s.user.email}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px] mr-2">
                          {s.user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-[180px]" dir="ltr">
                        {s.userAgent?.slice(0, 60) || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {s.ipAddress || 'غير معروف'}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{timeAgo(s.updatedAt)}</TableCell>
                    <TableCell className="text-xs font-mono" dir="ltr">
                      {s.ipAddress || '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive" onClick={() => revoke(s.token)} disabled={revoking === s.token} className="min-h-[36px]">
                        {revoking === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : 'طرد'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جلسات</Card>
        ) : (
          sessions.map((s) => {
            const { label, icon: Icon } = parseUA(s.userAgent)
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start gap-3">
                  {s.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {s.user.username[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{s.user.username}</div>
                    <div className="text-xs text-muted-foreground truncate" dir="ltr">
                      {s.user.email}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" /> {label}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {s.ipAddress || 'غير معروف'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {timeAgo(s.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => revoke(s.token)} disabled={revoking === s.token} className="w-full mt-3 min-h-[44px]">
                  {revoking === s.token ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="ml-2 h-4 w-4" /> طرد الجلسة</>}
                </Button>
              </Card>
            )
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="min-h-[44px]">
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="min-h-[44px]">
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
