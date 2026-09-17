'use client'

import { FileDown, Loader2, Search } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FileDetailsDrawer, type ManagedFile } from '@/components/file-details-drawer'

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const PROVIDER_LABELS: Record<string, string> = {
  ia: 'Internet Archive',
  freeimage: 'FreeImage',
  direct: 'رابط مباشر',
  cloudinary: 'Cloudinary',
  supabase: 'Supabase',
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= 1024 ** 3) return `${Number((n / 1024 ** 3).toFixed(1))}GB`
  if (n >= 1024 ** 2) return `${Number((n / 1024 ** 2).toFixed(1))}MB`
  if (n >= 1024) return `${Number((n / 1024).toFixed(1))}KB`
  return `${n}B`
}

function fileNameOf(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] || url)
  } catch {
    return url
  }
}

/**
 * Shared file-management UI (P1). Admin page passes apiBase
 * /api/admin/files (all files + uploader column); creator page passes
 * /api/creator/files (own files only).
 */
export function FilesManager({
  apiBase,
  deleteBase,
  showUploader,
  title,
}: {
  apiBase: string
  deleteBase: string
  showUploader: boolean
  title: string
}) {
  const { toast } = useToast()
  const [files, setFiles] = useState<ManagedFile[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState('all')
  const [selected, setSelected] = useState<ManagedFile | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(
    async (page: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: '50' })
        if (query.trim()) params.set('search', query.trim())
        if (provider !== 'all') params.set('provider', provider)
        const res = await fetch(`${apiBase}?${params.toString()}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error?.message || 'فشل تحميل الملفات')
        setFiles(Array.isArray(data?.data) ? data.data : [])
        if (data?.pagination) setPagination(data.pagination)
      } catch {
        toast({ title: 'فشل تحميل الملفات', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [apiBase, query, provider, toast],
  )

  useEffect(() => {
    load(1).catch(() => {})
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📁 {title}</h1>
        <span className="text-sm text-muted-foreground">{pagination.total} ملف</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>البحث والتصفية</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQuery(search)
              }}
              placeholder="اسم الملف أو الرابط أو اسم الرافع…"
              className="ps-9"
            />
          </div>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="المزوّد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المزوّدين</SelectItem>
              <SelectItem value="ia">Internet Archive</SelectItem>
              <SelectItem value="freeimage">FreeImage</SelectItem>
              <SelectItem value="direct">رابط مباشر</SelectItem>
              <SelectItem value="cloudinary">Cloudinary</SelectItem>
              <SelectItem value="supabase">Supabase</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setQuery(search)}>بحث</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : files.length === 0 ? (
            <div className="grid place-items-center gap-2 py-16 text-muted-foreground">
              <FileDown className="h-10 w-10" />
              <p>لا توجد ملفات مطابقة.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-muted-foreground">
                    <th className="px-4 py-3 text-start font-medium">الملف</th>
                    <th className="px-4 py-3 text-start font-medium">المزوّد</th>
                    <th className="px-4 py-3 text-start font-medium">الحجم</th>
                    {showUploader && <th className="px-4 py-3 text-start font-medium">الرافع</th>}
                    <th className="px-4 py-3 text-start font-medium">التعريب</th>
                    <th className="px-4 py-3 text-start font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      className="cursor-pointer border-b border-border/50 transition-colors hover:bg-secondary/30"
                      onClick={() => {
                        setSelected(f)
                        setDrawerOpen(true)
                      }}
                    >
                      <td className="max-w-64 truncate px-4 py-3 font-mono text-xs" dir="ltr" title={f.originalUrl}>
                        {fileNameOf(f.originalUrl)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={f.provider === 'ia' ? 'default' : 'secondary'}>
                          {PROVIDER_LABELS[f.provider] || f.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono" dir="ltr">{fmtBytes(f.bytes)}</td>
                      {showUploader && <td className="px-4 py-3">{f.user?.username || '—'}</td>}
                      <td className="px-4 py-3">{f.mod?.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(f.createdAt).toLocaleDateString('ar')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            disabled={pagination.page <= 1 || loading}
            onClick={() => load(pagination.page - 1)}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => load(pagination.page + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      <FileDetailsDrawer
        file={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        detailsBase={apiBase}
        deleteBase={deleteBase}
        onDeleted={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
      />
    </div>
  )
}
