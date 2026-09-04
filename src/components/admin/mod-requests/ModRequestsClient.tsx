'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Gamepad2,
  Heart,
  CheckCircle,
  XCircle,
  Eye,
  Archive,
  Download,
  Inbox,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  AdminDataTable,
  type Column,
  type FilterConfig,
  type BulkAction,
  type StatItem,
} from '@/components/admin/shared/AdminDataTable'
import { useToast } from '@/hooks/use-toast'

interface ModRequestItem {
  id: string
  gameName: string
  platform: string
  notes: string | null
  status: string
  interestCount: number
  createdAt: string
  acceptedAt: string | null
  user: { id: string; username: string; avatarUrl: string | null }
  mod: { id: string; name: string; slug: string } | null
  acceptedUser: { id: string; username: string } | null
}

interface Props {
  initialData: ModRequestItem[]
  totalCount: number
  currentUser: { id: string; role: string }
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialStatus: string
  initialPlatform: string
  initialSort: string
  initialDirection: string
}

export function ModRequestsClient({
  initialData,
  totalCount,
  initialPage,
  initialPageSize,
  initialSearch,
  initialStatus,
  initialPlatform,
  initialSort,
  initialDirection,
}: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<string[]>(
    initialStatus === 'all' ? [] : [initialStatus],
  )
  const [platformFilter, setPlatformFilter] = useState<string[]>(
    initialPlatform === 'all' ? [] : [initialPlatform],
  )
  const [sortField, setSortField] = useState(initialSort)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialDirection as 'asc' | 'desc',
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const updateUrl = (patch: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(patch).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    router.push(`/admin/mod-requests?${params.toString()}`)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(1)
    updateUrl({ search: q, page: '1' })
  }

  const handleFilterChange = (key: string, values: string[]) => {
    if (key === 'status') setStatusFilter(values)
    if (key === 'platform') setPlatformFilter(values)
    updateUrl({ [key]: values[0] || 'all', page: '1' })
    setPage(1)
  }

  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    updateUrl({ sort: field, direction })
  }

  const handlePageChange = (p: number) => {
    setPage(p)
    updateUrl({ page: String(p) })
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    updateUrl({ pageSize: String(size), page: '1' })
    setPage(1)
  }

  const filteredData = useMemo(() => {
    let d = [...initialData]
    if (statusFilter.length > 0) d = d.filter((r) => statusFilter.includes(r.status))
    if (platformFilter.length > 0) d = d.filter((r) => platformFilter.includes(r.platform))
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(
        (r) =>
          r.gameName.toLowerCase().includes(q) ||
          r.platform.toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q),
      )
    }
    return d
  }, [initialData, statusFilter, platformFilter, search])

  const stats: StatItem[] = [
    { label: 'إجمالي الطلبات', value: initialData.length, icon: Inbox },
    { label: 'مفتوحة', value: initialData.filter((r) => r.status === 'open').length, icon: Clock },
    {
      label: 'مقبولة',
      value: initialData.filter((r) => r.status === 'accepted').length,
      icon: CheckCircle,
    },
    {
      label: 'مكتملة',
      value: initialData.filter((r) => r.status === 'completed').length,
      icon: Gamepad2,
    },
    {
      label: 'إجمالي الاهتمام',
      value: initialData.reduce((sum, r) => sum + r.interestCount, 0),
      icon: Heart,
    },
  ]

  const columns: Column<ModRequestItem>[] = [
    {
      key: 'game',
      label: 'اللعبة',
      sortable: true,
      render: (req) => (
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{req.gameName}</div>
            <div className="text-xs text-muted-foreground">{req.platform}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'requester',
      label: 'الطالب',
      render: (req) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={req.user.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {req.user.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm truncate">{req.user.username}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      render: (req) => {
        const map: Record<string, { label: string; className: string }> = {
          open: {
            label: 'مفتوح',
            className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
          },
          accepted: { label: 'مقبول', color: 'text-blue-500 bg-blue-500/10' } as unknown as {
            label: string
            className: string
          },
          completed: {
            label: 'مكتمل',
            className: 'bg-green-500/10 text-green-600 border-green-500/20',
          },
          cancelled: {
            label: 'ملغي',
            className: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
          },
        }
        const cfg = map[req.status] || map.open
        // Fix accepted mapping
        const acceptedFix =
          req.status === 'accepted'
            ? { label: 'مقبول', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' }
            : cfg
        const finalCfg = req.status === 'accepted' ? acceptedFix : cfg
        return (
          <Badge variant="outline" className={finalCfg.className}>
            {finalCfg.label}
          </Badge>
        )
      },
    },
    {
      key: 'interest',
      label: 'الاهتمام',
      sortable: true,
      render: (req) => (
        <span className="inline-flex items-center gap-1 font-medium">
          <Heart className="h-4 w-4 text-red-500" />
          {req.interestCount}
        </span>
      ),
    },
    {
      key: 'acceptedBy',
      label: 'المُعَرِّب المسؤول',
      render: (req) =>
        req.acceptedUser ? (
          <span className="text-sm">{req.acceptedUser.username}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'mod',
      label: 'التعريب المكتمل',
      render: (req) =>
        req.mod ? (
          <Link
            href={`/mod/${req.mod.slug}`}
            className="text-sm text-primary hover:underline truncate block max-w-[150px]"
          >
            {req.mod.name}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'تاريخ الطلب',
      sortable: true,
      render: (req) => (
        <span className="text-sm">{new Date(req.createdAt).toLocaleDateString('ar-EG')}</span>
      ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (req) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() =>
              toast({
                title: `تفاصيل الطلب: ${req.gameName}`,
                description: req.notes || 'بدون ملاحظات',
              })
            }
            aria-label="عرض التفاصيل"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            disabled={req.status === 'completed' || req.status === 'cancelled'}
            title={
              req.status === 'completed' || req.status === 'cancelled'
                ? 'الطلب مكتمل أو مغلق بالفعل'
                : 'إغلاق الطلب'
            }
            onClick={async () => {
              if (!confirm(`هل تريد إغلاق طلب تعريب "${req.gameName}"؟`)) return
              try {
                const res = await fetch(`/api/admin/mod-requests/${req.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'cancelled' }),
                })
                if (!res.ok) throw new Error('فشل')
                toast({ title: 'تم إغلاق الطلب' })
                router.refresh()
              } catch {
                toast({ title: 'خطأ', description: 'فشل إغلاق الطلب', variant: 'destructive' })
              }
            }}
            aria-label="إغلاق الطلب"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: '100px',
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: 'status',
      label: 'الحالة',
      type: 'checkbox',
      options: [
        { label: 'مفتوح', value: 'open' },
        { label: 'مقبول', value: 'accepted' },
        { label: 'مكتمل', value: 'completed' },
        { label: 'ملغي', value: 'cancelled' },
      ],
    },
    {
      key: 'platform',
      label: 'المنصة',
      type: 'checkbox',
      options: [
        { label: 'PC', value: 'PC' },
        { label: 'PlayStation', value: 'PlayStation' },
        { label: 'Xbox', value: 'Xbox' },
        { label: 'Nintendo', value: 'Nintendo' },
        { label: 'Mobile', value: 'Mobile' },
      ],
    },
  ]

  const activeFilters: Record<string, string[]> = {
    status: statusFilter,
    platform: platformFilter,
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'إغلاق جماعي',
      variant: 'destructive',
      confirmMessage: 'هل تريد إغلاق الطلبات المحددة؟',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/mod-requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
          })
        }
        router.refresh()
      },
    },
    {
      label: 'تصدير CSV',
      variant: 'outline',
      onAction: async (ids) => {
        const selected = filteredData.filter((r) => ids.includes(r.id))
        const headers = ['اللعبة', 'المنصة', 'الطالب', 'الحالة', 'الاهتمام', 'تاريخ الطلب']
        const rows = selected.map((r) => [
          r.gameName,
          r.platform,
          r.user.username,
          r.status,
          String(r.interestCount),
          new Date(r.createdAt).toLocaleDateString('ar-EG'),
        ])
        const csv = `\uFEFF${headers.join(',')}\n${rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'mod-requests.csv'
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">طلبات التعريب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          جميع طلبات التعريب من المستخدمين — يمكن للمُعَرِّبين قبولها
        </p>
      </div>

      <AdminDataTable
        data={filteredData}
        columns={columns}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        searchQuery={search}
        onSearch={handleSearch}
        searchPlaceholder="ابحث عن لعبة أو منصة..."
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        stats={stats}
        emptyState={{
          icon: 'Inbox',
          title: 'لا توجد طلبات تعريب',
          description: 'لم يطلب أي مستخدم تعريب لعبة بعد',
        }}
        exportable
        exportFilename="mod-requests.csv"
        mobileCardView={(req, isSelected, onToggle) => (
          <Card className={isSelected ? 'ring-1 ring-primary/30 bg-primary/5' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Gamepad2 className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{req.gameName}</div>
                  <div className="text-xs text-muted-foreground">
                    {req.platform} · {req.user.username}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {req.status === 'open'
                    ? 'مفتوح'
                    : req.status === 'accepted'
                      ? 'مقبول'
                      : req.status === 'completed'
                        ? 'مكتمل'
                        : 'ملغي'}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div className="text-center">
                  <div className="font-bold flex items-center justify-center gap-1">
                    <Heart className="h-3 w-3 text-red-500" />
                    {req.interestCount}
                  </div>
                  <div className="text-xs text-muted-foreground">اهتمام</div>
                </div>
                <div className="text-center">
                  <div className="font-bold truncate">{req.acceptedUser?.username || '—'}</div>
                  <div className="text-xs text-muted-foreground">المُعَرِّب</div>
                </div>
                <div className="text-center">
                  <div className="text-xs">
                    {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                  <div className="text-xs text-muted-foreground">التاريخ</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-h-[44px] text-xs"
                  onClick={onToggle}
                >
                  {isSelected ? 'إلغاء' : 'تحديد'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 min-h-[44px] text-xs"
                  onClick={() => (window.location.href = `/mod/${req.mod?.slug || ''}`)}
                  disabled={!req.mod}
                >
                  عرض التعريب
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
