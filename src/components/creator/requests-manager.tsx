'use client'

import { Check, CheckCircle, Clock, Heart, Inbox, Link2, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

interface RequestItem {
  id: string
  gameName: string
  platform: string
  notes: string | null
  status: string
  interestCount: number
  acceptedBy: string | null
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null }
  mod: { id: string; name: string; slug: string } | null
}

export function RequestsManager() {
  const { toast } = useToast()
  const { dict, locale } = useStudioLanguage()
  const t = dict.requestsMgr
  const [filter, setFilter] = useState<'all' | 'open' | 'mine' | 'completed'>('open')
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [completeModId, setCompleteModId] = useState<Record<string, string>>({})

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      // For mine filter, API expects status=mine
      params.set('page', String(page))
      params.set('limit', '20')
      const res = await fetch(`/api/creator/requests?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        setRequests(json.data?.requests || [])
        setTotalPages(json.data?.pagination?.totalPages || 1)
      }
    } catch {}
    setLoading(false)
  }, [filter, page])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleAccept = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/creator/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: t.acceptedToast })
        fetchRequests()
      } else {
        toast({ title: json.error?.message || (typeof json.error === 'string' ? json.error : null) || t.failedToast, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.unexpectedError, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleComplete = async (id: string) => {
    const modId = completeModId[id]?.trim()
    if (!modId) {
      toast({ title: t.enterModId, variant: 'destructive' })
      return
    }
    setActionLoading(id)
    try {
      const res = await fetch(`/api/creator/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', modId }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: t.completedToast })
        fetchRequests()
      } else {
        toast({ title: json.error?.message || (typeof json.error === 'string' ? json.error : null) || t.failedToast, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.unexpectedError, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'open', label: t.open },
          { value: 'mine', label: t.mine },
          { value: 'completed', label: t.completed },
          { value: 'all', label: t.all },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(f.value as never)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium">{t.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.emptyDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{r.gameName}</h3>
                      <Badge variant="outline">{r.platform}</Badge>
                      <Badge
                        className={
                          r.status === 'open'
                            ? 'bg-green-500 text-white'
                            : r.status === 'accepted'
                              ? 'bg-blue-500 text-white'
                              : r.status === 'completed'
                                ? 'bg-purple-500 text-white'
                                : 'bg-gray-500 text-white'
                        }
                      >
                        {r.status === 'open'
                          ? t.statusOpen
                          : r.status === 'accepted'
                            ? t.statusAccepted
                            : r.status === 'completed'
                              ? t.statusCompleted
                              : r.status}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Heart className="h-3 w-3" /> {r.interestCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={r.user.avatarUrl || undefined} />
                        <AvatarFallback>{r.user.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{r.user.username}</span>
                      <span>•</span>
                      <span>{timeAgo(r.createdAt, locale)}</span>
                    </div>
                    {r.notes && (
                      <p className="text-sm mt-2 whitespace-pre-wrap bg-muted/50 rounded p-2">
                        {r.notes}
                      </p>
                    )}
                    {r.mod && (
                      <div className="text-xs mt-2">
                        {t.linkedTo}{' '}
                        <Link href={`/mod/${r.mod.slug}`} className="text-primary hover:underline">
                          {r.mod.name}
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {r.status === 'open' && (
                      <Button
                        size="sm"
                        onClick={() => handleAccept(r.id)}
                        disabled={actionLoading === r.id}
                      >
                        {actionLoading === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin me-1" />
                        ) : (
                          <Check className="h-4 w-4 me-1" />
                        )}
                        {t.accept}
                      </Button>
                    )}
                    {r.status === 'accepted' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1">
                          <Input
                            placeholder={t.modIdPlaceholder}
                            value={completeModId[r.id] || ''}
                            onChange={(e) =>
                              setCompleteModId((p) => ({ ...p, [r.id]: e.target.value }))
                            }
                            className="h-8 w-28 text-xs"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleComplete(r.id)}
                            disabled={actionLoading === r.id}
                          >
                            {actionLoading === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{t.modIdHint}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t.prev}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t.page} {page} {t.pageOf} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t.next}
          </Button>
        </div>
      )}
    </div>
  )
}
