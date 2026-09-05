'use client'

import { Heart, Pin } from 'lucide-react'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/format'
import type { ModCommentType } from '@/lib/types'

interface CommentHeaderProps {
  comment: ModCommentType
  displayName: string
  isNested: boolean
  modOwnerName?: string
  replyToName?: string
}

/** رأس التعليق: الاسم + الشارات + الوقت + حالة التعديل */
export function CommentHeader({
  comment,
  displayName,
  isNested,
  modOwnerName,
  replyToName,
}: CommentHeaderProps) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <span
        className={`font-bold text-foreground flex flex-wrap items-center gap-1 ${isNested ? 'text-sm' : 'text-sm'}`}
      >
        <bdi>{displayName}</bdi>
        {(comment.user as unknown as { role?: string })?.role && (
          <RoleBadge role={(comment.user as unknown as { role: string }).role} size="sm" />
        )}
        {(comment.user as unknown as { tier?: number; role?: string })?.tier !== undefined && (
          <TierBadge
            tier={(comment.user as unknown as { tier: number }).tier}
            role={(comment.user as unknown as { role?: string })?.role}
            size="sm"
          />
        )}
        {(comment.user as unknown as { role?: string; specialRoles?: string })?.role && (
          <CreatorBadge
            role={(comment.user as unknown as { role: string }).role}
            specialRoles={(comment.user as unknown as { specialRoles?: string }).specialRoles}
            size={14}
          />
        )}
      </span>
      {replyToName && (
        <span className="text-xs font-bold text-foreground">
          رد على <bdi className="font-bold text-foreground">{replyToName}</bdi>
        </span>
      )}
      {comment.isPinned && (
        <Badge variant="secondary" className="gap-1 bg-primary/15 text-primary">
          <Pin className="h-3 w-3" />
          مثبّت
        </Badge>
      )}
      {modOwnerName && displayName === modOwnerName && (
        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-500">
          <Heart className="h-3 w-3" />
          المؤلف
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
      {comment.isEdited && (
        <span className="text-[11px] text-muted-foreground/70">(تم التعديل)</span>
      )}
    </div>
  )
}
