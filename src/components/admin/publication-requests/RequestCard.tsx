'use client'

import { Package, AlertTriangle } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModWorkflowActions } from '@/components/admin/shared/ModWorkflowActions'

interface RequestCardProps {
  mod: {
    id: string
    slug: string
    name: string
    thumbnailUrl: string
    version: string
    workflowStatus: string
    updatedAt: string
    qualityScore: number | null
    author: {
      id: string
      username: string
      avatarUrl: string | null
      role: string
      tier: number
      specialRoles: string | null
    }
    teamRelation: { id: string; name: string; logoUrl: string | null } | null
    game: { id: string; name: string } | null
    source: { label: string; color: string }
    waitingDays: number
    isOverdue: boolean
    reviewer?: { id: string; username: string; avatarUrl: string | null } | null
  }
  isSelected: boolean
  onToggle: () => void
  currentUser: { id: string; role: string }
  onRefresh: () => void
}

export function RequestCard({
  mod,
  isSelected,
  onToggle,
  currentUser,
  onRefresh,
}: RequestCardProps) {
  return (
    <Card
      className={
        mod.isOverdue
          ? 'border-red-500/50 bg-red-500/5'
          : isSelected
            ? 'ring-1 ring-primary/30 bg-primary/5'
            : ''
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-10 w-10 rounded-md">
            <AvatarImage src={mod.thumbnailUrl || undefined} />
            <AvatarFallback>
              <Package className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-2 truncate">
              <span className="truncate">{mod.name}</span>
              {mod.isOverdue && (
                <Badge variant="destructive" className="text-[11px] shrink-0 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  متأخر
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {mod.game?.name || 'بدون لعبة'} · {mod.author.username} ·{' '}
              <span className={`${mod.source.color} rounded px-1.5 py-0.5 text-[11px]`}>
                {mod.source.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>
            منذ {mod.waitingDays} يوم · جودة {mod.qualityScore ?? '—'}%
          </span>
          <span>
            {(mod as unknown as { reviewer?: { username: string } }).reviewer
              ? `مُسند: ${(mod as unknown as { reviewer: { username: string } }).reviewer.username}`
              : 'غير مُسند'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 min-h-[44px] text-xs"
            onClick={onToggle}
          >
            {isSelected ? 'إلغاء' : 'تحديد'}
          </Button>
          <div className="flex-1">
            <ModWorkflowActions
              mod={
                {
                  id: mod.id,
                  slug: mod.slug,
                  name: mod.name,
                  workflowStatus: mod.workflowStatus,
                  authorId: mod.author.id,
                  version: mod.version,
                  qualityScore: mod.qualityScore || undefined,
                } as never
              }
              currentUser={currentUser as never}
              onActionComplete={onRefresh}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
