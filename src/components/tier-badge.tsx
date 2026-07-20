import { User, Languages, Award, Crown, Shield } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  User, Languages, Award, Crown, Shield
}

interface TierBadgeProps {
  tier: number
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  if (tier === 0) return null

  const tiers: Record<number, { label: string; icon: string; color: string }> = {
    1: { label: 'مترجم', icon: 'Languages', color: '#3b82f6' },
    2: { label: 'محترف', icon: 'Award', color: '#eab308' },
    3: { label: 'خبير', icon: 'Crown', color: '#a855f7' },
    4: { label: 'مشرف', icon: 'Shield', color: '#ef4444' },
    5: { label: 'مدير', icon: 'Crown', color: '#f59e0b' },
  }

  const tierData = tiers[tier]
  if (!tierData) return null

  const Icon = ICONS[tierData.icon] || User
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : size === 'md' ? 'text-sm px-2 py-1' : 'text-base px-3 py-1.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClasses}`}
      style={{ backgroundColor: tierData.color }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {tierData.label}
    </span>
  )
}
