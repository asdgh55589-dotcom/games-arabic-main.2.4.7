'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/official-ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/official-ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/hooks/use-toast'

export interface TeamMemberRow {
  id: string
  userId: string | null
  name: string
  username: string | null
  avatarUrl: string | null
  role: string
  isLinked: boolean
  joinedAt: string
}

interface TeamMembersTableProps {
  members: TeamMemberRow[]
  loading: boolean
  onChanged: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'المالك',
  leader: 'القائد',
  admin: 'إداري',
  moderator: 'مشرف الفريق',
  translator: 'مترجم',
  member: 'عضو',
  tester: 'مختبر',
  guest: 'ضيف',
  reviewer: 'مراجع',
  editor: 'محرر',
}

const ASSIGNABLE_ROLES = ['admin', 'moderator', 'translator', 'member', 'tester'] as const

interface PendingTransfer {
  id: string
  inviteeUsername: string | null
  expiresAt: string
}

export function TeamMembersTable({ members, loading, onChanged }: TeamMembersTableProps) {
  const { toast } = useToast()
  const [actionId, setActionId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TeamMemberRow | null>(null)
  const [pendingNominate, setPendingNominate] = useState<TeamMemberRow | null>(null)
  const [transfer, setTransfer] = useState<PendingTransfer | null>(null)
  const [transferLink, setTransferLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchTransfer = useCallback(async () => {
    try {
      const res = await fetch('/api/creator/team/transfer', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok) setTransfer(json.data?.pending ?? null)
    } catch {
      // transfer banner is advisory
    }
  }, [])

  useEffect(() => {
    fetchTransfer()
  }, [fetchTransfer, members.length])

  const nominate = async () => {
    if (!pendingNominate) return
    const member = pendingNominate
    setPendingNominate(null)
    setActionId(member.id)
    setTransferLink(null)
    setCopied(false)
    try {
      const res = await fetch('/api/creator/team/transfer/nominate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setTransferLink(json.data?.acceptUrl ?? null)
        toast({ title: 'تم إنشاء الترشيح — انسخ الرابط وأرسله للمرشح' })
        fetchTransfer()
        onChanged()
      } else {
        toast({ title: json?.error?.message || 'فشل إنشاء الترشيح', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const revokeTransfer = async () => {
    setActionId('transfer')
    try {
      const res = await fetch('/api/creator/team/transfer/revoke', { method: 'POST' })
      if (res.ok) {
        toast({ title: 'تم إلغاء الترشيح' })
        setTransfer(null)
        setTransferLink(null)
      } else {
        const json = await res.json().catch(() => null)
        toast({ title: json?.error?.message || 'فشل الإلغاء', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const changeRole = async (member: TeamMemberRow, role: string) => {
    if (role === member.role) return
    setActionId(member.id)
    try {
      const res = await fetch('/api/creator/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, role }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تم تحديث دور العضو' })
        onChanged()
      } else {
        toast({
          title: json?.error?.message || 'فشل تحديث الدور',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  const confirmRemove = async () => {
    if (!pendingRemove) return
    const member = pendingRemove
    setPendingRemove(null)
    setActionId(member.id)
    try {
      const res = await fetch(`/api/creator/team/members?memberId=${encodeURIComponent(member.id)}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        toast({ title: 'تمت إزالة العضو' })
        onChanged()
      } else {
        toast({
          title: json?.error?.message || 'فشل إزالة العضو',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'تعذر الاتصال — حاول مجدداً', variant: 'destructive' })
    }
    setActionId(null)
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="جارٍ التحميل">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return <EmptyState icon="users" title="لا يوجد أعضاء بعد" description="ستظهر هنا قائمة أعضاء فريقك" />
  }

  return (
    <>
      {transfer && (
        <Card className="border-dashed">
          <CardContent className="flex flex-wrap items-center gap-3 p-3">
            <p className="min-w-0 flex-1 text-sm">
              ترشيح معلق لنقل الملكية إلى <span className="font-medium" dir="ltr">@{transfer.inviteeUsername}</span>
              {' '}— ينتهي {new Date(transfer.expiresAt).toLocaleDateString('ar')}
            </p>
            <Button variant="outline" size="sm" disabled={actionId === 'transfer'} onClick={revokeTransfer}>
              إلغاء الترشيح
            </Button>
          </CardContent>
        </Card>
      )}
      {transferLink && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-3">
            <p className="text-sm font-medium">رابط الترشيح (يظهر مرة واحدة فقط):</p>
            <p className="break-all text-xs text-muted-foreground" dir="ltr">
              {transferLink}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(transferLink).then(() => setCopied(true)).catch(() => {
                  toast({ title: 'تعذر النسخ — انسخ الرابط يدوياً', variant: 'destructive' })
                })
              }}
            >
              {copied ? 'تم النسخ' : 'نسخ الرابط'}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="divide-y p-0">
          {members.map((m) => {
            const locked = m.role === 'owner'
            const busy = actionId === m.id
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                  <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {m.username ? `@${m.username}` : 'عضو وهمي'} ·{' '}
                    {new Date(m.joinedAt).toLocaleDateString('ar')}
                  </p>
                </div>
                {locked ? (
                  <Badge variant="default">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                ) : (
                  <Select
                    value={ASSIGNABLE_ROLES.includes(m.role as (typeof ASSIGNABLE_ROLES)[number]) ? m.role : 'member'}
                    onValueChange={(role) => changeRole(m, role)}
                    disabled={busy || !m.isLinked}
                  >
                    <SelectTrigger className="w-32" aria-label={`دور ${m.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={locked || busy}
                  onClick={() => setPendingRemove(m)}
                  aria-label={`إزالة ${m.name}`}
                >
                  {busy ? '...' : 'إزالة'}
                </Button>
                {!locked && m.isLinked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || transfer !== null}
                    onClick={() => setPendingNominate(m)}
                    aria-label={`نقل الملكية إلى ${m.name}`}
                  >
                    نقل الملكية
                  </Button>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <AlertDialog open={pendingNominate !== null} onOpenChange={(open) => !open && setPendingNominate(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>نقل ملكية الفريق؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم ترشيح {pendingNominate?.name} ليصبح مالك الفريق. بعد قبوله ستصبح إدارياً وستفقد صلاحيات المالك.
              الترشيح صالح لمدة 7 أيام ويمكنك إلغاؤه قبل القبول.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={nominate}>تأكيد الترشيح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRemove !== null} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة العضو؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إزالة {pendingRemove?.name} من الفريق. سيبقى اسمه محفوظاً في سجل الفريق كعضو سابق.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>تأكيد الإزالة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
