import { Clock, ArrowRight } from 'lucide-react'
import { WorkflowStatusBadge } from './workflow-status-badge'
import { timeAgo } from '@/lib/format'

interface WorkflowHistoryEntry {
  id: string
  fromStatus: string
  toStatus: string
  reason: string | null
  notes: string | null
  changedAt: string
  changedByUser: {
    id: string
    username: string
    avatarUrl: string | null
    role: string
  }
}

interface WorkflowHistoryProps {
  history: WorkflowHistoryEntry[]
}

export function WorkflowHistory({ history }: WorkflowHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">لا يوجد سجل تغييرات بعد</div>
    )
  }

  return (
    <div className="space-y-0">
      {history.map((entry, i) => (
        <div key={entry.id} className="relative flex gap-4 pb-6">
          {/* Timeline line */}
          {i < history.length - 1 && (
            <div className="absolute right-[15px] top-8 h-full w-px bg-border" />
          )}

          {/* Avatar */}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background-secondary text-xs font-medium text-foreground ring-2 ring-background">
            {entry.changedByUser.username.charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {entry.changedByUser.username}
              </span>
              <span className="text-xs text-muted-foreground">غيرّ الحالة</span>
              <WorkflowStatusBadge
                status={entry.fromStatus}
                showIcon={false}
                className="text-[10px]"
              />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <WorkflowStatusBadge
                status={entry.toStatus}
                showIcon={false}
                className="text-[10px]"
              />
            </div>

            {entry.reason && (
              <p className="mt-1.5 text-sm text-muted-foreground">السبب: {entry.reason}</p>
            )}

            {entry.notes && <p className="mt-1 text-xs text-muted-foreground/80">{entry.notes}</p>}

            <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeAgo(entry.changedAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
