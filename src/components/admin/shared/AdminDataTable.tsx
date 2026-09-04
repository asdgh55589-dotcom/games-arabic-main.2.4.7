'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Download,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { cn } from '@/lib/utils'

// ===== Interfaces (بدون اختصار - كل الحقول مطلوبة حسب المواصفات) =====
export interface Column<T> {
  key: string
  label: string // عربي
  sortable?: boolean
  render: (item: T) => React.ReactNode
  width?: string
}

export interface FilterConfig {
  key: string
  label: string // عربي
  type: 'checkbox' | 'radio' | 'select' | 'date-range'
  options: { label: string; value: string }[]
}

export interface BulkAction {
  label: string // عربي
  icon?: string
  variant?: 'default' | 'destructive' | 'outline'
  confirmMessage?: string
  onAction: (ids: string[]) => Promise<void>
}

export interface RowAction<T> {
  label: string
  icon?: string
  variant?: 'default' | 'destructive' | 'outline'
  onAction: (item: T) => void
  disabled?: (item: T) => boolean
  disabledReason?: string
}

export interface StatItem {
  label: string // عربي
  value: number | string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
}

export interface AdminDataTableProps<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  totalCount: number
  // Pagination
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  // Sorting
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (field: string, direction: 'asc' | 'desc') => void
  // Search
  searchQuery?: string
  onSearch?: (query: string) => void
  searchPlaceholder?: string // عربي
  // Filters
  filters?: FilterConfig[]
  activeFilters?: Record<string, string[]>
  onFilterChange?: (key: string, values: string[]) => void
  // Bulk
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  bulkActions?: BulkAction[]
  // Stats
  stats?: StatItem[]
  // Actions
  actions?: RowAction<T>[]
  // Empty
  emptyState?: {
    icon?: string
    title: string
    description: string
    action?: { label: string; href: string }
  }
  // Export
  exportable?: boolean
  exportFilename?: string
  onExport?: () => void
  // Responsive
  mobileCardView?: (item: T, isSelected: boolean, onToggle: () => void) => React.ReactNode
  // States
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function AdminDataTable<T extends { id: string }>({
  data,
  columns,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortField,
  sortDirection,
  onSort,
  searchQuery = '',
  onSearch,
  searchPlaceholder = 'بحث...',
  filters,
  activeFilters = {},
  onFilterChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],
  stats,
  actions,
  emptyState,
  exportable = false,
  exportFilename = 'export.csv',
  onExport,
  mobileCardView,
  loading = false,
  error = null,
  onRetry,
}: AdminDataTableProps<T>) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [showFilters, setShowFilters] = useState(false)
  const [bulkLoading, setBulkLoading] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const totalPages = Math.ceil(totalCount / pageSize) || 1
  const isAllSelected = data.length > 0 && selectedIds.length === data.length

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (onSearch) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = setTimeout(() => onSearch(value), 300)
    }
  }

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  const handleSort = (key: string) => {
    if (!onSort) return
    if (sortField === key) {
      onSort(key, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      onSort(key, 'asc')
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange(data.map((d) => d.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return
    if (checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter((x) => x !== id))
    }
  }

  const handleBulkAction = async (action: BulkAction) => {
    if (action.confirmMessage && !confirm(action.confirmMessage)) return
    setBulkLoading(action.label)
    try {
      await action.onAction(selectedIds)
      onSelectionChange?.([])
    } catch (e) {
      console.error(e)
    } finally {
      setBulkLoading(null)
    }
  }

  const handleExport = () => {
    if (onExport) {
      onExport()
      return
    }
    // Default CSV export (Arabic headers, UTF-8 BOM)
    const headers = columns.map((c) => `"${c.label}"`).join(',')
    const rows = data.map((item) =>
      columns
        .map((col) => {
          const val = col.render(item)
          // crude text extraction
          const text =
            typeof val === 'string'
              ? val
              : (item as Record<string, unknown>)[col.key]?.toString() || ''
          return `"${String(text).replace(/"/g, '""')}"`
        })
        .join(','),
    )
    const csv = `\uFEFF${headers}\n${rows.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeFilterCount = useMemo(
    () => Object.values(activeFilters).flat().length,
    [activeFilters],
  )

  if (loading) {
    return <DataTableSkeleton rows={5} cols={columns.length + (selectable ? 1 : 0)} />
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center" dir="rtl">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4 min-h-[44px]" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* ===== Stats Hero ===== */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center gap-3">
                  {Icon && (
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        stat.color || 'bg-primary/10',
                      )}
                    >
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </div>
                    <div className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                      {stat.value}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== Toolbar: Search + Filters + Export ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onSearch && (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 pr-10"
              aria-label="بحث"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="مسح البحث"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {filters && filters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-2"
              onClick={() => setShowFilters((s) => !s)}
              aria-label="فلترة"
            >
              <Filter className="h-4 w-4" />
              فلترة
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}

          {exportable && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px] gap-2"
              onClick={handleExport}
              aria-label="تصدير CSV"
            >
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
          )}

          {activeFilterCount > 0 && onFilterChange && (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[44px] text-xs"
              onClick={() => filters?.forEach((f) => onFilterChange(f.key, []))}
            >
              مسح كل الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* ===== Filters Panel ===== */}
      {showFilters && filters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filters.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <div className="text-sm font-semibold">{filter.label}</div>
                <div className="space-y-1.5">
                  {filter.options.map((opt) => {
                    const checked = (activeFilters[filter.key] || []).includes(opt.value)
                    const handleChange = (next: boolean) => {
                      if (!onFilterChange) return
                      const cur = activeFilters[filter.key] || []
                      if (filter.type === 'radio') {
                        onFilterChange(filter.key, next ? [opt.value] : [])
                      } else {
                        onFilterChange(
                          filter.key,
                          next ? [...cur, opt.value] : cur.filter((v) => v !== opt.value),
                        )
                      }
                    }
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={handleChange}
                          aria-label={opt.label}
                        />
                        <span>{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===== Bulk Action Bar ===== */}
      {selectable && selectedIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
          role="region"
          aria-label="إجراءات جماعية"
        >
          <span className="text-sm font-medium text-primary">{selectedIds.length} عنصر محدد</span>
          <div className="mr-auto flex flex-wrap gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                className="min-h-[44px]"
                disabled={!!bulkLoading}
                onClick={() => handleBulkAction(action)}
                aria-label={action.label}
              >
                {bulkLoading === action.label ? 'جاري...' : action.label}
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => onSelectionChange?.([])}
            aria-label="إلغاء التحديد"
          >
            إلغاء التحديد
          </Button>
        </div>
      )}

      {/* ===== Results count ===== */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          إجمالي {totalCount} عنصر · الصفحة {page} من {totalPages}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="عدد العناصر في الصفحة"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / صفحة
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ===== Table (desktop) ===== */}
      {data.length === 0 ? (
        emptyState ? (
          <EmptyState
            icon={emptyState.icon as never}
            title={emptyState.title}
            description={emptyState.description}
            action={emptyState.action}
          />
        ) : (
          <div className="grid place-items-center py-20 text-center">
            <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
          </div>
        )
      ) : (
        <>
          <div className="hidden md:block overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right" dir="rtl">
                <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    {selectable && (
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="تحديد الكل"
                        />
                      </th>
                    )}
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-4 py-3 font-semibold whitespace-nowrap',
                          col.sortable && 'cursor-pointer select-none hover:text-foreground',
                        )}
                        style={{ width: col.width }}
                        onClick={() => col.sortable && handleSort(col.key)}
                        aria-sort={
                          sortField === col.key
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {col.sortable && sortField === col.key && (
                            <span className="text-primary">
                              {sortDirection === 'asc' ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                    {actions && actions.length > 0 && (
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">إجراءات</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => {
                    const isSelected = selectedIds.includes(item.id)
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          'text-sm transition-colors hover:bg-accent/30',
                          isSelected && 'bg-primary/5',
                        )}
                      >
                        {selectable && (
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(c) => handleSelectOne(item.id, Boolean(c))}
                              aria-label={`تحديد ${item.id}`}
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td key={col.key} className="px-4 py-3">
                            {col.render(item)}
                          </td>
                        ))}
                        {actions && actions.length > 0 && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {actions.map((action) => {
                                const disabled = action.disabled?.(item) || false
                                return (
                                  <Button
                                    key={action.label}
                                    size="sm"
                                    variant={
                                      action.variant === 'destructive'
                                        ? 'destructive'
                                        : action.variant === 'outline'
                                          ? 'outline'
                                          : 'default'
                                    }
                                    className="min-h-[36px] text-xs"
                                    disabled={disabled}
                                    title={disabled ? action.disabledReason : action.label}
                                    onClick={() => action.onAction(item)}
                                    aria-label={action.label}
                                  >
                                    {action.label}
                                  </Button>
                                )
                              })}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== Mobile Card View ===== */}
          <div className="md:hidden space-y-3">
            {data.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              if (mobileCardView) {
                return (
                  <div
                    key={item.id}
                    className={cn(isSelected && 'ring-1 ring-primary/30 rounded-xl')}
                  >
                    {mobileCardView(item, isSelected, () => handleSelectOne(item.id, !isSelected))}
                  </div>
                )
              }
              return (
                <Card
                  key={item.id}
                  className={cn('p-4', isSelected && 'ring-1 ring-primary/30 bg-primary/5')}
                >
                  <div className="flex items-start gap-3">
                    {selectable && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => handleSelectOne(item.id, Boolean(c))}
                      />
                    )}
                    <div className="flex-1 space-y-2">
                      {columns.slice(0, 3).map((col) => (
                        <div key={col.key} className="text-sm">
                          <span className="text-xs text-muted-foreground">{col.label}: </span>
                          {col.render(item)}
                        </div>
                      ))}
                      {actions && actions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {actions.map((action) => {
                            const disabled = action.disabled?.(item) || false
                            return (
                              <Button
                                key={action.label}
                                size="sm"
                                variant={
                                  action.variant === 'destructive' ? 'destructive' : 'outline'
                                }
                                className="min-h-[44px] text-xs flex-1"
                                disabled={disabled}
                                title={disabled ? action.disabledReason : action.label}
                                onClick={() => action.onAction(item)}
                              >
                                {action.label}
                              </Button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* ===== Pagination ===== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] gap-2"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                aria-label="السابق"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                الصفحة {page} من {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] gap-2"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="التالي"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
