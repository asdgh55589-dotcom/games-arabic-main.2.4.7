'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'
import { InviteForm } from '@/components/creator/invite-form'
import { useTeamPermissions } from '@/hooks/use-team-permissions'

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

interface TeamInvitesProps {
  userRole?: string | null
  teamRole?: string | null
}

export function TeamInvites({ userRole, teamRole }: TeamInvitesProps = {}) {
  const { toast } = useToast()
  const perms = useTeamPermissions(userRole ?? teamRole)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [revoking, setRevoking] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/creator/team/invites?status=${filter}&limit=50`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setInvites(json.data ?? [])
      } else {
        setError(json?.error?.message || 'فشل تحميل الدعوات')
      }
    } catch {
      setError('تعذر الاتصال — حاول مجدداً')
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
      {perms.canInvite && <InviteForm onCreated={fetchInvites} />}

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
      ) : error ? (
        <div role="alert" aria-live="polite" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchInvites}>
            إعادة المحاولة
          </Button>
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
                    disabled={!perms.canInvite || revoking === inv.id}
                    aria-disabled={!perms.canInvite}
                    title={!perms.canInvite ? 'ليس لديك صلاحية' : undefined}
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
