'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/official-ui/card'
import { useToast } from '@/hooks/use-toast'

interface InviteMeta {
  teamName: string
  teamSlug: string
  role: string
  expiresAt: string
  status: string
  eligible: boolean
  reason?: string
}

export function InviteAcceptClient({ token }: { token: string }) {
  const { toast } = useToast()
  const [meta, setMeta] = useState<InviteMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [done, setDone] = useState<{ teamSlug: string; teamName: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/creator/team/invites/${encodeURIComponent(token)}`, {
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setMeta(json.data)
      } else {
        setError(json?.error?.message || 'الدعوة غير صالحة أو منتهية')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
    }
    setLoading(false)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const act = async (action: 'accept' | 'decline') => {
    setActing(true)
    try {
      const res = await fetch(`/api/creator/team/invites/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        if (action === 'accept') {
          setDone({ teamSlug: json.data?.teamSlug, teamName: json.data?.teamName })
          toast({ title: 'تم الانضمام إلى الفريق بنجاح' })
        } else {
          toast({ title: 'تم رفض الدعوة' })
          load()
        }
      } else {
        toast({ title: json?.error?.message || 'فشل تنفيذ الإجراء', variant: 'destructive' })
        load()
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActing(false)
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="جارٍ التحميل" />
  }

  if (error || !meta) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-destructive">{error ?? 'الدعوة غير صالحة'}</p>
          <Button variant="outline" onClick={load}>
            إعادة المحاولة
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="max-w-xl">
        <CardContent className="space-y-3 p-6 text-center">
          <p className="font-semibold">أهلاً بك في فريق {done.teamName}</p>
          <Link href={`/teams/${done.teamSlug}`} className="text-primary hover:underline">
            عرض صفحة الفريق
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>دعوة للانضمام إلى {meta.teamName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          الدور المقترح: {meta.role} · تنتهي {new Date(meta.expiresAt).toLocaleDateString('ar')}
        </p>
        {!meta.eligible && <p className="text-sm text-destructive">{meta.reason}</p>}
        <div className="flex gap-2">
          <Button disabled={!meta.eligible || acting} onClick={() => act('accept')}>
            {acting ? '...' : 'قبول الدعوة'}
          </Button>
          <Button variant="outline" disabled={!meta.eligible || acting} onClick={() => act('decline')}>
            رفض
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
