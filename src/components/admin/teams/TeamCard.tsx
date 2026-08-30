'use client'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BadgeCheck, Star } from 'lucide-react'
import { TeamActions } from '@/components/admin/teams/TeamActions'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'

interface TeamCardProps {
  team: {
    id: string
    name: string
    logoUrl: string
    isOfficial: boolean
    isFeatured: boolean
    memberCount: number
    _count: { mods: number; follows: number }
    totalDownloads: number
  }
  onRefresh: () => void
}

export function TeamCard({ team, onRefresh }: TeamCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={team.logoUrl || FALLBACK_GAME_IMAGE} onError={(e: unknown) => { const t = (e as { currentTarget: HTMLImageElement }).currentTarget; if (t) t.src = FALLBACK_GAME_IMAGE }} />
            <AvatarFallback>{team.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium flex items-center gap-1 truncate">
              {team.name}
              {team.isOfficial && <BadgeCheck className="h-3 w-3 text-green-500" />}
              {team.isFeatured && <Star className="h-3 w-3 text-yellow-500" />}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {team.memberCount} عضو · {team._count.mods} تعريب
            </div>
          </div>
          <TeamActions team={team as never} onActionComplete={onRefresh} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-center">
            <div className="font-bold">{team.memberCount}</div>
            <div className="text-xs text-muted-foreground">عضو</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{team._count.mods}</div>
            <div className="text-xs text-muted-foreground">تعريب</div>
          </div>
          <div className="text-center">
            <div className="font-bold">{team.totalDownloads.toLocaleString('ar-EG')}</div>
            <div className="text-xs text-muted-foreground">تحميل</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
