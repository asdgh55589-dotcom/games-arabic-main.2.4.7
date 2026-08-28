import { Clock, FileArchive, User } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

interface VersionEntry {
  id: string
  version: string
  changelog: string
  createdAt: string
  createdByUser: { id: string; username: string }
  _count: { files: number }
}

interface VersionHistoryProps {
  versions: VersionEntry[]
}

export function VersionHistory({ versions }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        لا يوجد إصدارات بعد
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {versions.map((v, i) => (
        <div key={v.id} className="relative flex gap-4 pb-6">
          {/* Timeline line */}
          {i < versions.length - 1 && (
            <div className="absolute right-[15px] top-8 h-full w-px bg-border" />
          )}

          {/* Version badge */}
          <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-background">
            v
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                الإصدار {v.version}
              </span>
              {i === 0 && (
                <Badge variant="outline" className="text-[10px] bg-green-lt text-green">
                  الأحدث
                </Badge>
              )}
            </div>

            {v.changelog && (
              <p className="mt-1.5 text-sm text-muted-foreground whitespace-pre-wrap">
                {v.changelog}
              </p>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {v.createdByUser.username}
              </span>
              <span className="flex items-center gap-1">
                <FileArchive className="h-3 w-3" />
                {v._count.files} ملف
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(v.createdAt)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
