'use client'

import { Badge } from '@/components/ui/badge'

interface BadgeData {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

interface ProfileBadgesGridProps {
  badges: BadgeData[]
}

export function ProfileBadgesGrid({ badges }: ProfileBadgesGridProps) {
  if (badges.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="mb-3 text-4xl text-gray-600">🏆</div>
        <p className="text-sm text-gray-500">لا توجد شارات بعد</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {badges.map((b) => (
        <div
          key={b.id}
          className={`rounded-lg bg-[#1a1a1a] p-4 text-center transition-all ${
            b.earned ? 'ring-1 ring-primary/30' : 'opacity-40 grayscale'
          }`}
        >
          <div className="mb-2 text-3xl">{b.icon}</div>
          <h4 className="text-sm font-bold text-white">{b.name}</h4>
          <p className="mt-1 text-xs text-gray-500">{b.description}</p>
          {b.earned && (
            <Badge className="mt-2 text-[10px] bg-primary/20 text-primary">
              مكتسبة
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}
