// DEPRECATED: consolidated into /admin/media
'use client'

/**
 * مركز أخطاء النشر (مرحلة 6، الفئة 7 بند 9):
 * الأحداث غير المحلولة أولًا مع «كيف أصلحه؟» من كتالوج الأخطاء
 * (causeAr/fixAr)، زر «أعد الوجهات الفاشلة» لصفوف نطاق المنشور، وحل
 * يدوي (manager+). الأحدث أولاً + عدّاد مختصر (open/آخر 24 ساعة).
 */
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, RotateCcw, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'

interface ErrorEvent {
  id: string
  code: string
  scope: string
  refId: string | null
  message: string | null
  causeAr: string
  fixAr: string
  retryable: boolean
  attempt: number
  notifiedAt: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
}

const SCOPE_AR: Record<string, string> = {
  post: 'منشور',
  route: 'قاعدة',
  bot: 'بوت',
  destination: 'وجهة',
  schedule: 'جدولة',
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

export default function PublishErrorsPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ErrorEvent[]>([])
  const [counts, setCounts] = useState<{ open: number; last24h: number }>({
    open: 0,
    last24h: 0,
  })
  const [status, setStatus] = useState('open')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/social/publish-errors?status=${status}&limit=100`)
      const body = await res.json()
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّر تحميل الأخطاء'))
      setItems(body.data.items ?? [])
      setCounts(body.data.counts ?? { open: 0, last24h: 0 })
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر التحميل',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [status, toast])

  useEffect(() => {
    void load()
  }, [load])

  const resolveOne = async (id: string) => {
    setBusy((b) => ({ ...b, [`r:${id}`]: true }))
    try {
      const res = await fetch(
        `/api/admin/social/publish-errors/${encodeURIComponent(id)}/resolve`,
        { method: 'POST' },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok && res.status !== 409) throw new Error(apiErrorMessage(body, 'تعذّر الحل'))
      toast({ title: 'تم', description: 'وضعت علامة «محلول» على الحدث' })
      await load()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّر الحل',
        variant: 'destructive',
      })
    } finally {
      setBusy((b) => ({ ...b, [`r:${id}`]: false }))
    }
  }

  const retryPost = async (refId: string) => {
    setBusy((b) => ({ ...b, [`t:${refId}`]: true }))
    try {
      const res = await fetch('/api/admin/social/publish-errors/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: refId }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(apiErrorMessage(body, 'تعذّرت إعادة المحاولة'))
      const d = body.data ?? body
      toast({
        title: 'انتهت المحاولة',
        description: `نجاح: ${d.published ?? 0} — فشل: ${d.failed ?? 0}`,
      })
      await load()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'تعذّرت إعادة المحاولة',
        variant: 'destructive',
      })
    } finally {
      setBusy((b) => ({ ...b, [`t:${refId}`]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مركز أخطاء النشر</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            الأسباب والإصلاحات العربية جاهزة من كتالوج الأخطاء — الحل اليدوي للإدارة، والحل التلقائي
            عند نجاح النشر.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="size-3" /> مفتوح: {counts.open}
          </Badge>
          <Badge variant="outline" className="gap-1">
            آخر 24 ساعة: {counts.last24h}
          </Badge>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">غير المحلول</SelectItem>
              <SelectItem value="resolved">المحلول</SelectItem>
              <SelectItem value="all">الكل</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            تحديث
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="size-4" /> الأحداث ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-muted h-14 animate-pulse rounded" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              لا أحداث — كل شيء أخضر. التقرير الدوري يصل عبر كرون التقرير.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((e) => (
                <div key={e.id} className="bg-card rounded-lg border p-4" dir="rtl">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-red-500/15 text-red-600" variant="outline">
                          <Wrench className="size-3" /> {e.code}
                        </Badge>
                        <Badge variant="outline">{SCOPE_AR[e.scope] ?? e.scope}</Badge>
                        {e.retryable ? (
                          <Badge variant="outline" className="bg-blue-500/15 text-blue-600">
                            قابل للإعادة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            غير قابل للإعادة
                          </Badge>
                        )}
                        {e.attempt > 0 ? (
                          <span className="text-muted-foreground text-xs">
                            المحاولة: {e.attempt}
                          </span>
                        ) : null}
                        {e.notifiedAt ? (
                          <Badge variant="outline" className="bg-purple-500/15 text-purple-600">
                            أُبلغ
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium">{e.causeAr}</p>
                      {e.message ? (
                        <p
                          className="text-muted-foreground mt-1 truncate text-xs"
                          title={e.message}
                        >
                          {e.message}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {SCOPE_AR[e.scope] ?? e.scope} · {e.refId ?? '—'} · {fmtDate(e.createdAt)}
                        {e.scope === 'post' && e.refId ? (
                          <>
                            {' '}
                            · <span className="font-mono">{e.refId}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.scope === 'post' && e.refId && !e.resolvedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy[`t:${e.refId}`]}
                          onClick={() => void retryPost(e.refId as string)}
                        >
                          {busy[`t:${e.refId}`] ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                          أعد الوجهات الفاشلة
                        </Button>
                      ) : null}
                      {!e.resolvedAt ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy[`r:${e.id}`]}
                          onClick={() => void resolveOne(e.id)}
                        >
                          <CheckCircle2 className="size-4" /> حلّ يدوياً
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          محلول {fmtDate(e.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* «كيف أصلحه؟» — من كتالوج الأخطاء */}
                  <details className="group mt-3">
                    <summary className="text-muted-foreground cursor-pointer select-none text-xs font-medium">
                      كيف أصلحه؟
                    </summary>
                    <p className="bg-blue-500/10 text-blue-700 mt-2 rounded p-2 text-sm">
                      {e.fixAr}
                    </p>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
