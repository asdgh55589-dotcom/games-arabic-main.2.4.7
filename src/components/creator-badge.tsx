'use client'

import { BadgeCheck } from 'lucide-react'

interface Props {
  role: string
  specialRoles?: string
  showLabel?: boolean
  size?: number
  className?: string
}

export function CreatorBadge({ role, specialRoles, showLabel = false, size = 16, className }: Props) {
  const isCreator =
    ['creator', 'publisher', 'moderator', 'admin', 'manager', 'owner'].includes(role) ||
    specialRoles?.includes('official_translator')

  if (!isCreator) return null

  return (
    <span
      className={`inline-flex items-center gap-1 text-primary ${className || ''}`}
      title="مُعَرِّب معتمد من Games Arabic"
    >
      <BadgeCheck style={{ width: size, height: size }} className="shrink-0" />
      {showLabel && <span className="text-xs">مُعَرِّب معتمد</span>}
    </span>
  )
}
