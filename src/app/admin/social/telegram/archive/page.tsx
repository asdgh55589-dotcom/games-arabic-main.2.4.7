// DEPRECATED: consolidated into /admin/media
'use client'

/**
 * أرشيف المنشورات (Phase 5 — الفئة 4 خطوات 5/6):
 * يعرض المؤرشف فقط (status محفوظ — الاستعادة تعيد لآخر حالة قبل الأرشفة)،
 * مع استعادة مفردة/دفعة + تصدير JSON. الاستيراد يعيد الـ ids المصدرين.
 */
import { Archive, Download, Loader2, RotateCcw, Upload } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface ArchivedPost {
  id: string
  title: string | null
  body: string
  status: string
  siteMode: string | null
  archivedAt: string | null
  scheduledFor: string | null
  publishedAt: string | null
  destination?: { id: string; title: string | null } | null
  template?: { id: string; name: string } | null
}

const STATUS_AR: Record<string, string> = {
  draft: 'مسودة',
  scheduled: 'مجدول',
  publishing: 'جارٍ النشر',
  published: 'منشور',
  failed: 'فشل',
  canceled: 'ملغى',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/15 text-blue-600',
  published: 'bg-green-500/15 text-green-600',
  failed: 'bg-red-500/15 text-red-600',
  canceled: 'bg-yellow-500/15 text-yellow-600',
  publishing: 'bg-purple-500/15 text-purple-600',
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-SA')
}

function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: { message?: string }; message?: string }).error
    if (typeof err?.message === 'string' && err.message) return err.message
    const msg = (body as { message?: string }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

export default function PostsArchivePage() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<ArchivedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/social/telegram/posts/archived?page=1&limit=100')
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر تحميل الأرشيف'))
      setPosts(body.data ?? [])
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر التحميل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const restoreOne = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const res = await fetch(
        `/api/admin/social/telegram/posts/${encodeURIComponent(id)}/archive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّرت الاستعادة'))
      toast({ title: 'تمت الاستعادة', description: 'عاد المنشور لحالته قبل الأرشفة' })
      await load()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّرت الاستعادة',
        variant: 'destructive',
      })
    } finally {
      setBusy((b) => ({ ...b, [id]: false }))
    }
  }

  // تصدير JSON محلي الخادم — لا توكنات هنا (المنشور بلا أسرار).
  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      kind: 'social-posts-archive',
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        status: p.status,
        siteMode: p.siteMode,
        archivedAt: p.archivedAt,
        destinationTitle: p.destination?.title ?? null,
        templateName: p.template?.name ?? null,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `posts-archive-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // استيراد JSON مصدَّر سابقاً — يعيد الـ ids المؤرشفة دفعة واحدة.
  const importJson = async (file: File) => {
    setImporting(true)
    try {
      const parsed = JSON.parse(await file.text())
      const ids: string[] = Array.isArray(parsed?.posts)
        ? parsed.posts
            .map((p: { id?: string }) => p?.id)
            .filter((x: unknown): x is string => typeof x === 'string')
        : Array.isArray(parsed?.ids)
          ? parsed.ids.filter((x: unknown): x is string => typeof x === 'string')
          : []
      if (ids.length === 0) throw new Error('الملف لا يحتوي معرفات منشورات')
      const res = await fetch('/api/admin/social/telegram/posts/archived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر الاستيراد'))
      const restored = Number(body?.data?.restored ?? 0)
      toast({ title: 'انتهى الاستيراد', description: `تمت استعادة ${restored} من ${ids.length}` })
      await load()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر الاستيراد',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6" dir="rtl">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Archive className="h-5 w-5" /> أرشيف المنشورات
            </CardTitle>
            <CardDescription>
              المؤرشف مخفي عن كل القوائم — الاستعادة تعيد لآخر حالة قبل الأرشفة
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportJson}
              disabled={loading || posts.length === 0}
            >
              <Download className="h-4 w-4" /> تصدير JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}{' '}
              استيراد JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">الأرشيف فارغ</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنشور</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الوجهة</TableHead>
                    <TableHead>أُرشف عند</TableHead>
                    <TableHead className="text-left">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate font-medium">{p.title || '(بلا عنوان)'}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.body}</p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[p.status] ?? 'bg-muted text-muted-foreground'}`}
                        >
                          {STATUS_AR[p.status] ?? p.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.destination?.title ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(p.archivedAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy[p.id]}
                            onClick={() => void restoreOne(p.id)}
                          >
                            {busy[p.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            استعادة
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
