'use client'

import { BadgeCheck, Star, Users, FileText, Gem } from 'lucide-react'
import { parseSpecialRoles, SPECIAL_ROLES, type SpecialRole } from '@/lib/special-roles'
import { cn } from '@/lib/utils'

interface Props {
  role?: string
  specialRoles?: string | null
  showLabels?: boolean
  showLabel?: boolean
  size?: 'sm' | 'md' | number
  className?: string
}

const ICON_MAP: Record<SpecialRole, typeof BadgeCheck> = {
  official_translator: BadgeCheck,
  reviewer: FileText,
  team_lead: Users,
  featured_creator: Star,
  top_publisher: Gem,
}

export function CreatorBadge({
  role,
  specialRoles,
  showLabels = false,
  showLabel = false,
  size = 'md',
  className,
}: Props) {
  const shouldShowLabel = showLabels || showLabel
  const badges = parseSpecialRoles(specialRoles)
  const isNumberSize = typeof size === 'number'
  const sizeClass = isNumberSize ? '' : size === 'sm' ? 'text-xs' : 'text-sm'
  const iconClass = isNumberSize ? '' : size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  const isCreatorRole = ['creator', 'publisher'].includes(role || '')

  if (badges.length === 0 && !isCreatorRole) return null

  return (
    <span className={cn('inline-flex items-center gap-1 flex-wrap', className)}>
      {badges.map((badge) => {
        const config = SPECIAL_ROLES[badge]
        const Icon = ICON_MAP[badge]
        return (
          <span
            key={badge}
            className={cn('inline-flex items-center gap-1', config.color, sizeClass)}
            title={config.descriptionAr}
          >
            {isNumberSize ? (
              <Icon
                style={{ width: size as number, height: size as number }}
                className="shrink-0"
              />
            ) : (
              <Icon className={iconClass} />
            )}
            {shouldShowLabel && <span>{config.nameAr}</span>}
          </span>
        )
      })}

      {badges.length === 0 && isCreatorRole && (
        <span
          className="inline-flex items-center gap-1 text-primary"
          title="مُعَرِّب معتمد من Games Arabic"
        >
          {isNumberSize ? (
            <BadgeCheck
              style={{ width: size as number, height: size as number }}
              className="shrink-0"
            />
          ) : (
            <BadgeCheck className={iconClass} />
          )}
          {shouldShowLabel && <span>مُعَرِّب معتمد</span>}
        </span>
      )}
    </span>
  )
}
