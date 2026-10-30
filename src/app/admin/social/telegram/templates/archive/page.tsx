// DEPRECATED: consolidated into /admin/media
'use client'

/**
 * أرشيف قوالب المنشورات (Phase 5 — الفئة 5):
 * الخلود: لا حذف فيزيائي أبداً — الأرشفة ناعمة والاستعادة تعيد القالب
 * للمنتقيات فوراً. الإصدارات لقطات غير قابلة للتعديل، والتراجع يُنشئ
 * نسخة جديدة (لا يمحو التاريخ). التصدير/الاستيراد JSON بلا توكنات.
 */
import { Archive, ChevronDown, Download, History, Loader2, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
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

interface ArchivedTemplate {
  id: string
  name: string
  body: string
  isDefault: boolean
  isArchived: boolean
  archivedAt: string | null
  updatedAt: string
}

interface TemplateVersion {
  id: string
  version: number
  name: string
  body: string
  changedBy: string | null
  changeNote: string | null
  createdAt: string
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

export default function TemplatesArchivePage() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<ArchivedTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const [versionsFor, setVersionsFor] = useState<string | null>(null)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // المؤرشف فقط مباشرة من الخادم (فلتر archivedOnly — Phase 5).
      const res = await fetch('/api/admin/social/telegram/templates?archivedOnly=true&limit=100')
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر تحميل الأرشيف'))
      setTemplates(body.data ?? [])
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
        `/api/admin/social/telegram/templates/${encodeURIComponent(id)}/archive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'restore' }),
        },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّرت الاستعادة'))
      toast({ title: 'تمت الاستعادة', description: 'عاد القالب للمنتقيات فوراً' })
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

  const toggleVersions = async (id: string) => {
    if (versionsFor === id) {
      setVersionsFor(null)
      return
    }
    setVersionsFor(id)
    setVersionsLoading(true)
    try {
      const res = await fetch(
        `/api/admin/social/telegram/templates/${encodeURIComponent(id)}/versions`,
      )
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر تحميل الإصدارات'))
      setVersions(body.data?.versions ?? [])
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر تحميل الإصدارات',
        variant: 'destructive',
      })
      setVersionsFor(null)
    } finally {
      setVersionsLoading(false)
    }
  }

  const rollback = async (id: string, versionId: string) => {
    setBusy((b) => ({ ...b, [`rb-${versionId}`]: true }))
    try {
      const res = await fetch(
        `/api/admin/social/telegram/templates/${encodeURIComponent(id)}/versions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionId }),
        },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر التراجع'))
      toast({ title: 'تم التراجع', description: 'أُنشئت نسخة جديدة — التاريخ محفوظ' })
      await toggleVersions(id)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر التراجع',
        variant: 'destructive',
      })
    } finally {
      setBusy((b) => ({ ...b, [`rb-${versionId}`]: false }))
    }
  }

  // تصدير JSON بلا توكنات بكل الأحوال — القوالب لا تحمل أسراراً، والحقول
  // تُلقط محددة يدوياً (لا created_by ولا حقول داخلية).
  const exportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      kind: 'social-post-templates-archive',
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        body: t.body,
        isDefault: t.isDefault,
        archivedAt: t.archivedAt,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `templates-archive-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // استيراد JSON مصدَّر: إن كان الـ id موجوداً → تحديث محتوى + نسخة جديدة،
  // وإلا إنشاء قالب جديد (isArchived=false يظهر فوراً في المنتقيات).
  const importJson = async (file: File) => {
    setImporting(true)
    try {
      const parsed = JSON.parse(await file.text())
      const templatesIn: unknown[] = Array.isArray(parsed?.templates)
        ? parsed.templates
        : Array.isArray(parsed?.posts)
          ? parsed.posts
          : Array.isArray(parsed)
            ? parsed
            : []
      if (templatesIn.length === 0) throw new Error('الملف لا يحتوي قوالب')
      const res = await fetch('/api/admin/social/telegram/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: templatesIn }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر الاستيراد'))
      const created = Number(body?.data?.created ?? 0)
      const updated = Number(body?.data?.updated ?? 0)
      toast({ title: 'انتهى الاستيراد', description: `${created} أُنشئ، ${updated} حُدّث` })
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
        <CardHeader className="flex-col space-y-4">
          <div className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Archive className="h-5 w-5" /> أرشيف قوالب المنشورات
              </CardTitle>
              <CardDescription>
                «القالب محفوظ للأبد» — لا حذف فيزيائي؛ الاستعادة تُعيد للمنتقيات فوراً
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportJson}
                disabled={loading || templates.length === 0}
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">الأرشيف فارغ</p>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>القالب</TableHead>
                      <TableHead>أُرشف عند</TableHead>
                      <TableHead>الإصدارات</TableHead>
                      <TableHead className="text-left">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-[280px]">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{t.name}</p>
                            {t.isDefault ? <Badge variant="secondary">افتراضي</Badge> : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{t.body}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(t.archivedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void toggleVersions(t.id)}
                          >
                            <History className="h-4 w-4" /> الإصدارات
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${versionsFor === t.id ? 'rotate-180' : ''}`}
                            />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy[t.id]}
                              onClick={() => void restoreOne(t.id)}
                            >
                              {busy[t.id] ? (
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

              {versionsFor && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <History className="h-4 w-4" /> إصدارات القالب (لقطات — التراجع يُنشئ نسخة جديدة)
                  </p>
                  {versionsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">لا إصدارات</p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium">
                              v{v.version} — {v.changeNote}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {fmtDate(v.createdAt)}
                              {v.changedBy ? ` · ${v.changedBy}` : ''}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy[`rb-${v.id}`]}
                            onClick={() => void rollback(versionsFor, v.id)}
                          >
                            {busy[`rb-${v.id}`] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            تراجع
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
