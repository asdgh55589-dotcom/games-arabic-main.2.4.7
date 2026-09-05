'use client'

import * as React from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreatorDataTable, type CreatorTableFeatures } from '@/components/creator-dashboard/data-table'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

interface CreatorRequestRow {
  id: string
  gameName: string
  platform: string
  status: string
  interestCount: number
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'متاح',
  accepted: 'مقبول',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const columnHelper = createColumnHelper<CreatorTableFeatures, CreatorRequestRow>()

export function RequestsTable({ status = 'open' }: { status?: string }) {
  const { toast } = useToast()
  const [rows, setRows] = React.useState<CreatorRequestRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [actingId, setActingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        status,
      })
      const res = await fetch(`/api/creator/requests?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || !json.data) throw new Error('فشل تحميل الطلبات')
      setRows(json.data.requests ?? [])
      setTotalPages(json.data.pagination?.totalPages ?? 1)
    } catch (err) {
      console.error('[creator-dashboard] requests table load failed:', err)
      setError(err instanceof Error ? err.message : 'فشل تحميل الطلبات')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    setPage(1)
  }, [status])

  const accept = async (id: string) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/creator/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          json?.error?.message || (typeof json?.error === 'string' ? json.error : null) || 'فشل القبول',
        )
      }
      toast({ title: 'تم قبول الطلب' })
      load()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'حدث خطأ',
        variant: 'destructive',
      })
    } finally {
      setActingId(null)
    }
  }

  const columns = React.useMemo(
    () => [
      columnHelper.accessor('gameName', {
        header: 'اللعبة',
        cell: ({ row }) => (
          <span className="font-bold">
            <bdi>{row.original.gameName}</bdi>
          </span>
        ),
      }),
      columnHelper.accessor('platform', {
        header: 'المنصة',
        cell: ({ row }) => <bdi>{row.original.platform}</bdi>,
      }),
      columnHelper.accessor('status', {
        header: 'الحالة',
        cell: ({ row }) => (
          <Badge variant="outline">{STATUS_LABELS[row.original.status] || row.original.status}</Badge>
        ),
      }),
      columnHelper.accessor('interestCount', {
        header: 'الاهتمام',
        cell: ({ row }) => row.original.interestCount.toLocaleString('ar-EG'),
      }),
      columnHelper.accessor('createdAt', {
        header: 'التاريخ',
        cell: ({ row }) => (
          <time dateTime={new Date(row.original.createdAt).toISOString()}>
            {timeAgo(row.original.createdAt)}
          </time>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'إجراءات',
        cell: ({ row }) =>
          row.original.status === 'open' ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={actingId === row.original.id}
              onClick={() => accept(row.original.id)}
              aria-label={`قبول طلب ${row.original.gameName}`}
            >
              قبول
            </Button>
          ) : null,
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actingId],
  )

  return (
    <CreatorDataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={load}
      emptyMessage="لا توجد طلبات"
      tableLabel="جدول طلبات التعريب"
      pagination={{ page, totalPages, onPageChange: setPage }}
    />
  )
}
