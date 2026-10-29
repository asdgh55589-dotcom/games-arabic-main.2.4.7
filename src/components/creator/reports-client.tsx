'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBanner } from '@/components/ui/error-banner'
import { timeAgo } from '@/lib/format'
import { AppealDialog } from '@/components/creator/appeal-dialog'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { useAuth } from '@/contexts/auth-context'
import { useRealtimeSync } from '@/hooks/use-realtime-sync'
import type { StudioDict } from '@/lib/studio-i18n/types'

interface ReportItem {
  id: string
  createdAt: string
  targetType: string
  reason: string
  status: string
  actionTaken: string | null
  actionAt: string | null
  resolution: string | null
  resolvedAt: string | null
  mod: { id: string; name: string; slug: string } | null
  commentExcerpt: string | null
  latest: { toStatus: string; action: string | null; resolution: string | null; createdAt: string } | null
}

const STATUSES = ['all', 'new', 'under_review', 'confirmed', 'rejected', 'pending', 'resolved', 'reopened'] as const

function statusLabel(status: string, t: StudioDict['reports']): string {
  const key = `status_${status}` as keyof StudioDict['reports']
  return typeof t[key] === 'string' ? (t[key] as string) : status
}

function reasonLabel(reason: string, t: StudioDict['reports']): string {
  const key = `reason_${reason}` as keyof StudioDict['reports']
  return typeof t[key] === 'string' ? (t[key] as string) : reason
}

function actionLabel(action: string | null, t: StudioDict['reports']): string {
  if (!action) return t.action_unset
  const key = `action_${action}` as keyof StudioDict['reports']
  return typeof t[key] === 'string' ? (t[key] as string) : action
}

function appealStatusLabel(status: string): string {
  if (status === 'reopened') return 'appealed'
  if (status === 'resolved') return 'upheld'
  return 'pending'
}

  const { user } = useAuth()
  useRealtimeSync({ userId: user?.id ?? null })
export function ReportsClient() {
  const { dict, locale } = useStudioLanguage()
  const t = dict.reports
  const [status, setStatus] = useState<string>('all')
  const [rows, setRows] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [appealMessage, setAppealMessage] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/creator/reports?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setRows(json?.data?.reports || [])
        setTotalPages(json?.data?.pagination?.totalPages || 1)
      } else {
        setError(json?.error?.message || 'فشل تحميل البلاغات')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setLoading(false)
  }, [status, page])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={status === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
          >
            {s === 'all' ? t.all : statusLabel(s, t)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">…</div>
      ) : error ? (
        <ErrorBanner message={error} onRetry={fetchReports} retryLabel="إعادة المحاولة" />
      ) : rows.length === 0 ? (
        <EmptyState icon="file" title={t.empty} description={t.emptyDesc} />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const outcome = r.latest?.resolution || r.resolution
            const isRejected = r.status === 'rejected'
            const appealStatus = appealStatusLabel(r.status)
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {r.targetType === 'comment' ? t.targetComment : t.targetMod}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {reasonLabel(r.reason, t)}
                    </Badge>
                    <Badge variant={r.status === 'resolved' ? 'default' : 'outline'} className="text-xs">
                      {statusLabel(r.status, t)}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {appealStatus === 'pending' ? 'pending' : appealStatus === 'appealed' ? 'appealed' : 'upheld'}
                    </Badge>
                    <span className="text-xs text-muted-foreground ms-auto">
                      {timeAgo(r.createdAt, locale)}
                    </span>
                  </div>

                  <div className="mt-2 text-sm">
                    {r.mod && (
                      <Link href={`/mod/${r.mod.slug}`} target="_blank" className="font-medium text-primary hover:underline">
                        {r.mod.name}
                      </Link>
                    )}
                    {r.commentExcerpt && (
                      <p className="mt-1 text-muted-foreground">
                        <bdi>“{r.commentExcerpt}{r.commentExcerpt.length >= 50 ? '…' : ''}”</bdi>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <div className="font-medium text-xs text-muted-foreground mb-1">{t.outcome}</div>
                    {outcome ? (
                      <p className="whitespace-pre-wrap">{outcome}</p>
                    ) : (
                      <p className="text-muted-foreground">{t.noOutcomeYet}</p>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {actionLabel(r.latest?.action ?? r.actionTaken, t)}
                    </div>
                  </div>

                  {r.latest && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span>appeal history: {r.latest.toStatus} — {r.latest.resolution}</span>
                    </div>
                  )}

                  {isRejected && (
                    <div className="mt-3">
                      <AppealDialog
                        reportId={r.id}
                        onSuccess={() => {
                          setAppealMessage('تم إرسال الطعن — أُعيد فتح البلاغ للمراجعة')
                          fetchReports()
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {appealMessage && (
        <div className="text-sm text-muted-foreground">{appealMessage}</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {dict.commentsMgr.prev}
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {dict.commentsMgr.page} {page} {dict.commentsMgr.pageOf} {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {dict.commentsMgr.next}
          </Button>
        </div>
      )}
    </div>
  )
}
