import {
  Crown,
  Eye,
  FlaskConical,
  Gamepad2,
  Globe,
  Layers,
  Mail,
  Shield,
  Star,
  User,
  UserCheck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { SiDiscord, SiFacebook, SiInstagram, SiTelegram, SiX, SiYoutube } from 'react-icons/si'

export type TabKey = 'overview' | 'members' | 'mods' | 'stats'

export const ROLE_LABELS: Record<string, { label: string; icon: typeof User; color: string }> = {
  leader: { label: 'قائد', icon: Crown, color: 'text-amber-500' },
  coleader: { label: 'نائب القائد', icon: Star, color: 'text-purple-400' },
  translator: { label: 'مترجم', icon: Globe, color: 'text-blue-400' },
  reviewer: { label: 'مراجع', icon: Eye, color: 'text-green-400' },
  editor: { label: 'محرر', icon: UserCheck, color: 'text-cyan-400' },
  member: { label: 'عضو', icon: User, color: 'text-slate-300' },
  admin: { label: 'مدير', icon: Shield, color: 'text-red-400' },
  guest: { label: 'ضيف', icon: User, color: 'text-gray-500' },
  tester: { label: 'مختبر', icon: FlaskConical, color: 'text-emerald-500' },
}

export const CONTACT_ICONS: Record<string, ReactNode> = {
  mail: <Mail className="h-4 w-4" />,
  website: <Globe className="h-4 w-4" />,
  telegram: <SiTelegram className="h-4 w-4" />,
  twitter: <SiX className="h-4 w-4" />,
  youtube: <SiYoutube className="h-4 w-4" />,
  discord: <SiDiscord className="h-4 w-4" />,
  facebook: <SiFacebook className="h-4 w-4" />,
  instagram: <SiInstagram className="h-4 w-4" />,
}

export const CONTACT_COLORS: Record<string, string> = {
  mail: '#6b7280',
  website: '#3b82f6',
  telegram: '#229ED9',
  twitter: '#000000',
  youtube: '#FF0000',
  discord: '#5865F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
}

export const TEAM_TABS: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
  { key: 'overview', label: 'نظرة عامة', icon: Layers },
  { key: 'members', label: 'أعضاء الفريق', icon: Users },
  { key: 'mods', label: 'تعريبات الفريق', icon: Gamepad2 },
  { key: 'stats', label: 'إحصائيات الفريق', icon: Eye },
]
