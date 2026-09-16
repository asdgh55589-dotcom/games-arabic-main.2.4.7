'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

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

export function TeamMembersTable({ members, loading }: TeamMembersTableProps) {
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
    <Card>
      <CardContent className="divide-y p-0">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            <Avatar className="h-10 w-10">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
              <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {m.username ? `@${m.username}` : 'عضو وهمي'} ·{' '}
                {new Date(m.joinedAt).toLocaleDateString('ar')}
              </p>
            </div>
            <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>
              {ROLE_LABELS[m.role] ?? m.role}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
