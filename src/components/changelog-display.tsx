'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Clock, Tag, ArrowUpCircle, Wrench } from 'lucide-react'

interface ChangelogEntry {
  id: string
  type: string
  title: string
  description: string
  changedById: string
  changedByRole: string
  createdAt: string
  changedBy: {
    id: string
    username: string
    avatarUrl: string | null
    role: string
  }
}

interface ChangelogDisplayProps {
  changelogs: ChangelogEntry[]
}

const TYPE_CONFIG = {
  release: {
    label: 'إصدار جديد',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: ArrowUpCircle,
  },
  update: {
    label: 'تحديث',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Tag,
  },
  edit: {
    label: 'تعديل',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Wrench,
  },
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير',
  manager: 'مدير',
  owner: 'مالك',
  moderator: 'مشرف',
  publisher: 'ناشر',
  translator: 'معرب',
  member: 'عضو',
}

export function ChangelogDisplay({ changelogs }: ChangelogDisplayProps) {
  if (changelogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>لا توجد سجلات تغييرات بعد</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="rtl">
      {changelogs.map((entry) => {
        const config = TYPE_CONFIG[entry.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.edit
        const Icon = config.icon

        return (
          <div
            key={entry.id}
            className="rounded-lg border border-border bg-card/50 p-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.color}>
                  <Icon className="h-3 w-3 me-1" />
                  {config.label}
                </Badge>
                <h4 className="text-sm font-bold text-foreground">{entry.title}</h4>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleDateString('ar-SA', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {/* Description */}
            {entry.description && (
              <p className="text-sm text-muted-foreground mb-3 mr-5">
                {entry.description}
              </p>
            )}

            {/* Author */}
            <div className="flex items-center gap-2 mr-5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={entry.changedBy.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">
                  {entry.changedBy.username.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {entry.changedBy.username}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {ROLE_LABELS[entry.changedByRole] || entry.changedByRole}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}
