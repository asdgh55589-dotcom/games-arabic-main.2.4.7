'use client'

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  MessageSquare,
  Plus,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDocumentTitle } from '@/hooks/use-document-title'

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد المعالجة',
  waiting: 'بانتظار الرد',
  resolved: 'محلولة',
  closed: 'مغلقة',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  waiting: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'خلل',
  feature: 'ميزة',
  question: 'سؤال',
  other: 'أخرى',
}

interface Ticket {
  id: string
  subject: string
  description: string
  status: string
  priority: string
  category: string
  user: { id: string; username: string; avatarUrl: string | null }
  assignedUser: { id: string; username: string; avatarUrl: string | null } | null
  tags: { tag: string }[]
  _count: { messages: number }
  createdAt: string
  updatedAt: string
}

export default function TicketsPage() {
  useDocumentTitle('تذاكر الدعم')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (search) params.set('q', search)

      const response = await fetch(`/api/admin/tickets?${params}`)
      const data = await response.json()
      setTickets(data.tickets || [])
      setTotal(data.pagination?.total || 0)
      setStats(data.stats || {})
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [page, statusFilter, priorityFilter])

  useEffect(() => {
    const timer = setTimeout(fetchTickets, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تذاكر الدعم</h1>
        <Link href="/admin/tickets/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            تذكرة جديدة
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'open', label: 'مفتوحة', icon: MessageSquare },
          { key: 'in_progress', label: 'قيد المعالجة', icon: Clock },
          { key: 'waiting', label: 'بانتظار الرد', icon: Clock },
          { key: 'resolved', label: 'محلولة', icon: CheckCircle2 },
          { key: 'closed', label: 'مغلقة', icon: AlertTriangle },
        ].map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              statusFilter === key ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
            }`}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            <div className="text-2xl font-bold mt-1">{stats[key] || 0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في التذاكر..."
            className="pr-10"
            dir="rtl"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 rounded-md border bg-background text-sm"
        >
          <option value="">جميع الأولويات</option>
          <option value="low">منخفضة</option>
          <option value="medium">متوسطة</option>
          <option value="high">عالية</option>
          <option value="urgent">عاجلة</option>
        </select>
      </div>

      {/* Tickets Table - Desktop */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-right font-medium">المعرف</th>
              <th className="px-4 py-3 text-right font-medium">الموضوع</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
              <th className="px-4 py-3 text-right font-medium">الأولوية</th>
              <th className="px-4 py-3 text-right font-medium">التصنيف</th>
              <th className="px-4 py-3 text-right font-medium">المستخدم</th>
              <th className="px-4 py-3 text-right font-medium">المسند</th>
              <th className="px-4 py-3 text-right font-medium">الرسائل</th>
              <th className="px-4 py-3 text-right font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  جاري التحميل...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد تذاكر
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => (
                <tr key={ticket.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    #{ticket.id.slice(-6)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tickets/${ticket.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[ticket.status]}>
                      {STATUS_LABELS[ticket.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={PRIORITY_COLORS[ticket.priority]}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CATEGORY_LABELS[ticket.category]}
                  </td>
                  <td className="px-4 py-3">{ticket.user.username}</td>
                  <td className="px-4 py-3">{ticket.assignedUser?.username || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ticket._count.messages}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(ticket.createdAt).toLocaleDateString('ar-SA')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tickets Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">لا توجد تذاكر</div>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/tickets/${ticket.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold hover:text-primary transition-colors">
                      {ticket.subject}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      #{ticket.id.slice(-6)}
                    </p>
                  </Link>
                  <Badge className={`${STATUS_COLORS[ticket.status]} shrink-0`}>
                    {STATUS_LABELS[ticket.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </Badge>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {CATEGORY_LABELS[ticket.category]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ticket._count.messages} رسائل
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-muted p-2.5">
                    <div className="font-semibold text-muted-foreground">المستخدم</div>
                    <div className="mt-1 truncate font-medium">{ticket.user.username}</div>
                  </div>
                  <div className="rounded-md bg-muted p-2.5">
                    <div className="font-semibold text-muted-foreground">المسند إليه</div>
                    <div className="mt-1 truncate font-medium">
                      {ticket.assignedUser?.username || '—'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(ticket.createdAt).toLocaleDateString('ar-SA')}</span>
                  <span>
                    {CATEGORY_LABELS[ticket.category]} • {PRIORITY_LABELS[ticket.priority]}
                  </span>
                </div>
                <Link href={`/admin/tickets/${ticket.id}`} className="block">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] w-full justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    عرض التفاصيل
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            صفحة {page} من {Math.ceil(total / 20)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
