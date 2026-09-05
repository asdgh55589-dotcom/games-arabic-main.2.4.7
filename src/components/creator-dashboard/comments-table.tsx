'use client'

import Link from 'next/link'
import * as React from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreatorDataTable, type CreatorTableFeatures } from '@/components/creator-dashboard/data-table'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

interface CreatorCommentRow {
  id: string
  text: string
  isHidden: boolean
  createdAt: string
  user: { id: string; username: string } | null
  mod: { id: string; name: string; slug: string }
}

const columnHelper = createColumnHelper<CreatorTableFeatures, CreatorCommentRow>()

export function CommentsTable({ filter = 'all' }: { filter?: string }) {
  const { toast } = useToast()
  const [rows, setRows] = React.useState<CreatorCommentRow[]>([])
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
        filter,
      })
      const res = await fetch(`/api/creator/comments?${params.toString()}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || !json.data) throw new Error('فشل تحميل التعليقات')
      setRows(json.data.comments ?? [])
      setTotalPages(json.data.pagination?.totalPages ?? 1)
    } catch (err) {
      console.error('[creator-dashboard] comments table load failed:', err)
      setError(err instanceof Error ? err.message : 'فشل تحميل التعليقات')
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    setPage(1)
  }, [filter])

  const setHidden = async (id: string, hide: boolean) => {
    setActingId(id)
    try {
      const res = await fetch(`/api/creator/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: hide ? 'hide' : 'unhide' }),
      })
      if (!res.ok) throw new Error(hide ? 'فشل الإخفاء' : 'فشل الإظهار')
      toast({ title: hide ? 'تم إخفاء التعليق' : 'تم إظهار التعليق' })
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
      columnHelper.accessor('text', {
        header: 'التعليق',
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md">
            <bdi>{row.original.text}</bdi>
          </span>
        ),
      }),
      columnHelper.accessor('mod', {
        header: 'التعريب',
        cell: ({ row }) => (
          <Link href={`/mod/${row.original.mod.slug}`} className="hover:underline">
            <bdi>{row.original.mod.name}</bdi>
          </Link>
        ),
      }),
      columnHelper.accessor('isHidden', {
        header: 'الحالة',
        cell: ({ row }) =>
          row.original.isHidden ? (
            <Badge variant="outline">مخفي</Badge>
          ) : (
            <Badge variant="secondary">ظاهر</Badge>
          ),
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
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={actingId === row.original.id}
            onClick={() => setHidden(row.original.id, !row.original.isHidden)}
            aria-label={row.original.isHidden ? 'إظهار التعليق' : 'إخفاء التعليق'}
          >
            {row.original.isHidden ? 'إظهار' : 'إخفاء'}
          </Button>
        ),
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
      emptyMessage="لا توجد تعليقات"
      tableLabel="جدول التعليقات"
      pagination={{ page, totalPages, onPageChange: setPage }}
    />
  )
}
