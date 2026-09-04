import { Award, Crown, Languages, Shield, User } from 'lucide-react'
import { getTierLabel } from '@/lib/tiers'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Languages,
  Award,
  Crown,
  Shield,
}

const TIER_ICONS: Record<string, string> = {
  'عضو عادي': 'User',
  'مُعَرِّب جديد': 'Languages',
  'مُعَرِّب نشط': 'Languages',
  'مُعَرِّب محترف': 'Award',
  'مُعَرِّب معتمد': 'Crown',
  'مُعَرِّب أسطوري': 'Crown',
  'ناشر جديد': 'User',
  'ناشر موثوق': 'Award',
  'ناشر رئيسي': 'Crown',
  'مشرف جديد': 'Shield',
  مشرف: 'Shield',
  'مشرف كبير': 'Crown',
  مسؤول: 'Shield',
  'مسؤول أول': 'Crown',
  مدير: 'Shield',
  'مدير عام': 'Crown',
  'مدير تنفيذي': 'Crown',
  'مالك الموقع': 'Crown',
}

const TIER_COLORS: Record<string, string> = {
  'عضو عادي': '#6b7280',
  'مُعَرِّب جديد': '#0ea5e9',
  'مُعَرِّب نشط': '#38bdf8',
  'مُعَرِّب محترف': '#eab308',
  'مُعَرِّب معتمد': '#a855f7',
  'مُعَرِّب أسطوري': '#f59e0b',
  'ناشر جديد': '#14b8a6',
  'ناشر موثوق': '#06b6d4',
  'ناشر رئيسي': '#8b5cf6',
  'مشرف جديد': '#a78bfa',
  مشرف: '#8b5cf6',
  'مشرف كبير': '#7c3aed',
  مسؤول: '#ef4444',
  'مسؤول أول': '#dc2626',
  مدير: '#f97316',
  'مدير عام': '#ea580c',
  'مدير تنفيذي': '#c2410c',
  'مالك الموقع': '#f59e0b',
}

interface TierBadgeProps {
  tier: number
  role?: string | null
  size?: 'sm' | 'md' | 'lg'
}

export function TierBadge({ tier, role, size = 'sm' }: TierBadgeProps) {
  const label = getTierLabel(role, tier)
  if (!label) return null

  const iconName = TIER_ICONS[label] || 'User'
  const color = TIER_COLORS[label] || '#6b7280'
  const Icon = ICONS[iconName] || User
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
      {label}
    </span>
  )
}
