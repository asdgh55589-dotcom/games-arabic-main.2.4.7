'use client'

import {
  Archive,
  CheckCircle,
  Clock,
  Eye,
  Gamepad2,
  Heart,
  Inbox,
  PackageCheck,
  Play,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AdminDataTable,
  type BulkAction,
  type Column,
  type FilterConfig,
  type StatItem,
} from '@/components/admin/shared/AdminDataTable'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { MOD_REQUEST_STATUS_LABELS } from '@/lib/requests/state-machine'

interface ModRequestItem {
  id: string
  gameName: string
  platform: string
  notes: string | null
  rejectionReason: string | null
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

type ActionKind = 'accept' | 'reject' | 'complete'

const POLL_INTERVAL_MS = 30_000

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  accepted: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  in_progress: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  completed: 'bg-green-500/10 text-green-600 border-green-500/20',
  cancelled: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function statusLabel(status: string): string {
  return MOD_REQUEST_STATUS_LABELS[status as keyof typeof MOD_REQUEST_STATUS_LABELS] || status
}

function errorMessage(json: unknown): string {
  const err = (json as { error?: { message?: string; details?: unknown } })?.error
  if (typeof err?.details === 'string') return err.details
  return err?.message || 'فشل تنفيذ الإجراء'
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
  const [items, setItems] = useState<ModRequestItem[]>(initialData)
  const [total, setTotal] = useState(totalCount)
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

  const [dialog, setDialog] = useState<{ kind: ActionKind; req: ModRequestItem } | null>(null)
  const [translatorInput, setTranslatorInput] = useState('')
  const [reasonInput, setReasonInput] = useState('')
  const [modInput, setModInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setItems(initialData)
    setTotal(totalCount)
  }, [initialData, totalCount])

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

  const refresh = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
    if (search) params.set('search', search)
    if (statusFilter.length === 1) params.set('status', statusFilter[0])
    if (platformFilter.length === 1) params.set('platform', platformFilter[0])
    params.set('sort', sortField)
    params.set('direction', sortDirection)
    try {
      const res = await fetch(`/api/admin/mod-requests?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const json = await res.json()
      const rows = json?.data?.data
      if (Array.isArray(rows)) setItems(rows)
      const nextTotal = json?.data?.pagination?.total
      if (typeof nextTotal === 'number') setTotal(nextTotal)
    } catch {
      // polling is best-effort
    }
  }, [page, pageSize, search, statusFilter, platformFilter, sortField, sortDirection])

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const patchRequest = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/mod-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(errorMessage(json))
    return json
  }

  const openDialog = (kind: ActionKind, req: ModRequestItem) => {
    setTranslatorInput('')
    setReasonInput('')
    setModInput(req.mod?.id || '')
    setDialog({ kind, req })
  }

  const submitDialog = async () => {
    if (!dialog) return
    const body: Record<string, unknown> = {}
    if (dialog.kind === 'accept') {
      body.status = 'accepted'
      if (!translatorInput.trim()) {
        toast({ title: 'يرجى اختيار المُعَرِّب', variant: 'destructive' })
        return
      }
      body.acceptedBy = translatorInput.trim()
    } else if (dialog.kind === 'reject') {
      if (!reasonInput.trim()) {
        toast({ title: 'يرجى إدخال سبب الرفض', variant: 'destructive' })
        return
      }
      body.status = 'rejected'
      body.reason = reasonInput.trim()
    } else {
      if (!modInput.trim()) {
        toast({ title: 'يرجى إدخال معرف التعريب أو رابطه', variant: 'destructive' })
        return
      }
      body.status = 'completed'
      body.modId = modInput.trim()
    }

    setSaving(true)
    try {
      await patchRequest(dialog.req.id, body)
      toast({
        title:
          dialog.kind === 'accept'
            ? 'تم قبول الطلب'
            : dialog.kind === 'reject'
              ? 'تم رفض الطلب'
              : 'تم إكمال الطلب',
      })
      setDialog(null)
      await refresh()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
    setSaving(false)
  }

  const startRequest = async (req: ModRequestItem) => {
    try {
      await patchRequest(req.id, { status: 'in_progress' })
      toast({ title: 'تم بدء تنفيذ الطلب' })
      await refresh()
    } catch (err) {
      toast({ title: 'خطأ', description: (err as Error).message, variant: 'destructive' })
    }
  }

  const filteredData = useMemo(() => {
    let d = [...items]
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
  }, [items, statusFilter, platformFilter, search])

  const stats: StatItem[] = [
    { label: 'إجمالي الطلبات', value: total, icon: Inbox },
    { label: 'مفتوحة', value: items.filter((r) => r.status === 'open').length, icon: Clock },
    {
      label: 'مقبولة',
      value: items.filter((r) => r.status === 'accepted').length,
      icon: CheckCircle,
    },
    {
      label: 'قيد التنفيذ',
      value: items.filter((r) => r.status === 'in_progress').length,
      icon: Play,
    },
    {
      label: 'مكتملة',
      value: items.filter((r) => r.status === 'completed').length,
      icon: Gamepad2,
    },
    {
      label: 'إجمالي الاهتمام',
      value: items.reduce((sum, r) => sum + r.interestCount, 0),
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
          <Gamepad2 className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="truncate font-medium">{req.gameName}</div>
            <div className="text-muted-foreground text-xs">{req.platform}</div>
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
          <span className="truncate text-sm">{req.user.username}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'الحالة',
      sortable: true,
      render: (req) => (
        <Badge variant="outline" className={STATUS_STYLES[req.status] || STATUS_STYLES.open}>
          {statusLabel(req.status)}
        </Badge>
      ),
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
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'mod',
      label: 'التعريب المكتمل',
      render: (req) =>
        req.mod ? (
          <Link
            href={`/mod/${req.mod.slug}`}
            className="block max-w-[150px] truncate text-primary text-sm hover:underline"
          >
            {req.mod.name}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
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
                description:
                  [
                    req.rejectionReason ? `سبب الرفض: ${req.rejectionReason}` : null,
                    req.notes,
                  ]
                    .filter(Boolean)
                    .join(' — ') || 'بدون ملاحظات',
              })
            }
            aria-label="عرض التفاصيل"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {req.status === 'open' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-600"
                onClick={() => openDialog('accept', req)}
                aria-label="قبول وتعيين مُعَرِّب"
                title="قبول وتعيين مُعَرِّب"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-600"
                onClick={() => openDialog('reject', req)}
                aria-label="رفض الطلب"
                title="رفض الطلب"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </>
          )}
          {req.status === 'accepted' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600"
              onClick={() => startRequest(req)}
              aria-label="بدء التنفيذ"
              title="بدء التنفيذ"
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
          {(req.status === 'accepted' || req.status === 'in_progress') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600"
              onClick={() => openDialog('complete', req)}
              aria-label="إكمال الطلب"
              title="إكمال الطلب"
            >
              <PackageCheck className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500"
            disabled={['completed', 'cancelled', 'rejected'].includes(req.status)}
            title={
              ['completed', 'cancelled', 'rejected'].includes(req.status)
                ? 'الطلب مغلق بالفعل'
                : 'إغلاق الطلب'
            }
            onClick={async () => {
              if (!confirm(`هل تريد إغلاق طلب تعريب "${req.gameName}"؟`)) return
              try {
                await patchRequest(req.id, { status: 'cancelled' })
                toast({ title: 'تم إغلاق الطلب' })
                await refresh()
              } catch (err) {
                toast({
                  title: 'خطأ',
                  description: (err as Error).message,
                  variant: 'destructive',
                })
              }
            }}
            aria-label="إغلاق الطلب"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ),
      width: '140px',
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
        { label: 'قيد التنفيذ', value: 'in_progress' },
        { label: 'مكتمل', value: 'completed' },
        { label: 'ملغي', value: 'cancelled' },
        { label: 'مرفوض', value: 'rejected' },
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
        const cancellable = filteredData.filter(
          (r) => ids.includes(r.id) && ['open', 'accepted', 'in_progress'].includes(r.status),
        )
        for (const req of cancellable) {
          try {
            await patchRequest(req.id, { status: 'cancelled' })
          } catch {
            // one failed item must not abort the bulk cancel
          }
        }
        await refresh()
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
        <h1 className="font-bold text-3xl tracking-tight">طلبات التعريب</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          جميع طلبات التعريب من المستخدمين — يمكن للمُعَرِّبين قبولها
        </p>
      </div>

      <AdminDataTable
        data={filteredData}
        columns={columns}
        totalCount={total}
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
          <Card className={isSelected ? 'bg-primary/5 ring-1 ring-primary/30' : ''}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <Gamepad2 className="h-8 w-8 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{req.gameName}</div>
                  <div className="text-muted-foreground text-xs">
                    {req.platform} · {req.user.username}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {statusLabel(req.status)}
                </Badge>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 font-bold">
                    <Heart className="h-3 w-3 text-red-500" />
                    {req.interestCount}
                  </div>
                  <div className="text-muted-foreground text-xs">اهتمام</div>
                </div>
                <div className="text-center">
                  <div className="truncate font-bold">{req.acceptedUser?.username || '—'}</div>
                  <div className="text-muted-foreground text-xs">المُعَرِّب</div>
                </div>
                <div className="text-center">
                  <div className="text-xs">
                    {new Date(req.createdAt).toLocaleDateString('ar-EG')}
                  </div>
                  <div className="text-muted-foreground text-xs">التاريخ</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] flex-1 text-xs"
                  onClick={onToggle}
                >
                  {isSelected ? 'إلغاء' : 'تحديد'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] flex-1 text-xs"
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

      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === 'accept'
                ? 'قبول الطلب وتعيين مُعَرِّب'
                : dialog?.kind === 'reject'
                  ? 'رفض طلب التعريب'
                  : 'إكمال طلب التعريب'}
            </DialogTitle>
            <DialogDescription>
              {dialog?.req.gameName} — {dialog?.req.platform}
            </DialogDescription>
          </DialogHeader>

          {dialog?.kind === 'accept' && (
            <div className="space-y-2">
              <Label htmlFor="translator">اسم المستخدم للمُعَرِّب (اختياري)</Label>
              <Input
                id="translator"
                value={translatorInput}
                onChange={(e) => setTranslatorInput(e.target.value)}
                placeholder="اتركه فارغاً للقبول بدون تعيين"
              />
            </div>
          )}

          {dialog?.kind === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="reason">سبب الرفض *</Label>
              <Textarea
                id="reason"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="اذكر سبب رفض الطلب..."
                rows={3}
              />
            </div>
          )}

          {dialog?.kind === 'complete' && (
            <div className="space-y-2">
              <Label htmlFor="modId">معرف التعريب أو الـslug *</Label>
              <Input
                id="modId"
                value={modInput}
                onChange={(e) => setModInput(e.target.value)}
                placeholder="مثال: the-witcher-3-arabic"
                dir="ltr"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={submitDialog} disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'تأكيد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
