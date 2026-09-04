'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type ExportFormat = 'csv' | 'xlsx' | 'pdf'

interface ExportDialogProps {
  title: string
  endpoint: string
  filters?: Record<string, string>
  columns?: { key: string; label: string }[]
  totalRows?: number
}

const FORMAT_OPTIONS = [
  { value: 'csv' as const, label: 'CSV', icon: FileText, ext: '.csv' },
  { value: 'xlsx' as const, label: 'Excel', icon: FileSpreadsheet, ext: '.xlsx' },
  { value: 'pdf' as const, label: 'PDF', icon: FileText, ext: '.pdf' },
]

export function ExportDialog({
  title,
  endpoint,
  filters = {},
  columns = [],
  totalRows = 0,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [loading, setLoading] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<string[]>(columns.map((c) => c.key))

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        format,
        columns: selectedColumns.join(','),
        ...filters,
      })

      const res = await fetch(`${endpoint}?${params}`)
      const blob = await res.blob()

      // Trigger download
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}-${Date.now()}.${format === 'xlsx' ? 'xlsx' : format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setOpen(false)
    } catch (err) {
      alert('فشل التصدير')
    } finally {
      setLoading(false)
    }
  }

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-h-[44px]">
          <Download className="h-4 w-4" />
          تصدير
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl" aria-describedby="export-description">
        <DialogHeader>
          <DialogTitle>تصدير {title}</DialogTitle>
          <DialogDescription id="export-description">
            اختر الصيغة والأعمدة لتصدير البيانات.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format selector */}
          <div>
            <label className="text-sm font-medium">الصيغة</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors ${
                    format === opt.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <opt.icon className="h-5 w-5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column selector */}
          {columns.length > 0 && (
            <div>
              <label className="text-sm font-medium">الأعمدة</label>
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            سيتم تصدير {totalRows} صف بـ {selectedColumns.length} عمود
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleExport} disabled={loading || selectedColumns.length === 0}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Download className="h-4 w-4 ml-2" />
              )}
              تصدير
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
