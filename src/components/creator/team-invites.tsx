'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import { InviteForm } from '@/components/creator/invite-form'

interface InviteRow {
  id: string
  inviteeUsername: string | null
  inviteeEmailMasked: string | null
  role: string
  status: string
  expiresAt: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلقة',
  accepted: 'مقبولة',
  declined: 'مرفوضة',
  revoked: 'ملغاة',
  expired: 'منتهية',
}

export function TeamInvites() {
  const { toast } = useToast()
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/creator/team/invites?status=${filter}&limit=50`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setInvites(json.data ?? [])
    } catch {
      // list is advisory — form stays usable
    }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  const revoke = async (id: string) => {
    setRevoking(id)
    try {
      const res = await fetch(`/api/creator/team/invites/${encodeURIComponent(id)}/revoke`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم إلغاء الدعوة' })
        fetchInvites()
      } else {
        toast({ title: json?.error?.message || 'فشل إلغاء الدعوة', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setRevoking(null)
  }

  return (
    <div className="space-y-4">
      <InviteForm onCreated={fetchInvites} />

      <div className="flex gap-2">
        {['pending', 'accepted', 'declined', 'revoked', 'expired', 'all'].map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {STATUS_LABELS[s] ?? 'الكل'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="جارٍ التحميل">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <EmptyState icon="inbox" title="لا توجد دعوات" description="أنشئ دعوة من النموذج أعلاه" />
      ) : (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="divide-y p-0">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium" dir="ltr">
                    {inv.inviteeUsername ? `@${inv.inviteeUsername}` : inv.inviteeEmailMasked}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    الدور: {inv.role} · تنتهي {new Date(inv.expiresAt).toLocaleDateString('ar')}
                  </p>
                </div>
                <Badge variant={inv.status === 'pending' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </Badge>
                {inv.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revoking === inv.id}
                    onClick={() => revoke(inv.id)}
                  >
                    {revoking === inv.id ? '...' : 'إلغاء'}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
