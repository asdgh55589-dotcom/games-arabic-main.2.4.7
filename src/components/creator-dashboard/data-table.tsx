'use client'

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
} from 'lucide-react'
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  FlexRender,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type SortingState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// New in v9: declare the features this table uses — anything unregistered
// is tree-shaken out of the bundle.
const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
})

export type CreatorTableFeatures = typeof features

export interface ServerPagination {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

interface CreatorDataTableProps<T extends Record<string, any>> {
  columns: ColumnDef<CreatorTableFeatures, T, any>[]
  data: T[]
  getRowId: (row: T) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyMessage?: string
  pagination?: ServerPagination
  selectable?: boolean
  tableLabel: string
}

export function CreatorDataTable<T extends Record<string, any>>({
  columns,
  data,
  getRowId,
  loading = false,
  error = null,
  onRetry,
  emptyMessage = 'لا توجد بيانات',
  pagination,
  selectable = false,
  tableLabel,
}: CreatorDataTableProps<T>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])

  const selectColumn: ColumnDef<CreatorTableFeatures, T, any> | null = selectable
    ? {
        id: 'select',
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="تحديد الكل"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="تحديد الصف"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      }
    : null

  const table = useTable({
    features,
    data,
    columns: (selectColumn ? [selectColumn, ...columns] : columns) as ColumnDef<CreatorTableFeatures, T, any>[],
    state: { sorting, columnVisibility, rowSelection },
    getRowId,
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
  })

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="جاري تحميل الجدول">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-12 text-center" role="alert">
        <p className="text-sm font-bold text-destructive">فشل تحميل البيانات</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 min-h-[44px]">
            إعادة المحاولة
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" aria-label="إظهار/إخفاء الأعمدة">
              <Columns3 className="size-4" aria-hidden="true" />
              الأعمدة
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {typeof column.columnDef.header === 'string'
                    ? column.columnDef.header
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table aria-label={tableLabel}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <FlexRender header={header} /> }
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2" dir="rtl">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(1)}
            aria-label="الصفحة الأولى"
          >
            <ChevronsRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            aria-label="السابق"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
          <span className="text-xs text-muted-foreground">
            صفحة {pagination.page} من {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            aria-label="التالي"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => pagination.onPageChange(pagination.totalPages)}
            aria-label="الصفحة الأخيرة"
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
