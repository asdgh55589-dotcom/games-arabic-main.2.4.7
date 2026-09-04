import { Calendar, Eye, Heart, Languages, Star, Users } from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Star,
  Languages,
  Eye,
  Users,
  Heart,
  Calendar,
}

interface SpecialRoleBadgeProps {
  roleKey: string
  roleName: string
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}

export function SpecialRoleBadge({
  roleKey,
  roleName,
  icon,
  color,
  size = 'sm',
}: SpecialRoleBadgeProps) {
  const Icon = ICONS[icon] || Star
  const sizeClasses =
    size === 'sm'
      ? 'text-xs px-1.5 py-0.5'
      : size === 'md'
        ? 'text-sm px-2 py-1'
        : 'text-base px-3 py-1.5'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClasses}`}
      style={{ backgroundColor: color }}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {roleName}
    </span>
  )
}
