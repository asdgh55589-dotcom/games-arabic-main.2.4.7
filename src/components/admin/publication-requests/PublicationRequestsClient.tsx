'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Inbox, Users, PenTool, Upload, Shield, AlertTriangle, Package, Star } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { CreatorBadge } from '@/components/creator-badge'
import {
  AdminDataTable,
  type Column,
  type FilterConfig,
  type BulkAction,
  type StatItem,
} from '@/components/admin/shared/AdminDataTable'
import { ModWorkflowActions } from '@/components/admin/shared/ModWorkflowActions'
import { timeAgo } from '@/lib/format'

interface PublicationMod {
  id: string
  slug: string
  name: string
  thumbnailUrl: string
  version: string
  workflowStatus: string
  updatedAt: string
  createdAt: string
  qualityScore: number | null
  reviewerId: string | null
  teamId: string | null
  author: {
    id: string
    username: string
    avatarUrl: string | null
    role: string
    tier: number
    specialRoles: string | null
  }
  teamRelation: { id: string; name: string; logoUrl: string | null } | null
  game: { id: string; name: string } | null
  reviewer: { id: string; username: string; avatarUrl: string | null } | null
  source: { label: string; color: string }
  waitingDays: number
  isOverdue: boolean
}

interface Props {
  initialData: PublicationMod[]
  totalCount: number
  stats: { total: number; team: number; creator: number; publisher: number; overdue: number }
  games: { id: string; name: string }[]
  reviewers: { id: string; username: string; avatarUrl: string | null }[]
  currentUser: { id: string; role: string; username: string }
  initialPage: number
  initialPageSize: number
  initialSearch: string
  initialSource: string
  initialGame: string
  initialReviewer: string
  initialOverdue: string
  initialSort: string
  initialDirection: string
}

export function PublicationRequestsClient({
  initialData,
  totalCount,
  stats,
  games,
  reviewers,
  currentUser,
  initialPage,
  initialPageSize,
  initialSearch,
  initialSource,
  initialGame,
  initialReviewer,
  initialOverdue,
  initialSort,
  initialDirection,
}: Props) {
  const router = useRouter()
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [search, setSearch] = useState(initialSearch)
  const [sourceFilter, setSourceFilter] = useState<string[]>(
    initialSource === 'all' ? [] : [initialSource],
  )
  const [gameFilter, setGameFilter] = useState<string[]>(initialGame === 'all' ? [] : [initialGame])
  const [reviewerFilter, setReviewerFilter] = useState<string[]>(
    initialReviewer === 'all' ? [] : [initialReviewer],
  )
  const [overdueFilter, setOverdueFilter] = useState<string[]>(
    initialOverdue === 'all' ? [] : [initialOverdue],
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
    router.push(`/admin/publication-requests?${params.toString()}`)
  }

  const handleSearch = (q: string) => {
    setSearch(q)
    setPage(1)
    updateUrl({ search: q, page: '1' })
  }

  const handleFilterChange = (key: string, values: string[]) => {
    if (key === 'source') setSourceFilter(values)
    if (key === 'game') setGameFilter(values)
    if (key === 'reviewer') setReviewerFilter(values)
    if (key === 'overdue') setOverdueFilter(values)
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
    if (sourceFilter.length > 0) {
      const v = sourceFilter[0]
      if (v === 'team') d = d.filter((m) => !!m.teamId)
      else if (v === 'creator') d = d.filter((m) => m.author.role === 'creator' && !m.teamId)
      else if (v === 'publisher') d = d.filter((m) => m.author.role === 'publisher' && !m.teamId)
      else if (v === 'admin')
        d = d.filter((m) => ['admin', 'manager', 'owner'].includes(m.author.role))
    }
    if (gameFilter.length > 0) d = d.filter((m) => gameFilter.includes(m.game?.id || ''))
    if (reviewerFilter.length > 0) {
      if (reviewerFilter[0] === 'unassigned') d = d.filter((m) => !m.reviewerId)
      else d = d.filter((m) => reviewerFilter.includes(m.reviewerId || ''))
    }
    if (overdueFilter.length > 0 && overdueFilter[0] === 'overdue') d = d.filter((m) => m.isOverdue)
    if (search) {
      const q = search.toLowerCase()
      d = d.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.author.username.toLowerCase().includes(q) ||
          (m.game?.name || '').toLowerCase().includes(q),
      )
    }
    return d
  }, [initialData, sourceFilter, gameFilter, reviewerFilter, overdueFilter, search])

  const statsItems: StatItem[] = [
    { label: 'إجمالي الطلبات المعلقة', value: stats.total, icon: Inbox },
    { label: 'من الفرق', value: stats.team, icon: Users },
    { label: 'من المُعَرِّبين', value: stats.creator, icon: PenTool },
    { label: 'من الناشرين', value: stats.publisher, icon: Upload },
    { label: 'متأخرة (> 7 أيام)', value: stats.overdue, icon: AlertTriangle },
  ]

  const columns: Column<PublicationMod>[] = [
    {
      key: 'mod',
      label: 'التعريب',
      sortable: true,
      render: (mod) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 rounded-md">
            <AvatarImage src={mod.thumbnailUrl || undefined} />
            <AvatarFallback>
              <Package className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium flex items-center gap-2 truncate">
              <span className="truncate">{mod.name}</span>
              {mod.isOverdue && (
                <Badge variant="destructive" className="text-[11px] gap-1 shrink-0">
                  <AlertTriangle className="h-3 w-3" />
                  متأخر
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {mod.game?.name || 'بدون لعبة'} · {mod.version || 'v1.0'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'المؤلف',
      render: (mod) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={mod.author.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px]">
              {mod.author.username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-sm flex items-center gap-1 truncate">
              {mod.author.username}
              <RoleBadge role={mod.author.role} size="sm" />
              <CreatorBadge
                role={mod.author.role}
                specialRoles={mod.author.specialRoles}
                size="sm"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              <TierBadge role={mod.author.role} tier={mod.author.tier} size="sm" />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'team',
      label: 'الفريق',
      render: (mod) =>
        mod.teamRelation ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={mod.teamRelation.logoUrl || undefined} />
              <AvatarFallback className="text-[10px]">
                {mod.teamRelation.name[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate max-w-[120px]">{mod.teamRelation.name}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">فردي</span>
        ),
    },
    {
      key: 'source',
      label: 'المصدر',
      sortable: true,
      render: (mod) => (
        <Badge variant="outline" className={`text-xs ${mod.source.color}`}>
          {mod.source.label}
        </Badge>
      ),
    },
    {
      key: 'submittedAt',
      label: 'تاريخ الإرسال',
      sortable: true,
      render: (mod) => (
        <div>
          <div className="text-sm">{new Date(mod.updatedAt).toLocaleDateString('ar-EG')}</div>
          <div className="text-xs text-muted-foreground">منذ {mod.waitingDays} يوم</div>
        </div>
      ),
    },
    {
      key: 'qualityScore',
      label: 'الجودة',
      sortable: true,
      render: (mod) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="h-3 w-3 text-yellow-500" />
          {mod.qualityScore ?? '—'}%
        </span>
      ),
    },
    {
      key: 'reviewer',
      label: 'المُراجع المُسند',
      render: (mod) =>
        mod.reviewer ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={mod.reviewer.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px]">
                {mod.reviewer.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate max-w-[100px]">{mod.reviewer.username}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">غير مُسند</span>
        ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (mod) => (
        <ModWorkflowActions
          mod={{
            id: mod.id,
            slug: mod.slug,
            name: mod.name,
            workflowStatus: mod.workflowStatus,
            authorId: mod.author.id,
            author: mod.author as never,
            version: mod.version,
            qualityScore: mod.qualityScore || undefined,
          }}
          currentUser={currentUser as never}
          onActionComplete={() => router.refresh()}
        />
      ),
      width: '80px',
    },
  ]

  const filters: FilterConfig[] = [
    {
      key: 'source',
      label: 'المصدر',
      type: 'checkbox',
      options: [
        { label: 'فريق', value: 'team' },
        { label: 'مُعَرِّب', value: 'creator' },
        { label: 'ناشر', value: 'publisher' },
        { label: 'إداري', value: 'admin' },
      ],
    },
    {
      key: 'game',
      label: 'اللعبة',
      type: 'select',
      options: [
        { label: 'الكل', value: 'all' },
        ...games.map((g) => ({ label: g.name, value: g.id })),
      ],
    },
    {
      key: 'reviewer',
      label: 'المُراجع',
      type: 'select',
      options: [
        { label: 'الكل', value: 'all' },
        { label: 'غير مُسند', value: 'unassigned' },
        ...reviewers.map((r) => ({ label: r.username, value: r.id })),
      ],
    },
    {
      key: 'overdue',
      label: 'متأخرة فقط',
      type: 'radio',
      options: [
        { label: 'الكل', value: 'all' },
        { label: 'متأخرة (> 7 أيام)', value: 'overdue' },
      ],
    },
  ]

  const activeFilters: Record<string, string[]> = {
    source: sourceFilter,
    game: gameFilter,
    reviewer: reviewerFilter,
    overdue: overdueFilter,
  }

  const bulkActions: BulkAction[] = [
    {
      label: 'موافقة جماعية',
      variant: 'default',
      confirmMessage: 'هل تريد الموافقة على جميع التعريبات المحددة؟ سيتم نشرها فوراً.',
      onAction: async (ids) => {
        for (const id of ids) {
          await fetch(`/api/admin/mods/${id}/workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', toStatus: 'APPROVED' }),
          }).catch(async () => {
            await fetch(`/api/admin/mods/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workflowStatus: 'APPROVED' }),
            })
          })
        }
        router.refresh()
      },
    },
    {
      label: 'رفض جماعي',
      variant: 'destructive',
      confirmMessage: 'هل تريد رفض جميع التعريبات المحددة؟',
      onAction: async (ids) => {
        const reason = prompt('سبب الرفض:')
        if (!reason) return
        for (const id of ids) {
          await fetch(`/api/admin/mods/${id}/workflow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', toStatus: 'REJECTED', reason }),
          }).catch(async () => {
            await fetch(`/api/admin/mods/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workflowStatus: 'REJECTED', rejectionReason: reason }),
            })
          })
        }
        router.refresh()
      },
    },
    {
      label: 'إسناد لمُراجع',
      variant: 'outline',
      confirmMessage: 'هل تريد إسناد التعريبات المحددة لمُراجع؟ سيُطلب منك إدخال معرف المراجع.',
      onAction: async (ids) => {
        const reviewerId = prompt('معرف المراجع (ID):')
        if (!reviewerId) return
        for (const id of ids) {
          await fetch(`/api/admin/mods/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewerId }),
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
        const headers = ['التعريب', 'المؤلف', 'المصدر', 'اللعبة', 'تاريخ الإرسال', 'الجودة']
        const rows = selected.map((m) => [
          m.name,
          m.author.username,
          m.source.label,
          m.game?.name || '',
          new Date(m.updatedAt).toLocaleDateString('ar-EG'),
          String(m.qualityScore || ''),
        ])
        const csv = `\uFEFF${headers.join(',')}\n${rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')}`
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'publication-requests.csv'
        a.click()
        URL.revokeObjectURL(url)
      },
    },
  ]

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">طلبات نشر التعريبات</h1>
        <p className="text-sm text-muted-foreground">
          طابور موحد لكل التعريبات بانتظار المراجعة — حسب المصدر (فرق/مُعَرِّبين/ناشرين/إداريين) —
          الأقدم أولاً (FIFO)
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
        searchPlaceholder="ابحث باسم التعريب أو المؤلف أو اللعبة..."
        filters={filters}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={bulkActions}
        stats={statsItems}
        emptyState={{
          icon: 'Inbox',
          title: 'لا توجد طلبات نشر معلقة',
          description: 'جميع التعريبات تم مراجعتها. استرخِ! 🎉',
        }}
        exportable
        exportFilename="publication-requests.csv"
        mobileCardView={(mod, isSelected, onToggle) => (
          <Card
            className={
              mod.isOverdue
                ? 'border-red-500/50 bg-red-500/5'
                : isSelected
                  ? 'ring-1 ring-primary/30 bg-primary/5'
                  : ''
            }
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <Avatar className="h-10 w-10 rounded-md">
                  <AvatarImage src={mod.thumbnailUrl || undefined} />
                  <AvatarFallback>
                    <Package className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2 truncate">
                    <span className="truncate">{mod.name}</span>
                    {mod.isOverdue && (
                      <Badge variant="destructive" className="text-[11px] shrink-0">
                        متأخر
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {mod.game?.name || 'بدون لعبة'} · {mod.author.username} ·{' '}
                    <span className={mod.source.color + ' rounded px-1.5 py-0.5 text-[11px]'}>
                      {mod.source.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>
                  منذ {mod.waitingDays} يوم · جودة {mod.qualityScore ?? '—'}%
                </span>
                <span>{mod.reviewer ? `مُسند: ${mod.reviewer.username}` : 'غير مُسند'}</span>
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
                <div className="flex-1">
                  <ModWorkflowActions
                    mod={{
                      id: mod.id,
                      slug: mod.slug,
                      name: mod.name,
                      workflowStatus: mod.workflowStatus,
                      authorId: mod.author.id,
                      author: mod.author as never,
                      version: mod.version,
                      qualityScore: mod.qualityScore || undefined,
                    }}
                    currentUser={currentUser as never}
                    onActionComplete={() => router.refresh()}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      />
    </div>
  )
}
