'use client'

import Link from 'next/link'
import * as React from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreatorDataTable, type CreatorTableFeatures } from '@/components/creator-dashboard/data-table'
import { timeAgo } from '@/lib/format'

interface CreatorModRow {
  id: string
  name: string
  slug: string
  workflowStatus: string
  views: number | null
  downloads: number | null
  rating: number | null
  updatedAt: string
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  PUBLISHED: 'منشور',
  REJECTED: 'مرفوض',
  ARCHIVED: 'مؤرشف',
}

const columnHelper = createColumnHelper<CreatorTableFeatures, CreatorModRow>()

const columns = [
  columnHelper.accessor('name', {
    header: 'التعريب',
    cell: ({ row }) => (
      <Link href={`/creator/mods/${row.original.id}/edit`} className="font-bold hover:underline">
        <bdi>{row.original.name}</bdi>
      </Link>
    ),
  }),
  columnHelper.accessor('workflowStatus', {
    header: 'الحالة',
    cell: ({ row }) => (
      <Badge variant="outline">
        {STATUS_LABELS[row.original.workflowStatus] || row.original.workflowStatus}
      </Badge>
    ),
  }),
  columnHelper.accessor('downloads', {
    header: 'التحميلات',
    cell: ({ row }) => (row.original.downloads ?? 0).toLocaleString('ar-EG'),
  }),
  columnHelper.accessor('views', {
    header: 'المشاهدات',
    cell: ({ row }) => (row.original.views ?? 0).toLocaleString('ar-EG'),
  }),
  columnHelper.accessor('updatedAt', {
    header: 'آخر تحديث',
    cell: ({ row }) => (
      <time dateTime={new Date(row.original.updatedAt).toISOString()}>
        {timeAgo(row.original.updatedAt)}
      </time>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: 'إجراءات',
    cell: ({ row }) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/mod/${row.original.slug}`} aria-label={`عرض ${row.original.name}`}>
            عرض
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/creator/mods/${row.original.id}/edit`} aria-label={`تعديل ${row.original.name}`}>
            تعديل
          </Link>
        </Button>
      </div>
    ),
  }),
]

export function ModsTable({ status }: { status?: string }) {
  const [rows, setRows] = React.useState<CreatorModRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' })
      if (status && status !== 'all') params.set('status', status)
      const res = await fetch(`/api/creator/mods?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.data) throw new Error('فشل تحميل التعريبات')
      setRows(json.data.mods ?? [])
      setTotalPages(json.data.pagination?.totalPages ?? 1)
    } catch (err) {
      console.error('[creator-dashboard] mods table load failed:', err)
      setError(err instanceof Error ? err.message : 'فشل تحميل التعريبات')
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

  return (
    <CreatorDataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      loading={loading}
      error={error}
      onRetry={load}
      emptyMessage="لا توجد تعريبات بعد"
      tableLabel="جدول التعريبات"
      pagination={{ page, totalPages, onPageChange: setPage }}
    />
  )
}
