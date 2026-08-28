/**
 * src/lib/special-roles.ts — التعريف المركزي للأدوار الخاصة
 *
 * الأدوار الخاصة هي إضافات للدور الأساسي، وليست بديلاً عنه.
 * كل دور خاص يتطلب حد أدنى من الدور الأساسي ويمنح صلاحيات إضافية.
 */

import type { UserRole } from '@/lib/roles'

export type SpecialRole =
  | 'official_translator'
  | 'reviewer'
  | 'team_lead'
  | 'featured_creator'
  | 'top_publisher'

export interface SpecialRoleConfig {
  id: SpecialRole
  nameAr: string
  descriptionAr: string
  icon: string
  color: string
  minMainRole: UserRole
  permissions: string[]
  isExclusive?: boolean
}

export const SPECIAL_ROLES: Record<SpecialRole, SpecialRoleConfig> = {
  official_translator: {
    id: 'official_translator',
    nameAr: 'مترجم رسمي',
    descriptionAr: 'مُعَرِّب معتمد رسمياً من الإدارة، يظهر بشكل مميز ويحصل على أولوية في الظهور',
    icon: '🎖️',
    color: 'text-blue-500',
    minMainRole: 'creator',
    permissions: ['priority_display', 'verified_badge'],
  },
  reviewer: {
    id: 'reviewer',
    nameAr: 'مراجع تعريبات',
    descriptionAr: 'يمكنه مراجعة والموافقة على تعريبات المُعَرِّبين الجدد',
    icon: '📝',
    color: 'text-purple-500',
    minMainRole: 'moderator',
    permissions: ['review_mods', 'approve_pending'],
  },
  team_lead: {
    id: 'team_lead',
    nameAr: 'قائد فريق',
    descriptionAr: 'يدير فريق ترجمة ويضيف أعضاء ويوافق على انضمامهم',
    icon: '👥',
    color: 'text-green-500',
    minMainRole: 'creator',
    permissions: ['manage_team', 'invite_members', 'approve_members'],
  },
  featured_creator: {
    id: 'featured_creator',
    nameAr: 'مُعَرِّب مميز',
    descriptionAr: 'يظهر في الصفحة الرئيسية وقسم المُعَرِّبين المميزين',
    icon: '⭐',
    color: 'text-yellow-500',
    minMainRole: 'creator',
    permissions: ['featured_display', 'homepage_spotlight'],
    isExclusive: true,
  },
  top_publisher: {
    id: 'top_publisher',
    nameAr: 'ناشر متميز',
    descriptionAr: 'ناشر متميز معترف به من الإدارة، يحصل على شارة خاصة وأولوية',
    icon: '💎',
    color: 'text-cyan-500',
    minMainRole: 'publisher',
    permissions: ['top_publisher_badge', 'priority_display'],
  },
}

export function parseSpecialRoles(specialRoles?: string | null): SpecialRole[] {
  if (!specialRoles) return []
  return specialRoles
    .split(',')
    .map((s) => s.trim() as SpecialRole)
    .filter((s) => SPECIAL_ROLES[s as SpecialRole])
}

export function formatSpecialRoles(roles: SpecialRole[]): string {
  return roles.join(',')
}

export function canHaveSpecialRole(mainRole: UserRole, specialRole: SpecialRole): boolean {
  const config = SPECIAL_ROLES[specialRole]
  if (!config) return false
  const hierarchy: UserRole[] = ['member', 'creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
  return hierarchy.indexOf(mainRole) >= hierarchy.indexOf(config.minMainRole)
}

export function hasSpecialRole(specialRoles: string | null | undefined, role: SpecialRole): boolean {
  return parseSpecialRoles(specialRoles).includes(role)
}

export function getSpecialRoleBadges(specialRoles: string | null | undefined) {
  return parseSpecialRoles(specialRoles).map((r) => SPECIAL_ROLES[r])
}
