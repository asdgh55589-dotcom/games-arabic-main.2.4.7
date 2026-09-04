import { BadgeCheck, Crown, PenTool, Send, Shield, Star, User as UserIcon } from 'lucide-react'
import type { UserRole } from '@/lib/roles'
import { getRoleLabel } from '@/lib/roles'

export const ROLE_BADGE: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  owner: {
    label: getRoleLabel('owner'),
    icon: <Crown className="h-3 w-3" />,
    className: 'bg-amber-500 text-white',
  },
  manager: {
    label: getRoleLabel('manager'),
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-orange-500 text-white',
  },
  admin: {
    label: getRoleLabel('admin'),
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-red-500 text-white',
  },
  moderator: {
    label: getRoleLabel('moderator'),
    icon: <Star className="h-3 w-3" />,
    className: 'bg-purple-500 text-white',
  },
  publisher: {
    label: getRoleLabel('publisher'),
    icon: <Send className="h-3 w-3" />,
    className: 'bg-teal-500 text-white',
  },
  creator: {
    label: getRoleLabel('creator'),
    icon: <BadgeCheck className="h-3 w-3" />,
    className: 'bg-sky-500 text-white',
  },
  member: {
    label: getRoleLabel('member'),
    icon: <UserIcon className="h-3 w-3" />,
    className: 'bg-blue-500 text-white',
  },
}

// للتوافق مع الأنواع القديمة
export const getRoleBadgeLabel = (role: string) => getRoleLabel(role as UserRole)
