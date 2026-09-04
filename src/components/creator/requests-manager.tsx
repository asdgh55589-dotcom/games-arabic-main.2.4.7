'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Check, Link2, Loader2, Inbox, Clock, CheckCircle, XCircle, Heart } from 'lucide-react'
import { timeAgo } from '@/lib/format'

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
  const [filter, setFilter] = useState<'all' | 'open' | 'mine' | 'completed'>('open')
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [completeModId, setCompleteModId] = useState<Record<string, string>>({})

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      // For mine filter, API expects status=mine
      const res = await fetch(`/api/creator/requests?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setRequests(json.data?.requests || [])
    } catch {}
    setLoading(false)
  }, [filter])

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
        toast({ title: 'تم قبول الطلب' })
        fetchRequests()
      } else {
        toast({ title: json.error?.message || 'فشل', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleComplete = async (id: string) => {
    const modId = completeModId[id]?.trim()
    if (!modId) {
      toast({ title: 'يرجى إدخال معرف التعريب', variant: 'destructive' })
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
        toast({ title: 'تم إكمال الطلب' })
        fetchRequests()
      } else {
        toast({ title: json.error?.message || 'فشل', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'open', label: 'متاح' },
          { value: 'mine', label: 'قبلته أنا' },
          { value: 'completed', label: 'مكتمل' },
          { value: 'all', label: 'الكل' },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.value as never)}
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
            <h3 className="font-medium">لا توجد طلبات</h3>
            <p className="text-sm text-muted-foreground mt-1">عندما يطلب أحد تعريباً، ستظهر هنا</p>
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
                          ? 'مفتوح'
                          : r.status === 'accepted'
                            ? 'مقبول'
                            : r.status === 'completed'
                              ? 'مكتمل'
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
                      <span>{timeAgo(r.createdAt)}</span>
                    </div>
                    {r.notes && (
                      <p className="text-sm mt-2 whitespace-pre-wrap bg-muted/50 rounded p-2">
                        {r.notes}
                      </p>
                    )}
                    {r.mod && (
                      <div className="text-xs mt-2">
                        مرتبط بـ:{' '}
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
                          <Loader2 className="h-4 w-4 animate-spin ml-1" />
                        ) : (
                          <Check className="h-4 w-4 ml-1" />
                        )}
                        قبول
                      </Button>
                    )}
                    {r.status === 'accepted' && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-1">
                          <Input
                            placeholder="معرّف التعريب"
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
                        <span className="text-[10px] text-muted-foreground">أدخل modId للربط</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
