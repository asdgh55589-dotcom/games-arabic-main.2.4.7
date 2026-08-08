import { Crown, Shield, Star, User as UserIcon } from 'lucide-react'

export const ROLE_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  owner: {
    label: 'مالك',
    icon: <Crown className="h-3 w-3" />,
    className: 'bg-amber-500 text-white',
  },
  admin: {
    label: 'مدير',
    icon: <Shield className="h-3 w-3" />,
    className: 'bg-red-500 text-white',
  },
  moderator: {
    label: 'مشرف',
    icon: <Star className="h-3 w-3" />,
    className: 'bg-purple-500 text-white',
  },
  member: {
    label: 'عضو',
    icon: <UserIcon className="h-3 w-3" />,
    className: 'bg-blue-500 text-white',
  },
}
