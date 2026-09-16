'use client'

import { useState } from 'react'
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

export function TeamMembersTable({ members, loading, onChanged }: TeamMembersTableProps) {
  const { toast } = useToast()
  const [actionId, setActionId] = useState<string | null>(null)
  const [pendingRemove, setPendingRemove] = useState<TeamMemberRow | null>(null)

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
              </div>
            )
          })}
        </CardContent>
      </Card>

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
