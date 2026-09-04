'use client'

import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/lib/roles'
import { getRoleLabel, ROLE_LABELS } from '@/lib/roles'

interface RoleBadgeProps {
  role?: string | null
  size?: 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

const ROLE_COLORS: Record<UserRole, string> = {
  member: 'bg-slate-500 text-white',
  creator: 'bg-sky-500 text-white',
  publisher: 'bg-teal-500 text-white',
  moderator: 'bg-purple-500 text-white',
  admin: 'bg-red-500 text-white',
  manager: 'bg-orange-500 text-white',
  owner: 'bg-amber-500 text-white',
}

export function RoleBadge({ role, size = 'sm', className }: RoleBadgeProps) {
  const safeRole = (role || 'member') as UserRole
  const label = getRoleLabel(role)
  const color = ROLE_COLORS[safeRole] || ROLE_COLORS.member
  const sizeClass = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  // لا تعرض القيمة الخام — دائماً الاسم العربي
  if (!ROLE_LABELS[safeRole] && !role) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${color} ${sizeClass} ${className || ''}`}
    >
      {label}
    </span>
  )
}

// للتوافق: تصدير افتراضي أيضاً
export default RoleBadge
