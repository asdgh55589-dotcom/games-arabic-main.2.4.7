"use client"

import * as React from "react"
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArchiveIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  EyeIcon,
  GripVerticalIcon,
  LoaderIcon,
  MoreVerticalIcon,
  PencilIcon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { useStudioLanguage } from "@/lib/studio-i18n/context"
import type { StudioDict } from "@/lib/studio-i18n/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export const schema = z.object({
  id: z.number(),
  modId: z.string(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  slug: z.string(),
})

type TableRow = z.infer<typeof schema>

// Create a separate component for the drag handle
function DragHandle({ id }: { id: number }) {
  const { dict } = useStudioLanguage()
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <GripVerticalIcon className="size-3 text-muted-foreground" />
      <span className="sr-only">{dict.table.dragToReorder}</span>
    </Button>
  )
}

const ORDER_STORAGE_KEY = "studio:top-mods-order"

function readStoredOrder(): string[] | null {
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null
  } catch {
    return null
  }
}

// Translated column labels for the "customize columns" menu (C3: no raw IDs).
function columnLabel(columnId: string, dict: StudioDict): string {
  switch (columnId) {
    case "header":
      return dict.table.name
    case "type":
      return dict.table.sectionType
    case "status":
      return dict.table.status
    case "target":
      return dict.table.target
    case "limit":
      return dict.table.limit
    default:
      return columnId
  }
}
function useColumns(
  dict: StudioDict,
  opts: { onArchive: (modId: string, name: string) => void },
): ColumnDef<TableRow>[] {
  return [
    {
      id: "drag",
      header: () => null,
      cell: ({ row }) => <DragHandle id={row.original.id} />,
    },
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label={dict.table.selectAll}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={dict.table.selectRow}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "header",
      header: dict.table.name,
      cell: ({ row }) => {
        return <TableCellViewer item={row.original} />
      },
      enableHiding: false,
    },
    {
      accessorKey: "type",
      header: dict.table.sectionType,
      cell: ({ row }) => (
        <div className="w-32">
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            {row.original.type}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: dict.table.status,
      cell: ({ row }) => {
        const isPublished = row.original.status === dict.status.publishedKey
        return (
          <Badge
            variant="outline"
            className="flex gap-1 px-1.5 text-muted-foreground [&_svg]:size-3"
          >
            {isPublished ? (
              <CheckCircle2Icon className="text-green-500" />
            ) : (
              <LoaderIcon />
            )}
            {isPublished ? dict.status.published : dict.status.inProgress}
          </Badge>
        )
      },
    },
    {
      accessorKey: "target",
      header: () => <div className="w-full text-end">{dict.table.target}</div>,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.target}</span>
      ),
    },
    {
      accessorKey: "limit",
      header: () => <div className="w-full text-end">{dict.table.limit}</div>,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.limit}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original
        const isPublished = item.status === dict.status.publishedKey
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">{dict.table.openMenu}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {item.slug && (
                <DropdownMenuItem asChild>
                  <Link href={`/mod/${item.slug}`} target="_blank">
                    <EyeIcon className="me-1 size-4" />
                    {dict.mods.view}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/creator/mods/${item.modId}/edit`}>
                  <PencilIcon className="me-1 size-4" />
                  {dict.mods.edit}
                </Link>
              </DropdownMenuItem>
              {isPublished && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => opts.onArchive(item.modId, item.header)}>
                    <ArchiveIcon className="me-1 size-4" />
                    {dict.mods.archive}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}

function DraggableRow({ row }: { row: Row<TableRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

export function DataTable({
  data: initialData,
  onChanged,
}: {
  data: TableRow[]
  onChanged?: () => void
}) {
  const { dict, dir } = useStudioLanguage()
  const [pendingArchive, setPendingArchive] = React.useState<{ modId: string; name: string } | null>(null)

  const doArchive = React.useCallback(
    async (modId: string) => {
      setPendingArchive(null)
      try {
        const res = await fetch(`/api/creator/mods/${modId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive' }),
        })
        const json = await res.json().catch(() => null)
        if (res.ok) {
          toast.success(json?.data?.message || dict.table.saved)
          onChanged?.()
        } else {
          toast.error(json?.error?.message || dict.table.saveError)
        }
      } catch {
        toast.error(dict.table.saveError)
      }
    },
    [dict, onChanged]
  )

  const handleArchive = React.useCallback((modId: string, name: string) => {
    // RTL AlertDialog instead of native window.confirm().
    setPendingArchive({ modId, name })
  }, [])

  const columns = React.useMemo(() => useColumns(dict, { onArchive: handleArchive }), [dict, handleArchive])
  const [data, setData] = React.useState(() => initialData)

  // Refresh rows when the parent reloads (e.g. after archive).
  // C3: re-apply persisted manual order (by modId) on top of fresh data.
  React.useEffect(() => {
    const order = readStoredOrder()
    if (!order || order.length === 0) {
      setData(initialData)
      return
    }
    const rank = new Map(order.map((id, i) => [id, i]))
    setData([...initialData].sort((a, b) => {
      const ra = rank.has(a.modId) ? rank.get(a.modId)! : Number.MAX_SAFE_INTEGER
      const rb = rank.has(b.modId) ? rank.get(b.modId)! : Number.MAX_SAFE_INTEGER
      return ra - rb
    }))
  }, [initialData])
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const doneCount = data.filter((row) => row.status === dict.status.publishedKey).length
  const inProgressCount = data.filter(
    (row) => row.status === dict.status.inProgressKey
  ).length

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        const next = arrayMove(data, oldIndex, newIndex)
        // C3: persist manual order (best-effort, by modId).
        try {
          window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next.map((r) => r.modId)))
        } catch {
          // ignore storage failures
        }
        return next
      })
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="flex w-full flex-col justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <TabsList className="@4xl/main:flex hidden">
          <TabsTrigger value="outline" className="gap-1">
            {dict.table.sections}{" "}
            <Badge
              variant="secondary"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
            >
              {doneCount + inProgressCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">{dict.table.customizeColumns}</span>
                <span className="lg:hidden">{dict.table.columnsShort}</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {columnLabel(column.id, dict)}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      {dict.table.noResults}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} {dict.table.selectedOf}{" "}
            {table.getFilteredRowModel().rows.length} {dict.table.selectedRows}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                {dict.table.rowsPerPage}
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {dict.table.page} {table.getState().pagination.pageIndex + 1} {dict.table.pageOf}{" "}
              {table.getPageCount()}
            </div>
            <div className="ms-auto flex items-center gap-2 lg:ms-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{dict.table.firstPage}</span>
                {dir === "rtl" ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">{dict.table.prevPage}</span>
                {dir === "rtl" ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{dict.table.nextPage}</span>
                {dir === "rtl" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">{dict.table.lastPage}</span>
                {dir === "rtl" ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
      <AlertDialog open={pendingArchive !== null} onOpenChange={(open) => !open && setPendingArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.table.sections}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchive ? `${dict.table.confirmArchive} "${pendingArchive.name}"؟` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.table.done}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingArchive && doArchive(pendingArchive.modId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {dict.table.confirmArchive}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}

function TableCellViewer({ item }: { item: TableRow }) {
  const isMobile = useIsMobile()
  const { dict, dir, formatNumber } = useStudioLanguage()
  const isPublished = item.status === dict.status.publishedKey

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-start text-foreground">
          {item.header}
        </Button>
      </SheetTrigger>
      <SheetContent side={dir === "rtl" ? "right" : "left"} className="flex flex-col">
        <SheetHeader className="gap-1">
          <SheetTitle>{item.header}</SheetTitle>
          <SheetDescription>
            {item.type} • {isPublished ? dict.status.published : dict.status.inProgress}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{dict.table.target}</div>
              <div className="text-xl font-bold tabular-nums">{formatNumber(Number(item.target) || 0)}</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs text-muted-foreground">{dict.table.limit}</div>
              <div className="text-xl font-bold tabular-nums">{formatNumber(Number(item.limit) || 0)}</div>
            </div>
          </div>
          {!isMobile && (
            <p className="text-xs text-muted-foreground">{dict.table.drawerHint}</p>
          )}
          <div className="flex gap-2">
            {item.slug && (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/mod/${item.slug}`} target="_blank">
                  <EyeIcon className="me-1 size-4" />
                  {dict.mods.view}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/creator/mods/${item.modId}/edit`}>
                <PencilIcon className="me-1 size-4" />
                {dict.mods.edit}
              </Link>
            </Button>
          </div>
        </div>
        <SheetFooter className="mt-auto flex gap-2 sm:flex-col">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              {dict.table.done}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
